'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/lib/db'
import { syncEngine } from '@/lib/sync-engine'
import { useStore } from '@/lib/store-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { ArrowRight, Plus, Trash2, Save, Sparkles, Scale, Pill } from 'lucide-react'
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

  // Fetch categories
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

  // Add unit
  const addUnit = () => {
    const newLevel = units.length + 1
    setUnits([...units, { level: newLevel, unit_name: '', qty_in_parent: 1, barcode: '', sell_price: '' }])
  }

  // Remove unit
  const removeUnit = (index: number) => {
    if (index === 0) return // Cannot remove base unit
    const newUnits = [...units]
    newUnits.splice(index, 1)
    // Fix levels
    newUnits.forEach((u, i) => { u.level = i + 1 })
    setUnits(newUnits)
  }

  const handleSave = async () => {
    try {
      setIsSubmitting(true)

      // 1. Validation
      if (!name.trim()) {
        toast.error('يرجى إدخال اسم المنتج')
        return
      }

      const cleanSell = cleanPositivePrice(sellPrice)
      const cleanBuy = cleanPositivePrice(buyPrice)
      const cleanMinSell = cleanPositivePrice(minSellPrice)

      if (cleanSell <= 0) {
        toast.error('سعر البيع يجب أن يكون أكبر من صفر (ممنوع الأرقام السالبة)')
        return
      }

      // Filter empty barcodes
      const validBarcodes = barcodes.filter(b => b.barcode.trim() !== '')

      // Check barcode uniqueness in local DB
      for (const b of validBarcodes) {
        const existing = await db.item_barcodes.where('barcode').equals(b.barcode.trim()).first()
        if (existing) {
          toast.error(`الباركود ${b.barcode} مسجل مسبقاً`)
          return
        }
      }
      
      // Also check unit barcodes
      for (const u of units) {
        if (u.barcode?.trim()) {
          const existing = await db.item_barcodes.where('barcode').equals(u.barcode.trim()).first()
          if (existing) {
            toast.error(`باركود التعبئة ${u.barcode} مسجل مسبقاً`)
            return
          }
        }
      }

      const itemId = crypto.randomUUID()
      const now = new Date().toISOString()
      
      const allBarcodesList = validBarcodes.map(b => b.barcode.trim())
      units.forEach(u => {
        if (u.barcode?.trim()) allBarcodesList.push(u.barcode.trim())
      })
      
      const unitNamesList = units.map(u => u.unit_name.trim())
      const pharmaKeywords = isPharma ? `${scientificName} ${activeIngredient}` : ''
      const searchText = `${name} ${nameEn} ${manufacturer} ${pharmaKeywords} ${allBarcodesList.join(' ')} ${unitNamesList.join(' ')}`.toLowerCase()

      const newItem = {
        id: itemId,
        store_id: 'default-store-001',
        name: name.trim(),
        name_en: nameEn.trim(),
        sku: sku.trim(),
        category_id: categoryId === 'none' ? undefined : categoryId,
        manufacturer: manufacturer.trim(),
        unit: units[0].unit_name.trim() || 'قطعة',
        item_type: itemType,
        buy_price: cleanBuy,
        sell_price: cleanSell,
        min_sell_price: cleanMinSell,
        manage_inventory: manageInventory,
        not_for_sale: false,
        low_stock_alert: cleanPositiveQuantity(lowStockAlert, allowDecimal),
        allow_decimal: allowDecimal,
        search_text: searchText,
        status: status,
        // Conditionally store pharma data
        ...(isPharma ? {
          scientific_name: scientificName.trim(),
          active_ingredient: activeIngredient.trim(),
          prescription_required: prescriptionRequired
        } : {}),
        created_at: now,
        updated_at: now
      }

      // Save using transaction
      await db.transaction('rw', [db.items, db.item_barcodes, db.item_units, db.stock_balances, db.stock_ledger, db.sync_queue], async () => {
        // 1. Add Item
        await db.items.add(newItem)
        syncEngine.enqueueOperation('items', 'INSERT', newItem)

        // 2. Add Barcodes
        for (const b of validBarcodes) {
          const itemBarcode = {
            id: crypto.randomUUID(),
            store_id: 'default-store-001',
            item_id: itemId,
            barcode: b.barcode.trim(),
            is_primary: b.is_primary,
            created_at: now
          }
          await db.item_barcodes.add(itemBarcode)
          syncEngine.enqueueOperation('item_barcodes', 'INSERT', itemBarcode)
        }

        // 3. Add Units
        let parentUnitName: string | undefined = undefined
        for (let i = 0; i < units.length; i++) {
          const u = units[i]
          const itemUnit = {
            id: crypto.randomUUID(),
            store_id: 'default-store-001',
            item_id: itemId,
            level: u.level,
            unit_name: u.unit_name.trim(),
            qty_in_parent: Math.max(1, Math.floor(Math.abs(Number(u.qty_in_parent) || 1))), // Safe whole integer
            parent_unit: parentUnitName,
            barcode: u.barcode?.trim() || undefined,
            sell_price: u.sell_price ? cleanPositivePrice(u.sell_price) : undefined,
            buy_price: undefined
          }
          await db.item_units.add(itemUnit)
          syncEngine.enqueueOperation('item_units', 'INSERT', itemUnit)
          parentUnitName = u.unit_name.trim()
        }

        // 4. Handle Opening Stock
        const openStockVal = Math.max(0, Number(openingStock) || 0)
        const cleanOpening = allowDecimal ? cleanPositiveQuantity(openStockVal, true) : Math.floor(openStockVal)

        const stockBalance = {
          id: crypto.randomUUID(),
          store_id: 'default-store-001',
          branch_id: 'default-branch-001',
          item_id: itemId,
          quantity: cleanOpening,
          updated_at: now
        }
        await db.stock_balances.add(stockBalance)
        syncEngine.enqueueOperation('stock_balances', 'INSERT', stockBalance)

        if (cleanOpening > 0) {
          const ledgerEntry = {
            id: crypto.randomUUID(),
            store_id: 'default-store-001',
            branch_id: 'default-branch-001',
            item_id: itemId,
            movement_type: 'opening' as const,
            direction: 'in' as const,
            quantity: cleanOpening,
            unit_price: cleanBuy,
            total: money(cleanBuy * cleanOpening),
            created_at: now
          }
          await db.stock_ledger.add(ledgerEntry)
          syncEngine.enqueueOperation('stock_ledger', 'INSERT', ledgerEntry)
        }
      })

      toast.success('تم إضافة المنتج بنجاح وتأمينه ضد السوالب والكسور العشوائية')
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
    <div className="space-y-6 pb-28" dir="rtl">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push('/dashboard/items')} className="h-10 w-10 shrink-0">
          <ArrowRight className="h-6 w-6" />
        </Button>
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">إضافة منتج جديد</h1>
          <p className="text-xs text-slate-400 font-medium">نشاط: {businessType === 'pharmacy' ? 'صيدلية' : 'سوبر ماركت وتجارة عامة'}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Column 1: Basic Info & Inventory */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>المعلومات الأساسية</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">اسم المنتج (عربي) *</Label>
                  <Input id="name" value={name} onChange={e => setName(e.target.value)} className="h-12" placeholder="مثال: جبنة دومتي بلس 500 جرام" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nameEn">اسم المنتج (إنجليزي)</Label>
                  <Input id="nameEn" value={nameEn} onChange={e => setNameEn(e.target.value)} className="h-12 text-left" dir="ltr" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sku">كود الصنف (SKU)</Label>
                  <Input id="sku" value={sku} onChange={e => setSku(e.target.value)} className="h-12" />
                </div>
                <div className="space-y-2">
                  <Label>التصنيف</Label>
                  <Select value={categoryId} onValueChange={setCategoryId}>
                    <SelectTrigger className="h-12">
                      <SelectValue placeholder="اختر التصنيف" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">بدون تصنيف</SelectItem>
                      {categories.map(cat => (
                        <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="manufacturer">الشركة المصنعة / المورد</Label>
                  <Input id="manufacturer" value={manufacturer} onChange={e => setManufacturer(e.target.value)} className="h-12" />
                </div>

                {/* Decimal Scale Toggle */}
                <div className="flex items-center justify-between p-3.5 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-800/40">
                  <div className="space-y-0.5">
                    <Label className="text-xs font-black flex items-center gap-1.5 text-slate-900 dark:text-white">
                      <Scale className="w-4 h-4 text-blue-500" />
                      صنف ميزان / يقبل الكسور (كجم)
                    </Label>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">إذا تم تفعيله، يسمح بالكسور حتى 3 أرقام عشرية</p>
                  </div>
                  <Switch checked={allowDecimal} onCheckedChange={setAllowDecimal} />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Conditional Pharmacy Information */}
          {isPharma && (
            <Card className="border-amber-500/30 bg-amber-500/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-amber-500">
                  <Pill className="h-5 w-5" />
                  بيانات الصيدلية والأدوية
                </CardTitle>
                <CardDescription>البيانات الطبية المخصصة للأدوية والمستلزمات الصيدلية</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>الاسم العلمي (Scientific Name)</Label>
                    <Input value={scientificName} onChange={e => setScientificName(e.target.value)} className="h-12 text-left" dir="ltr" placeholder="Paracetamol" />
                  </div>
                  <div className="space-y-2">
                    <Label>المادة الفعالة (Active Ingredient)</Label>
                    <Input value={activeIngredient} onChange={e => setActiveIngredient(e.target.value)} className="h-12" placeholder="باراسيتامول 500 مجم" />
                  </div>
                </div>
                <div className="flex items-center justify-between p-3.5 border border-amber-500/20 rounded-xl bg-amber-500/10">
                  <Label className="text-xs font-bold text-amber-900 dark:text-amber-200">صرف بروشتة فقط (Prescription Only)</Label>
                  <Switch checked={prescriptionRequired} onCheckedChange={setPrescriptionRequired} />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Packing levels & Units (Supermarket/General) */}
          <Card>
            <CardHeader>
              <CardTitle>مستويات التعبئة والوحدات</CardTitle>
              <CardDescription>أضف وحدات القياس للمنتج (مثل: كرتونة تحتوي على 12 علبة، والعلبة تحتوي على 10 قطع)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {units.map((unit, index) => (
                <div key={index} className="flex flex-col sm:flex-row gap-4 p-4 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-800/30 relative">
                  {index > 0 && (
                    <Button variant="ghost" size="icon" className="absolute top-2 left-2 text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40" onClick={() => removeUnit(index)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                  <div className="flex-1 space-y-2">
                    <Label>اسم الوحدة (المستوى {unit.level})</Label>
                    <Input placeholder="مثال: قطعة، علبة، كرتونة" value={unit.unit_name} onChange={e => {
                      const newUnits = [...units]; newUnits[index].unit_name = e.target.value; setUnits(newUnits)
                    }} className="h-12" />
                  </div>
                  {index > 0 && (
                    <div className="flex-1 space-y-2">
                      <Label>يحتوي على كم {units[index - 1].unit_name || 'وحدة أصغر'}؟ (عدد صحيح)</Label>
                      <Input type="number" min="1" step="1" value={unit.qty_in_parent} onChange={e => {
                        const newUnits = [...units]; newUnits[index].qty_in_parent = Math.max(1, Math.floor(Math.abs(Number(e.target.value) || 1))); setUnits(newUnits)
                      }} className="h-12" />
                    </div>
                  )}
                  <div className="flex-1 space-y-2">
                    <Label>باركود الوحدة (اختياري)</Label>
                    <Input value={unit.barcode} onChange={e => {
                      const newUnits = [...units]; newUnits[index].barcode = e.target.value; setUnits(newUnits)
                    }} className="h-12 font-mono" dir="ltr" />
                  </div>
                </div>
              ))}
              <Button type="button" variant="outline" onClick={addUnit} className="w-full h-12">
                <Plus className="ml-2 h-4 w-4" />
                إضافة مستوى تعبئة جديد
              </Button>
            </CardContent>
          </Card>

          {/* Inventory tracking */}
          <Card>
            <CardHeader>
              <CardTitle>إدارة المخزون وتفادي العجز</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between p-4 border border-slate-200 dark:border-slate-800 rounded-xl">
                <div className="space-y-0.5">
                  <Label className="text-base font-bold">تتبع المخزون</Label>
                  <div className="text-xs text-slate-500 dark:text-slate-400">تفعيل خصم الكميات عند البيع والتنبيه بنقص المخزون</div>
                </div>
                <Switch checked={manageInventory} onCheckedChange={setManageInventory} />
              </div>
              
              {manageInventory && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>الرصيد الافتتاحي (بأصغر وحدة: {units[0]?.unit_name || 'قطعة'})</Label>
                    <Input 
                      type="number" 
                      min="0" 
                      step={allowDecimal ? "0.001" : "1"} 
                      value={openingStock} 
                      onChange={e => setOpeningStock(Math.max(0, parseFloat(e.target.value) || 0).toString())} 
                      className="h-12" 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>تنبيه نقص المخزون</Label>
                    <Input 
                      type="number" 
                      min="0" 
                      step="1" 
                      value={lowStockAlert} 
                      onChange={e => setLowStockAlert(Math.max(0, parseFloat(e.target.value) || 0).toString())} 
                      className="h-12" 
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Column 2: Pricing & Barcodes */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>التسعير المالي (ممنوع السوالب)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="buyPrice">سعر الشراء (التكلفة)</Label>
                <div className="relative">
                  <Input 
                    id="buyPrice" 
                    type="number" 
                    step="0.01" 
                    min="0" 
                    value={buyPrice} 
                    onChange={e => setBuyPrice(Math.max(0, parseFloat(e.target.value) || 0).toString())} 
                    className="h-12 pl-12 text-lg font-mono font-bold" 
                  />
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">ج.م</span>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="sellPrice">سعر البيع الافتراضي *</Label>
                <div className="relative">
                  <Input 
                    id="sellPrice" 
                    type="number" 
                    step="0.01" 
                    min="0" 
                    value={sellPrice} 
                    onChange={e => setSellPrice(Math.max(0, parseFloat(e.target.value) || 0).toString())} 
                    className="h-12 pl-12 text-lg font-black text-blue-600 dark:text-blue-400 font-mono" 
                  />
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">ج.م</span>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="minSellPrice">أقل سعر للبيع (اختياري)</Label>
                <div className="relative">
                  <Input 
                    id="minSellPrice" 
                    type="number" 
                    step="0.01" 
                    min="0" 
                    value={minSellPrice} 
                    onChange={e => setMinSellPrice(Math.max(0, parseFloat(e.target.value) || 0).toString())} 
                    className="h-12 pl-12 font-mono" 
                  />
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">ج.م</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>الباركود</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {barcodes.map((b, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Input 
                    placeholder="امسح أو اكتب الباركود..." 
                    value={b.barcode} 
                    onChange={e => {
                      const newBarcodes = [...barcodes]; newBarcodes[index].barcode = e.target.value; setBarcodes(newBarcodes)
                    }}
                    className="h-12 font-mono"
                    dir="ltr"
                  />
                  {index > 0 && (
                    <Button variant="ghost" size="icon" className="shrink-0 text-rose-500 hover:text-rose-600" onClick={() => removeBarcode(index)}>
                      <Trash2 className="h-5 w-5" />
                    </Button>
                  )}
                </div>
              ))}
              <Button type="button" variant="outline" onClick={addBarcode} className="w-full h-12">
                <Plus className="ml-2 h-4 w-4" />
                إضافة باركود آخر
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Fixed bottom action bar */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 shadow-2xl z-30 flex justify-end gap-4 px-6 sm:px-12">
        <Button variant="outline" size="lg" className="h-14 px-8 text-base font-bold border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800" onClick={() => router.push('/dashboard/items')} disabled={isSubmitting}>
          إلغاء
        </Button>
        <Button size="lg" className="h-14 px-12 text-base font-black bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/30 active:scale-95 transition-all" onClick={handleSave} disabled={isSubmitting}>
          {isSubmitting ? 'جاري الحفظ...' : (
            <>
              <Save className="ml-2 h-5 w-5" />
              حفظ وتثبيت المنتج
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
