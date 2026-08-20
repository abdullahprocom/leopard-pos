'use client'

import React, { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/lib/db'
import { syncEngine } from '@/lib/sync-engine'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { ArrowRight, Plus, Trash2, Save, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import type { ItemType, ItemStatus } from '@/lib/types'

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

  // Fetch categories
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

  const handleUpdate = async () => {
    try {
      setIsSubmitting(true)

      if (!name.trim()) {
        toast.error('يرجى إدخال اسم المنتج')
        return
      }

      if (parseFloat(sellPrice) <= 0) {
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

      const updatedItem = {
        id: itemId,
        store_id: 'default',
        name: name.trim(),
        name_en: nameEn.trim(),
        sku: sku.trim(),
        category_id: categoryId === 'none' ? undefined : categoryId,
        manufacturer: manufacturer.trim(),
        unit: units[0].unit_name.trim() || 'قطعة',
        item_type: itemType,
        buy_price: parseFloat(buyPrice) || 0,
        sell_price: parseFloat(sellPrice) || 0,
        min_sell_price: parseFloat(minSellPrice) || 0,
        manage_inventory: manageInventory,
        not_for_sale: false,
        low_stock_alert: parseFloat(lowStockAlert) || 0,
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
            store_id: 'default',
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
            store_id: 'default',
            item_id: itemId,
            level: u.level,
            unit_name: u.unit_name.trim(),
            qty_in_parent: u.qty_in_parent || 1,
            parent_unit: parentUnitName,
            barcode: u.barcode?.trim() || undefined,
            sell_price: u.sell_price ? parseFloat(u.sell_price) : undefined,
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
    if (!confirm('هل أنت متأكد من حذف هذا المنتج؟')) return
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
        <div className="text-lg font-medium text-muted-foreground">جاري تحميل بيانات المنتج...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-20" dir="rtl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push('/dashboard/items')} className="h-10 w-10 shrink-0">
            <ArrowRight className="h-6 w-6" />
          </Button>
          <h1 className="text-3xl font-bold">تعديل المنتج: {name}</h1>
        </div>
        <Button variant="destructive" size="sm" onClick={handleDelete} disabled={isSubmitting}>
          <Trash2 className="ml-2 h-4 w-4" />
          حذف المنتج
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Column 1: Basic Info & Units & Inventory */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>المعلومات الأساسية</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">اسم المنتج (عربي) *</Label>
                  <Input id="name" value={name} onChange={e => setName(e.target.value)} className="h-12" />
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
                  <Label htmlFor="manufacturer">الشركة المصنعة</Label>
                  <Input id="manufacturer" value={manufacturer} onChange={e => setManufacturer(e.target.value)} className="h-12" />
                </div>
                <div className="space-y-2">
                  <Label>الحالة</Label>
                  <Select value={status} onValueChange={(val: any) => setStatus(val)}>
                    <SelectTrigger className="h-12">
                      <SelectValue placeholder="الحالة" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">نشط</SelectItem>
                      <SelectItem value="inactive">غير نشط</SelectItem>
                      <SelectItem value="archived">مؤرشف</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>مستويات التعبئة والوحدات</CardTitle>
              <CardDescription>أضف وحدات القياس ومعامل التفكيك للمنتج</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {units.map((unit, index) => (
                <div key={index} className="flex flex-col sm:flex-row gap-4 p-4 border rounded-lg bg-muted/20 relative">
                  {index > 0 && (
                    <Button variant="ghost" size="icon" className="absolute top-2 left-2 text-destructive" onClick={() => removeUnit(index)}>
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
                      <Label>يحتوي على كم {units[index - 1].unit_name || 'وحدة أصغر'}؟</Label>
                      <Input type="number" value={unit.qty_in_parent} onChange={e => {
                        const newUnits = [...units]; newUnits[index].qty_in_parent = Number(e.target.value); setUnits(newUnits)
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

          <Card>
            <CardHeader>
              <CardTitle>إدارة المخزون</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="space-y-0.5">
                  <Label className="text-base font-bold">تتبع المخزون</Label>
                  <div className="text-sm text-muted-foreground">تفعيل خصم الكميات عند البيع والتنبيه بنقص المخزون</div>
                </div>
                <Switch checked={manageInventory} onCheckedChange={setManageInventory} />
              </div>

              {manageInventory && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>المخزون الحالي (بأصغر وحدة: {units[0]?.unit_name || 'قطعة'})</Label>
                    <Input type="number" disabled value={currentStock} className="h-12 bg-muted font-bold" />
                    <span className="text-xs text-muted-foreground">لتعديل المخزون الحالي، استخدم عمليات الشراء أو الجرد</span>
                  </div>
                  <div className="space-y-2">
                    <Label>تنبيه نقص المخزون</Label>
                    <Input type="number" min="0" step="1" value={lowStockAlert} onChange={e => setLowStockAlert(e.target.value)} className="h-12" />
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
              <CardTitle>التسعير</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="buyPrice">سعر الشراء (التكلفة)</Label>
                <div className="relative">
                  <Input id="buyPrice" type="number" step="0.01" min="0" value={buyPrice} onChange={e => setBuyPrice(e.target.value)} className="h-12 pl-12 text-lg" />
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">ج.م</span>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="sellPrice">سعر البيع الافتراضي *</Label>
                <div className="relative">
                  <Input id="sellPrice" type="number" step="0.01" min="0" value={sellPrice} onChange={e => setSellPrice(e.target.value)} className="h-12 pl-12 text-lg font-bold text-primary" />
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">ج.م</span>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="minSellPrice">أقل سعر للبيع (اختياري)</Label>
                <div className="relative">
                  <Input id="minSellPrice" type="number" step="0.01" min="0" value={minSellPrice} onChange={e => setMinSellPrice(e.target.value)} className="h-12 pl-12" />
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">ج.م</span>
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
                    <Button variant="ghost" size="icon" className="shrink-0 text-destructive" onClick={() => removeBarcode(index)}>
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
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-2xl z-30 flex justify-end gap-4 px-6 sm:px-12">
        <Button variant="outline" size="lg" className="h-14 px-8 text-base font-bold border-slate-300 text-slate-700 hover:bg-slate-100" onClick={() => router.push('/dashboard/items')} disabled={isSubmitting}>
          إلغاء
        </Button>
        <Button size="lg" className="h-14 px-12 text-base font-black bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/30 active:scale-95 transition-all" onClick={handleUpdate} disabled={isSubmitting}>
          {isSubmitting ? 'جاري الحفظ...' : (
            <>
              <Save className="ml-2 h-5 w-5" />
              حفظ التعديلات
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
