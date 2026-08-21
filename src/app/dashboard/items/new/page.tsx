'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, ensureDefaultCategories } from '@/lib/db'
import { syncEngine, DEFAULT_STORE_UUID, DEFAULT_BRANCH_UUID } from '@/lib/sync-engine'
import { useStore } from '@/lib/store-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { ArrowRight, Plus, Trash2, Save, Scale, Pill, Check, FolderPlus, X } from 'lucide-react'
import { toast } from 'sonner'
import type { ItemType, ItemStatus } from '@/lib/types'
import { cleanPositiveQuantity, cleanPositivePrice, money } from '@/lib/finance'

export default function NewItemPage() {
  const router = useRouter()
  const { isPharma, businessType } = useStore()
  
  // Basic info
  const [name, setName] = useState('')
  const [nameEn, setNameEn] = useState('')
  const [sku, setSku] = useState('')
  const [categoryId, setCategoryId] = useState<string>('none')
  const [manufacturer, setManufacturer] = useState('')
  const [itemType, setItemType] = useState<ItemType>('stocked')
  const [status, setStatus] = useState<ItemStatus>('active')
  const [allowDecimal, setAllowDecimal] = useState(false) // ميزان / أوزان وكسور منضبطة
  
  // Inline category creation
  const [isAddingCategory, setIsAddingCategory] = useState(false)
  const [newCatName, setNewCatName] = useState('')

  // Pharmacy-specific info (conditional)
  const [scientificName, setScientificName] = useState('')
  const [activeIngredient, setActiveIngredient] = useState('')
  const [prescriptionRequired, setPrescriptionRequired] = useState(false)
  
  // Pricing
  const [buyPrice, setBuyPrice] = useState('0')
  const [sellPrice, setSellPrice] = useState('0')
  const [minSellPrice, setMinSellPrice] = useState('0')
  
  // Barcodes
  const [barcodes, setBarcodes] = useState<{ barcode: string; is_primary: boolean }[]>([
    { barcode: '', is_primary: true }
  ])
  
  // Packing levels (Units)
  const [units, setUnits] = useState<{ level: number; unit_name: string; qty_in_parent: number; barcode: string; sell_price: string }[]>([
    { level: 1, unit_name: 'قطعة', qty_in_parent: 1, barcode: '', sell_price: '' }
  ])
  
  // Inventory
  const [manageInventory, setManageInventory] = useState(true)
  const [openingStock, setOpeningStock] = useState('0')
  const [lowStockAlert, setLowStockAlert] = useState('5')

  const [isSubmitting, setIsSubmitting] = useState(false)

  // Fetch categories & ensure defaults
  useEffect(() => {
    ensureDefaultCategories(DEFAULT_STORE_UUID)
  }, [])

  const categories = useLiveQuery(() => db.categories.toArray(), []) || []

  // Add barcode
  const addBarcode = () => {
    setBarcodes([...barcodes, { barcode: '', is_primary: barcodes.length === 0 }])
  }

  // Remove barcode
  const removeBarcode = (index: number) => {
    const newBarcodes = [...barcodes]
    newBarcodes.splice(index, 1)
    if (newBarcodes.length > 0 && !newBarcodes.some(b => b.is_primary)) {
      newBarcodes[0].is_primary = true
    }
    setBarcodes(newBarcodes)
  }

  // Handle Scale toggle
  const handleScaleToggle = (checked: boolean) => {
    setAllowDecimal(checked)
    if (checked) {
      // Auto-set base unit to kilogram
      const newUnits = [...units]
      newUnits[0].unit_name = 'كيلو جرام'
      setUnits(newUnits)
      toast.info('تم تفعيل وضع الميزان: تم تعيين الوحدة الأساسية كـ (كيلو جرام) وحساب الجرامات')
    } else {
      const newUnits = [...units]
      newUnits[0].unit_name = 'قطعة'
      setUnits(newUnits)
    }
  }

  // Add unit
  const addUnit = () => {
    const newLevel = units.length + 1
    setUnits([...units, { level: newLevel, unit_name: '', qty_in_parent: 1, barcode: '', sell_price: '' }])
  }

  // Remove unit
  const removeUnit = (index: number) => {
    if (index === 0) return
    const newUnits = [...units]
    newUnits.splice(index, 1)
    newUnits.forEach((u, i) => { u.level = i + 1 })
    setUnits(newUnits)
  }

  // Create quick category
  const handleCreateCategory = async () => {
    if (!newCatName.trim()) {
      toast.error('يرجى كتابة اسم التصنيف')
      return
    }

    try {
      const newId = crypto.randomUUID()
      const now = new Date().toISOString()
      const catRecord = {
        id: newId,
        store_id: DEFAULT_STORE_UUID,
        name: newCatName.trim(),
        sort_order: categories.length + 1,
        created_at: now
      }

      await db.categories.add(catRecord)
      syncEngine.enqueueOperation('categories', 'INSERT', catRecord)

      setCategoryId(newId)
      setNewCatName('')
      setIsAddingCategory(false)
      toast.success(`تمت إضافة وتحديد تصنيف: ${catRecord.name}`)
    } catch (err: any) {
      toast.error('حدث خطأ أثناء إضافة التصنيف: ' + err.message)
    }
  }

  const handleSave = async () => {
    try {
      setIsSubmitting(true)

      // 1. Validation
      if (!name.trim()) {
        toast.error('يرجى كتابة اسم المنتج بالعربي')
        return
      }

      const cleanBuy = cleanPositivePrice(buyPrice)
      const cleanSell = cleanPositivePrice(sellPrice)
      const cleanMinSell = cleanPositivePrice(minSellPrice)

      if (cleanSell <= 0) {
        toast.error('يرجى تحديد سعر بيع صحيح أكبر من الصفر')
        return
      }

      const itemId = crypto.randomUUID()
      const now = new Date().toISOString()
      const storeId = DEFAULT_STORE_UUID
      const branchId = DEFAULT_BRANCH_UUID

      // Auto-generate clean SKU if empty
      const finalSku = sku.trim() || `SKU-${Date.now().toString().slice(-6)}`

      // 2. Main Item Record
      const newItem = {
        id: itemId,
        store_id: storeId,
        name: name.trim(),
        name_en: nameEn.trim() || undefined,
        sku: finalSku,
        category_id: categoryId === 'none' ? undefined : categoryId,
        manufacturer: manufacturer.trim() || undefined,
        unit: units[0]?.unit_name?.trim() || (allowDecimal ? 'كيلو جرام' : 'قطعة'),
        item_type: itemType,
        buy_price: cleanBuy,
        sell_price: cleanSell,
        min_sell_price: cleanMinSell > 0 ? cleanMinSell : 0,
        manage_inventory: manageInventory,
        not_for_sale: false,
        low_stock_alert: Math.max(0, parseInt(lowStockAlert) || 0),
        allow_decimal: allowDecimal,
        search_text: `${name} ${nameEn} ${finalSku} ${manufacturer}`.toLowerCase(),
        status: status,
        // Pharmacy
        scientific_name: isPharma && scientificName.trim() ? scientificName.trim() : undefined,
        active_ingredient: isPharma && activeIngredient.trim() ? activeIngredient.trim() : undefined,
        prescription_required: isPharma ? prescriptionRequired : false,
        created_at: now,
        updated_at: now
      }

      await db.transaction('rw', [
        db.items, 
        db.item_barcodes, 
        db.item_units, 
        db.stock_balances, 
        db.stock_ledger, 
        db.sync_queue
      ], async () => {
        // Insert main item
        await db.items.add(newItem)
        syncEngine.enqueueOperation('items', 'INSERT', newItem)

        // 3. Handle Barcodes
        for (const b of barcodes) {
          if (b.barcode.trim()) {
            const barcodeRecord = {
              id: crypto.randomUUID(),
              store_id: storeId,
              item_id: itemId,
              barcode: b.barcode.trim(),
              is_primary: b.is_primary,
              created_at: now
            }
            await db.item_barcodes.add(barcodeRecord)
            syncEngine.enqueueOperation('item_barcodes', 'INSERT', barcodeRecord)
          }
        }

        // 4. Handle Units
        let parentUnitName: string | undefined = undefined
        for (let i = 0; i < units.length; i++) {
          const u = units[i]
          const itemUnit = {
            id: crypto.randomUUID(),
            store_id: storeId,
            item_id: itemId,
            level: u.level,
            unit_name: u.unit_name.trim() || (allowDecimal ? 'كيلو جرام' : 'قطعة'),
            qty_in_parent: Math.max(1, Math.floor(Math.abs(Number(u.qty_in_parent) || 1))),
            parent_unit: parentUnitName,
            barcode: u.barcode?.trim() || undefined,
            sell_price: u.sell_price ? cleanPositivePrice(u.sell_price) : undefined,
            buy_price: undefined
          }
          await db.item_units.add(itemUnit)
          syncEngine.enqueueOperation('item_units', 'INSERT', itemUnit)
          parentUnitName = u.unit_name.trim()
        }

        // 5. Handle Opening Stock
        const openStockVal = Math.max(0, Number(openingStock) || 0)
        const cleanOpening = allowDecimal ? cleanPositiveQuantity(openStockVal, true) : Math.floor(openStockVal)

        const stockBalance = {
          id: crypto.randomUUID(),
          store_id: storeId,
          branch_id: branchId,
          item_id: itemId,
          quantity: cleanOpening,
          updated_at: now
        }
        await db.stock_balances.add(stockBalance)
        syncEngine.enqueueOperation('stock_balances', 'INSERT', stockBalance)

        if (cleanOpening > 0) {
          const ledgerEntry = {
            id: crypto.randomUUID(),
            store_id: storeId,
            branch_id: branchId,
            item_id: itemId,
            movement_type: 'opening' as const,
            direction: 'in' as const,
            quantity: cleanOpening,
            unit_price: cleanBuy,
            total: money(cleanBuy * cleanOpening),
            notes: 'رصيد افتتاحي عند إنشاء الصنف',
            created_at: now
          }
          await db.stock_ledger.add(ledgerEntry)
          syncEngine.enqueueOperation('stock_ledger', 'INSERT', ledgerEntry)
        }
      })

      toast.success('تمت إضافة المنتج وتأمينه بنجاح')
      router.push('/dashboard/items')
      router.refresh()

    } catch (error: any) {
      console.error(error)
      toast.error('حدث خطأ أثناء الحفظ: ' + error.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-6 pb-12 select-none" dir="rtl">
      {/* Top Header */}
      <div className="flex items-center justify-between bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push('/dashboard/items')} className="h-10 w-10 shrink-0 cursor-pointer">
            <ArrowRight className="h-6 w-6" />
          </Button>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">إضافة منتج جديد</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold">نشاط: {businessType === 'pharmacy' ? 'صيدلية' : 'سوبر ماركت وتجارة عامة'}</p>
          </div>
        </div>

        {/* Quick inline action buttons in header */}
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => router.push('/dashboard/items')} className="h-10 px-4 font-bold border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 cursor-pointer">
            إلغاء
          </Button>
          <Button size="sm" onClick={handleSave} disabled={isSubmitting} className="h-10 px-5 font-black bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-600/25 cursor-pointer">
            <Save className="ml-1.5 h-4 w-4" />
            حفظ الصنف
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Column 1: Basic Info & Inventory */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-slate-200/90 dark:border-slate-800 shadow-sm">
            <CardHeader className="border-b border-slate-100 dark:border-slate-800/80 pb-4">
              <CardTitle className="text-lg font-black text-slate-900 dark:text-white">المعلومات الأساسية</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5 pt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-slate-900 dark:text-white font-bold text-sm mb-2 block">اسم المنتج (عربي) *</Label>
                  <Input id="name" value={name} onChange={e => setName(e.target.value)} className="h-12 bg-slate-50 dark:bg-slate-900/90 text-slate-900 dark:text-white border-slate-300 dark:border-slate-700 font-bold" placeholder="مثال: شكارة أرز الضحى 25 كجم / جبنة رومي" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nameEn" className="text-slate-900 dark:text-white font-bold text-sm mb-2 block">اسم المنتج (إنجليزي)</Label>
                  <Input id="nameEn" value={nameEn} onChange={e => setNameEn(e.target.value)} className="h-12 text-left bg-slate-50 dark:bg-slate-900/90 text-slate-900 dark:text-white border-slate-300 dark:border-slate-700 font-bold" dir="ltr" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sku" className="text-slate-900 dark:text-white font-bold text-sm mb-2 block">كود الصنف (SKU)</Label>
                  <Input id="sku" value={sku} onChange={e => setSku(e.target.value)} className="h-12 bg-slate-50 dark:bg-slate-900/90 text-slate-900 dark:text-white border-slate-300 dark:border-slate-700 font-mono font-bold" placeholder="اتركه فارغاً للتوليد التلقائي" />
                </div>

                {/* Category with Inline Add */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-slate-900 dark:text-white font-bold text-sm block">التصنيف</Label>
                    {!isAddingCategory && (
                      <button
                        type="button"
                        onClick={() => setIsAddingCategory(true)}
                        className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1 cursor-pointer"
                      >
                        <FolderPlus className="w-3.5 h-3.5" />
                        + إضافة تصنيف جديد
                      </button>
                    )}
                  </div>

                  {isAddingCategory ? (
                    <div className="flex items-center gap-2 p-2 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800">
                      <Input
                        placeholder="اكتب اسم التصنيف (مثال: أرز وبقوليات)..."
                        value={newCatName}
                        onChange={e => setNewCatName(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleCreateCategory())}
                        className="h-10 bg-white dark:bg-slate-900 text-sm font-bold"
                        autoFocus
                      />
                      <Button type="button" size="sm" onClick={handleCreateCategory} className="h-10 px-3 bg-blue-600 hover:bg-blue-700 text-white font-bold cursor-pointer shrink-0">
                        <Check className="w-4 h-4" />
                        حفظ
                      </Button>
                      <Button type="button" variant="ghost" size="icon" onClick={() => setIsAddingCategory(false)} className="h-10 w-10 text-slate-400 hover:text-slate-600 cursor-pointer shrink-0">
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ) : (
                    <Select value={categoryId} onValueChange={setCategoryId}>
                      <SelectTrigger className="h-12 bg-slate-50 dark:bg-slate-900/90 text-slate-900 dark:text-white border-slate-300 dark:border-slate-700 font-bold">
                        <SelectValue placeholder="اختر التصنيف" />
                      </SelectTrigger>
                      <SelectContent className="dark:bg-slate-900 dark:border-slate-800 max-h-60">
                        <SelectItem value="none">بدون تصنيف</SelectItem>
                        {categories.map(cat => (
                          <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="manufacturer" className="text-slate-900 dark:text-white font-bold text-sm mb-2 block">الشركة المصنعة / المورد</Label>
                  <Input id="manufacturer" value={manufacturer} onChange={e => setManufacturer(e.target.value)} className="h-12 bg-slate-50 dark:bg-slate-900/90 text-slate-900 dark:text-white border-slate-300 dark:border-slate-700 font-bold" />
                </div>

                {/* Decimal Scale Toggle */}
                <div className="flex items-center justify-between p-4 border border-blue-500/30 rounded-xl bg-blue-50/50 dark:bg-blue-950/20">
                  <div className="space-y-1">
                    <Label className="text-sm font-black flex items-center gap-2 text-blue-700 dark:text-blue-400">
                      <Scale className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                      صنف ميزان ووزن بالجرامات (كجم)
                    </Label>
                    <p className="text-xs text-slate-600 dark:text-slate-300 font-medium">للأجبان واللحوم والخضار: يتيح البيع بالجرام أو بالمبلغ المالي (مثال: بـ 10 ج)</p>
                  </div>
                  <Switch checked={allowDecimal} onCheckedChange={handleScaleToggle} />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Packing levels & Units (Supermarket/General) */}
          <Card className="border-slate-200/90 dark:border-slate-800 shadow-sm">
            <CardHeader className="border-b border-slate-100 dark:border-slate-800/80 pb-4">
              <CardTitle className="text-lg font-black text-slate-900 dark:text-white">مستويات التعبئة والوحدات</CardTitle>
              <CardDescription className="text-slate-500 dark:text-slate-400 font-medium">الوحدة الأساسية للمنتج (قطعة، كيلو جرام، علبة، كرتونة، شكارة)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-6">
              {units.map((unit, index) => (
                <div key={index} className="flex flex-col sm:flex-row gap-4 p-4 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-800/30 relative">
                  {index > 0 && (
                    <Button variant="ghost" size="icon" className="absolute top-2 left-2 text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer" onClick={() => removeUnit(index)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                  <div className="flex-1 space-y-2">
                    <Label className="text-slate-900 dark:text-white font-bold text-sm mb-2 block">اسم الوحدة (المستوى {unit.level})</Label>
                    <Input placeholder="مثال: قطعة، كيلو جرام، باكت، شكارة، كرتونة" value={unit.unit_name} onChange={e => {
                      const newUnits = [...units]; newUnits[index].unit_name = e.target.value; setUnits(newUnits)
                    }} className="h-12 bg-white dark:bg-slate-900 text-slate-900 dark:text-white border-slate-300 dark:border-slate-700 font-bold" />
                  </div>
                  {index > 0 && (
                    <div className="flex-1 space-y-2">
                      <Label className="text-slate-900 dark:text-white font-bold text-sm mb-2 block">يحتوي على كم {units[index - 1].unit_name || 'وحدة أصغر'}؟</Label>
                      <Input 
                        type="text" 
                        inputMode="numeric"
                        value={unit.qty_in_parent} 
                        onKeyDown={(e) => {
                          if (e.key === '-' || e.key === 'e' || e.key === '+' || e.key === 'Subtract' || e.key === '.') {
                            e.preventDefault()
                          }
                        }}
                        onChange={e => {
                          const sanitized = e.target.value.replace(/[^0-9]/g, '')
                          const cleanVal = sanitized === '' ? 1 : Math.max(1, parseInt(sanitized, 10) || 1)
                          const newUnits = [...units]
                          newUnits[index].qty_in_parent = cleanVal
                          setUnits(newUnits)
                        }} 
                        className="h-12 bg-white dark:bg-slate-900 text-slate-900 dark:text-white border-slate-300 dark:border-slate-700 font-mono font-bold" 
                      />
                    </div>
                  )}
                  <div className="flex-1 space-y-2">
                    <Label className="text-slate-900 dark:text-white font-bold text-sm mb-2 block">باركود الوحدة (اختياري)</Label>
                    <Input value={unit.barcode} onChange={e => {
                      const newUnits = [...units]; newUnits[index].barcode = e.target.value; setUnits(newUnits)
                    }} className="h-12 font-mono bg-white dark:bg-slate-900 text-slate-900 dark:text-white border-slate-300 dark:border-slate-700 font-bold" dir="ltr" />
                  </div>
                </div>
              ))}
              {!allowDecimal && (
                <Button type="button" variant="outline" onClick={addUnit} className="w-full h-12 border-slate-300 dark:border-slate-700 font-bold cursor-pointer">
                  <Plus className="ml-2 h-4 w-4" />
                  إضافة مستوى تعبئة جديد (شكارة / كرتونة / باكت)
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Inventory tracking */}
          <Card className="border-slate-200/90 dark:border-slate-800 shadow-sm">
            <CardHeader className="border-b border-slate-100 dark:border-slate-800/80 pb-4">
              <CardTitle className="text-lg font-black text-slate-900 dark:text-white">إدارة المخزون وتفادي العجز</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 pt-6">
              <div className="flex items-center justify-between p-4 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-800/40">
                <div className="space-y-0.5">
                  <Label className="text-base font-bold text-slate-900 dark:text-white">تتبع المخزون</Label>
                  <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">خصم الكميات تلقائياً عند البيع والتنبيه بنقص المخزون</div>
                </div>
                <Switch checked={manageInventory} onCheckedChange={setManageInventory} />
              </div>
              
              {manageInventory && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-2">
                    <Label className="text-slate-900 dark:text-white font-bold text-sm mb-2 block">الرصيد الافتتاحي (بـ {units[0]?.unit_name || 'كيلو جرام'})</Label>
                    <Input 
                      type="text" 
                      inputMode="decimal"
                      value={openingStock} 
                      onKeyDown={(e) => {
                        if (e.key === '-' || e.key === 'e' || e.key === '+' || e.key === 'Subtract') {
                          e.preventDefault()
                        }
                      }}
                      onChange={e => {
                        const clean = e.target.value.replace(/[^0-9.]/g, '')
                        setOpeningStock(clean === '' ? '0' : clean)
                      }} 
                      className="h-12 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white border-slate-300 dark:border-slate-700 font-mono font-bold" 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-900 dark:text-white font-bold text-sm mb-2 block">تنبيه نقص المخزون</Label>
                    <Input 
                      type="text" 
                      inputMode="numeric"
                      value={lowStockAlert} 
                      onKeyDown={(e) => {
                        if (e.key === '-' || e.key === 'e' || e.key === '+' || e.key === 'Subtract') {
                          e.preventDefault()
                        }
                      }}
                      onChange={e => {
                        const clean = e.target.value.replace(/[^0-9]/g, '')
                        setLowStockAlert(clean === '' ? '0' : clean)
                      }} 
                      className="h-12 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white border-slate-300 dark:border-slate-700 font-mono font-bold" 
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Column 2: Pricing & Barcodes */}
        <div className="space-y-6">
          <Card className="border-slate-200/90 dark:border-slate-800 shadow-sm">
            <CardHeader className="border-b border-slate-100 dark:border-slate-800/80 pb-4">
              <CardTitle className="text-lg font-black text-slate-900 dark:text-white">
                التسعير المالي {allowDecimal ? '(سعر الكيلوجرام)' : ''}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-6">
              <div className="space-y-2">
                <Label htmlFor="buyPrice" className="text-slate-900 dark:text-white font-bold text-sm mb-2 block">
                  {allowDecimal ? 'سعر شراء الكيلو (التكلفة)' : 'سعر الشراء (التكلفة)'}
                </Label>
                <div className="relative">
                  <Input 
                    id="buyPrice" 
                    type="text" 
                    inputMode="decimal"
                    value={buyPrice} 
                    onKeyDown={(e) => {
                      if (e.key === '-' || e.key === 'e' || e.key === '+' || e.key === 'Subtract') {
                        e.preventDefault()
                      }
                    }}
                    onChange={e => {
                      const clean = e.target.value.replace(/[^0-9.]/g, '')
                      setBuyPrice(clean)
                    }} 
                    className="h-12 pl-12 text-lg font-mono font-bold bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white border-slate-300 dark:border-slate-700" 
                  />
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">ج.م</span>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="sellPrice" className="text-slate-900 dark:text-white font-bold text-sm mb-2 block">
                  {allowDecimal ? 'سعر بيع الكيلو الافتراضي *' : 'سعر البيع الافتراضي *'}
                </Label>
                <div className="relative">
                  <Input 
                    id="sellPrice" 
                    type="text" 
                    inputMode="decimal"
                    value={sellPrice} 
                    onKeyDown={(e) => {
                      if (e.key === '-' || e.key === 'e' || e.key === '+' || e.key === 'Subtract') {
                        e.preventDefault()
                      }
                    }}
                    onChange={e => {
                      const clean = e.target.value.replace(/[^0-9.]/g, '')
                      setSellPrice(clean)
                    }} 
                    className="h-12 pl-12 text-lg font-black text-blue-600 dark:text-blue-400 font-mono bg-slate-50 dark:bg-slate-900 border-blue-500/40" 
                  />
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">ج.م</span>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="minSellPrice" className="text-slate-900 dark:text-white font-bold text-sm mb-2 block">أقل سعر للبيع (اختياري)</Label>
                <div className="relative">
                  <Input 
                    id="minSellPrice" 
                    type="text" 
                    inputMode="decimal"
                    value={minSellPrice} 
                    onKeyDown={(e) => {
                      if (e.key === '-' || e.key === 'e' || e.key === '+' || e.key === 'Subtract') {
                        e.preventDefault()
                      }
                    }}
                    onChange={e => {
                      const clean = e.target.value.replace(/[^0-9.]/g, '')
                      setMinSellPrice(clean)
                    }} 
                    className="h-12 pl-12 font-mono font-bold bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white border-slate-300 dark:border-slate-700" 
                  />
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">ج.م</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200/90 dark:border-slate-800 shadow-sm">
            <CardHeader className="border-b border-slate-100 dark:border-slate-800/80 pb-4">
              <CardTitle className="text-lg font-black text-slate-900 dark:text-white">الباركود</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-6">
              {barcodes.map((b, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Input 
                    placeholder="امسح أو اكتب الباركود..." 
                    value={b.barcode} 
                    onChange={e => {
                      const newBarcodes = [...barcodes]; newBarcodes[index].barcode = e.target.value; setBarcodes(newBarcodes)
                    }}
                    className="h-12 font-mono font-bold bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white border-slate-300 dark:border-slate-700"
                    dir="ltr"
                  />
                  {index > 0 && (
                    <Button variant="ghost" size="icon" className="shrink-0 text-rose-500 hover:text-rose-600 cursor-pointer" onClick={() => removeBarcode(index)}>
                      <Trash2 className="h-5 w-5" />
                    </Button>
                  )}
                </div>
              ))}
              <Button type="button" variant="outline" onClick={addBarcode} className="w-full h-12 border-slate-300 dark:border-slate-700 font-bold cursor-pointer">
                <Plus className="ml-2 h-4 w-4" />
                إضافة باركود آخر
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Clean In-Flow Bottom Action Bar (No giant blocking footer) */}
      <div className="flex items-center justify-end gap-3 pt-6 border-t border-slate-200 dark:border-slate-800">
        <Button variant="outline" size="lg" className="h-12 px-6 text-sm font-bold border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer" onClick={() => router.push('/dashboard/items')} disabled={isSubmitting}>
          إلغاء
        </Button>
        <Button size="lg" className="h-12 px-8 text-sm font-black bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-600/25 active:scale-95 transition-all cursor-pointer" onClick={handleSave} disabled={isSubmitting}>
          {isSubmitting ? 'جاري الحفظ...' : (
            <>
              <Save className="ml-2 h-4 w-4" />
              حفظ وتثبيت المنتج
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
