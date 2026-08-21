'use client'

import React, { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, ensureDefaultCategories } from '@/lib/db'
import { syncEngine, DEFAULT_STORE_UUID, DEFAULT_BRANCH_UUID } from '@/lib/sync-engine'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { ArrowRight, Plus, Trash2, Save, Scale, AlertCircle, FolderPlus, Check, X } from 'lucide-react'
import { toast } from 'sonner'
import type { ItemType, ItemStatus } from '@/lib/types'
import { cleanPositivePrice, cleanPositiveQuantity, money } from '@/lib/finance'

export default function EditItemPage() {
  const router = useRouter()
  const params = useParams()
  const itemId = params?.id as string

  // Basic info
  const [name, setName] = useState('')
  const [nameEn, setNameEn] = useState('')
  const [sku, setSku] = useState('')
  const [categoryId, setCategoryId] = useState<string>('none')
  const [manufacturer, setManufacturer] = useState('')
  const [itemType, setItemType] = useState<ItemType>('stocked')
  const [status, setStatus] = useState<ItemStatus>('active')
  const [allowDecimal, setAllowDecimal] = useState(false)

  // Inline category creation
  const [isAddingCategory, setIsAddingCategory] = useState(false)
  const [newCatName, setNewCatName] = useState('')

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
  const [currentStock, setCurrentStock] = useState('0')
  const [lowStockAlert, setLowStockAlert] = useState('5')

  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Fetch categories & ensure defaults
  useEffect(() => {
    ensureDefaultCategories(DEFAULT_STORE_UUID)
  }, [])

  const categories = useLiveQuery(() => db.categories.toArray(), []) || []

  // Load existing item data
  useEffect(() => {
    async function loadItem() {
      if (!itemId) return
      try {
        const item = await db.items.get(itemId)
        if (!item) {
          toast.error('لم يتم العثور على المنتج')
          router.push('/dashboard/items')
          return
        }

        setName(item.name || '')
        setNameEn(item.name_en || '')
        setSku(item.sku || '')
        setCategoryId(item.category_id || 'none')
        setManufacturer(item.manufacturer || '')
        setItemType(item.item_type || 'stocked')
        setStatus(item.status || 'active')
        setAllowDecimal(Boolean(item.allow_decimal))
        setBuyPrice(String(item.buy_price || 0))
        setSellPrice(String(item.sell_price || 0))
        setMinSellPrice(String(item.min_sell_price || 0))
        setManageInventory(item.manage_inventory ?? true)
        setLowStockAlert(String(item.low_stock_alert || 5))

        // Load barcodes
        const existingBarcodes = await db.item_barcodes.where('item_id').equals(itemId).toArray()
        if (existingBarcodes.length > 0) {
          setBarcodes(existingBarcodes.map(b => ({ barcode: b.barcode, is_primary: b.is_primary })))
        }

        // Load units
        const existingUnits = await db.item_units.where('item_id').equals(itemId).sortBy('level')
        if (existingUnits.length > 0) {
          setUnits(existingUnits.map(u => ({
            level: u.level,
            unit_name: u.unit_name,
            qty_in_parent: u.qty_in_parent,
            barcode: u.barcode || '',
            sell_price: u.sell_price ? String(u.sell_price) : ''
          })))
        }

        // Load stock balance
        const balance = await db.stock_balances.where('item_id').equals(itemId).first()
        if (balance) {
          setCurrentStock(String(balance.quantity || 0))
        }

      } catch (err) {
        console.error(err)
        toast.error('حدث خطأ أثناء تحميل بيانات المنتج')
      } finally {
        setIsLoading(false)
      }
    }

    loadItem()
  }, [itemId, router])

  const addBarcode = () => {
    setBarcodes([...barcodes, { barcode: '', is_primary: barcodes.length === 0 }])
  }

  const removeBarcode = (index: number) => {
    const newBarcodes = [...barcodes]
    newBarcodes.splice(index, 1)
    if (newBarcodes.length > 0 && !newBarcodes.some(b => b.is_primary)) {
      newBarcodes[0].is_primary = true
    }
    setBarcodes(newBarcodes)
  }

  const addUnit = () => {
    const newLevel = units.length + 1
    setUnits([...units, { level: newLevel, unit_name: '', qty_in_parent: 1, barcode: '', sell_price: '' }])
  }

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

  const handleUpdate = async () => {
    try {
      setIsSubmitting(true)

      if (!name.trim()) {
        toast.error('يرجى إدخال اسم المنتج')
        return
      }

      const cleanBuy = cleanPositivePrice(buyPrice)
      const cleanSell = cleanPositivePrice(sellPrice)
      const cleanMinSell = cleanPositivePrice(minSellPrice)

      if (cleanSell <= 0) {
        toast.error('سعر البيع يجب أن يكون أكبر من صفر')
        return
      }

      const validBarcodes = barcodes.filter(b => b.barcode.trim() !== '')

      // Check barcode uniqueness against other items
      for (const b of validBarcodes) {
        const existing = await db.item_barcodes.where('barcode').equals(b.barcode.trim()).first()
        if (existing && existing.item_id !== itemId) {
          toast.error(`الباركود ${b.barcode} مسجل لمنتج آخر`)
          return
        }
      }

      const now = new Date().toISOString()
      const allBarcodesList = validBarcodes.map(b => b.barcode.trim())
      units.forEach(u => {
        if (u.barcode?.trim()) allBarcodesList.push(u.barcode.trim())
      })
      const unitNamesList = units.map(u => u.unit_name.trim())
      const searchText = `${name} ${nameEn} ${manufacturer} ${allBarcodesList.join(' ')} ${unitNamesList.join(' ')}`.toLowerCase()

      const storeId = DEFAULT_STORE_UUID

      const updatedItem = {
        id: itemId,
        store_id: storeId,
        name: name.trim(),
        name_en: nameEn.trim() || undefined,
        sku: sku.trim() || `SKU-${Date.now().toString().slice(-6)}`,
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
        search_text: searchText,
        status: status,
        updated_at: now
      }

      await db.transaction('rw', [db.items, db.item_barcodes, db.item_units, db.sync_queue], async () => {
        // 1. Update item
        await db.items.update(itemId, updatedItem)
        syncEngine.enqueueOperation('items', 'UPDATE', updatedItem)

        // 2. Refresh barcodes
        await db.item_barcodes.where('item_id').equals(itemId).delete()
        for (const b of validBarcodes) {
          const itemBarcode = {
            id: crypto.randomUUID(),
            store_id: storeId,
            item_id: itemId,
            barcode: b.barcode.trim(),
            is_primary: b.is_primary,
            created_at: now
          }
          await db.item_barcodes.add(itemBarcode)
          syncEngine.enqueueOperation('item_barcodes', 'INSERT', itemBarcode)
        }

        // 3. Refresh units
        await db.item_units.where('item_id').equals(itemId).delete()
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
      })

      toast.success('تم تحديث المنتج بنجاح')
      router.push('/dashboard/items')
      router.refresh()

    } catch (error: any) {
      console.error(error)
      toast.error('حدث خطأ أثناء الحفظ: ' + error.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('هل أنت متأكد من حذف هذا المنتج نهائياً؟')) return
    try {
      setIsSubmitting(true)
      await db.transaction('rw', [db.items, db.item_barcodes, db.item_units, db.stock_balances, db.sync_queue], async () => {
        await db.items.delete(itemId)
        await db.item_barcodes.where('item_id').equals(itemId).delete()
        await db.item_units.where('item_id').equals(itemId).delete()
        await db.stock_balances.where('item_id').equals(itemId).delete()
        syncEngine.enqueueOperation('items', 'DELETE', { id: itemId })
      })

      toast.success('تم حذف المنتج بنجاح')
      router.push('/dashboard/items')
      router.refresh()
    } catch (err: any) {
      toast.error('حدث خطأ أثناء الحذف: ' + err.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]" dir="rtl">
        <div className="text-lg font-bold text-slate-400">جاري تحميل بيانات المنتج...</div>
      </div>
    )
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
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">تعديل المنتج: {name}</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold">تعديل الأسعار والوحدات والباركودات</p>
          </div>
        </div>

        {/* Quick inline action buttons in header */}
        <div className="flex items-center gap-2">
          <Button variant="destructive" size="sm" onClick={handleDelete} disabled={isSubmitting} className="font-bold rounded-xl h-10 px-4 cursor-pointer">
            <Trash2 className="ml-1.5 h-4 w-4" />
            حذف الصنف
          </Button>
          <Button size="sm" onClick={handleUpdate} disabled={isSubmitting} className="h-10 px-5 font-black bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-600/25 cursor-pointer">
            <Save className="ml-1.5 h-4 w-4" />
            حفظ التعديلات
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Column 1: Basic Info & Units & Inventory */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-slate-200/90 dark:border-slate-800 shadow-sm">
            <CardHeader className="border-b border-slate-100 dark:border-slate-800/80 pb-4">
              <CardTitle className="text-lg font-black text-slate-900 dark:text-white">المعلومات الأساسية</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5 pt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-slate-900 dark:text-white font-bold text-sm mb-2 block">اسم المنتج (عربي) *</Label>
                  <Input id="name" value={name} onChange={e => setName(e.target.value)} className="h-12 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white border-slate-300 dark:border-slate-700 font-bold" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nameEn" className="text-slate-900 dark:text-white font-bold text-sm mb-2 block">اسم المنتج (إنجليزي)</Label>
                  <Input id="nameEn" value={nameEn} onChange={e => setNameEn(e.target.value)} className="h-12 text-left bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white border-slate-300 dark:border-slate-700 font-bold" dir="ltr" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sku" className="text-slate-900 dark:text-white font-bold text-sm mb-2 block">كود الصنف (SKU)</Label>
                  <Input id="sku" value={sku} onChange={e => setSku(e.target.value)} className="h-12 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white border-slate-300 dark:border-slate-700 font-mono font-bold" />
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
                      <SelectTrigger className="h-12 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white border-slate-300 dark:border-slate-700 font-bold">
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
                  <Input id="manufacturer" value={manufacturer} onChange={e => setManufacturer(e.target.value)} className="h-12 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white border-slate-300 dark:border-slate-700 font-bold" />
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-900 dark:text-white font-bold text-sm mb-2 block">الحالة</Label>
                  <Select value={status} onValueChange={(val: any) => setStatus(val)}>
                    <SelectTrigger className="h-12 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white border-slate-300 dark:border-slate-700 font-bold">
                      <SelectValue placeholder="الحالة" />
                    </SelectTrigger>
                    <SelectContent className="dark:bg-slate-900 dark:border-slate-800">
                      <SelectItem value="active">نشط</SelectItem>
                      <SelectItem value="inactive">غير نشط</SelectItem>
                      <SelectItem value="archived">مؤرشف</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Decimal Scale Toggle */}
                <div className="col-span-full flex items-center justify-between p-4 border border-blue-500/30 rounded-xl bg-blue-50/50 dark:bg-blue-950/20">
                  <div className="space-y-1">
                    <Label className="text-sm font-black flex items-center gap-2 text-blue-700 dark:text-blue-400">
                      <Scale className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                      صنف ميزان ووزن بالجرامات (كجم)
                    </Label>
                    <p className="text-xs text-slate-600 dark:text-slate-300 font-medium">للأجبان واللحوم والخضار: يتيح البيع بالجرام أو بالمبلغ المالي (مثال: بـ 10 ج)</p>
                  </div>
                  <Switch checked={allowDecimal} onCheckedChange={setAllowDecimal} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200/90 dark:border-slate-800 shadow-sm">
            <CardHeader className="border-b border-slate-100 dark:border-slate-800/80 pb-4">
              <CardTitle className="text-lg font-black text-slate-900 dark:text-white">مستويات التعبئة والوحدات</CardTitle>
              <CardDescription className="text-slate-500 dark:text-slate-400 font-medium">وحدات القياس ومعامل التفكيك للمنتج</CardDescription>
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

          <Card className="border-slate-200/90 dark:border-slate-800 shadow-sm">
            <CardHeader className="border-b border-slate-100 dark:border-slate-800/80 pb-4">
              <CardTitle className="text-lg font-black text-slate-900 dark:text-white">إدارة المخزون</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 pt-6">
              <div className="flex items-center justify-between p-4 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-800/40">
                <div className="space-y-0.5">
                  <Label className="text-base font-bold text-slate-900 dark:text-white">تتبع المخزون</Label>
                  <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">تفعيل خصم الكميات عند البيع والتنبيه بنقص المخزون</div>
                </div>
                <Switch checked={manageInventory} onCheckedChange={setManageInventory} />
              </div>

              {manageInventory && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-2">
                    <Label className="text-slate-900 dark:text-white font-bold text-sm mb-2 block">المخزون الحالي (بـ {units[0]?.unit_name || 'كيلو جرام'})</Label>
                    <Input type="number" disabled value={currentStock} className="h-12 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-mono font-black" />
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold">لتعديل المخزون الحالي، استخدم عمليات الشراء أو الجرد</span>
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
                التسعير {allowDecimal ? '(سعر الكيلوجرام)' : ''}
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
        <Button size="lg" className="h-12 px-8 text-sm font-black bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-600/25 active:scale-95 transition-all cursor-pointer" onClick={handleUpdate} disabled={isSubmitting}>
          {isSubmitting ? 'جاري الحفظ...' : (
            <>
              <Save className="ml-2 h-4 w-4" />
              حفظ التعديلات
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
