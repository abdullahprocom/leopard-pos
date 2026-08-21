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
import { ArrowRight, Plus, Trash2, Save, Scale, Pill, Check, FolderPlus, X, Shirt, Sparkles, AlertCircle, Calendar, Hash, Wand2, QrCode, History } from 'lucide-react'
import { toast } from 'sonner'
import type { ItemType, ItemStatus, BusinessType, ItemPriceHistory } from '@/lib/types'
import { cleanPositiveQuantity, cleanPositivePrice, money, generateBarcode } from '@/lib/finance'

export default function NewItemPage() {
  const router = useRouter()
  const { businessType, isPharma, isSupermarket, isClothing } = useStore()
  
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

  // 💊 Pharmacy-specific dynamic fields
  const [scientificName, setScientificName] = useState('')
  const [activeIngredient, setActiveIngredient] = useState('')
  const [batchNumber, setBatchNumber] = useState('')
  const [expiryDate, setExpiryDate] = useState('')
  const [prescriptionRequired, setPrescriptionRequired] = useState(false)
  
  // 👕 Clothing-specific dynamic fields
  const [size, setSize] = useState('')
  const [color, setColor] = useState('')
  const [brand, setBrand] = useState('')

  // Pricing
  const [buyPrice, setBuyPrice] = useState('0')
  const [sellPrice, setSellPrice] = useState('0')
  const [minSellPrice, setMinSellPrice] = useState('0')
  
  // Barcodes
  const [barcodes, setBarcodes] = useState<{ barcode: string; is_primary: boolean }[]>([
    { barcode: '', is_primary: true }
  ])
  
  // 🔄 Dynamic Units of Measure (UOM)
  const [units, setUnits] = useState<{ level: number; unit_name: string; qty_in_parent: number; barcode: string; sell_price: string }[]>([
    { level: 1, unit_name: isSupermarket ? 'قطعة' : isPharma ? 'علبة' : 'قطعة', qty_in_parent: 1, barcode: '', sell_price: '' }
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

  // Dynamic Suggestion Chips for Unit of Measure based on profile
  const unitSuggestions = isSupermarket 
    ? ['قطعة', 'كيلو جرام', 'جرام', 'باكت', 'شكارة', 'كرتونة', 'دستة', 'لتر', 'علبة']
    : isPharma
    ? ['علبة', 'شريط', 'قرص', 'أمبول', 'كبسولة', 'زجاجة', 'أنبوبة', 'باكت']
    : isClothing
    ? ['قطعة', 'طقم', 'دستة', 'كرتونة', 'زوج', 'عبوة']
    : ['قطعة', 'علبة', 'كرتونة', 'كيلو جرام', 'لتر', 'دستة']

  const clothingSizes = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL', '38', '40', '42', '44', '46']
  const clothingColors = ['أسود', 'أبيض', 'كحلي', 'أزرق', 'رمادي', 'بيج', 'أحمر', 'أخضر', 'بني', 'زيتي']

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
      const newUnits = [...units]
      newUnits[0].unit_name = 'كيلو جرام'
      setUnits(newUnits)
      toast.info('تم تفعيل وضع الميزان: تم تعيين الوحدة الأساسية كـ (كيلو جرام) لحساب الأوزان والكسور')
    }
  }

  // Add unit level
  const addUnit = () => {
    const newLevel = units.length + 1
    const defaultName = newLevel === 2 ? 'باكت / كرتونة' : 'شكارة'
    setUnits([...units, { level: newLevel, unit_name: defaultName, qty_in_parent: 10, barcode: '', sell_price: '' }])
  }

  // Remove unit level
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

      // 2. Main Item Record with Dynamic Fields
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
        search_text: `${name} ${nameEn} ${finalSku} ${manufacturer} ${scientificName} ${activeIngredient} ${brand} ${size} ${color}`.toLowerCase(),
        status: status,
        // 💊 Pharmacy fields
        scientific_name: isPharma && scientificName.trim() ? scientificName.trim() : undefined,
        active_ingredient: isPharma && activeIngredient.trim() ? activeIngredient.trim() : undefined,
        batch_number: isPharma && batchNumber.trim() ? batchNumber.trim() : undefined,
        expiry_date: isPharma && expiryDate ? expiryDate : undefined,
        prescription_required: isPharma ? prescriptionRequired : false,
        // 👕 Clothing fields
        size: isClothing && size.trim() ? size.trim() : undefined,
        color: isClothing && color.trim() ? color.trim() : undefined,
        brand: isClothing && brand.trim() ? brand.trim() : undefined,
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

        // 4. Handle Dynamic Units of Measure (UOM) with cumulative conversion factors
        let cumulativeConversion = 1
        let parentUnitName: string | undefined = undefined
        for (let i = 0; i < units.length; i++) {
          const u = units[i]
          const qtyInParent = Math.max(1, Math.floor(Math.abs(Number(u.qty_in_parent) || 1)))
          cumulativeConversion = i === 0 ? 1 : cumulativeConversion * qtyInParent
          
          const itemUnit = {
            id: crypto.randomUUID(),
            store_id: storeId,
            item_id: itemId,
            level: u.level,
            unit_name: u.unit_name.trim() || (allowDecimal ? 'كيلو جرام' : 'قطعة'),
            qty_in_parent: qtyInParent,
            conversion_factor: cumulativeConversion,
            parent_unit: parentUnitName,
            barcode: u.barcode?.trim() || undefined,
            sell_price: u.sell_price ? cleanPositivePrice(u.sell_price) : undefined,
            buy_price: undefined
          }
          await db.item_units.add(itemUnit)
          syncEngine.enqueueOperation('item_units', 'INSERT', itemUnit)
          parentUnitName = u.unit_name.trim()

          // If unit has its own barcode, register in item_barcodes
          if (u.barcode?.trim()) {
            const unitBarcodeRecord = {
              id: crypto.randomUUID(),
              store_id: storeId,
              item_id: itemId,
              barcode: u.barcode.trim(),
              is_primary: false,
              unit_name: u.unit_name.trim(),
              conversion_factor: cumulativeConversion,
              price_override: u.sell_price ? cleanPositivePrice(u.sell_price) : undefined,
              created_at: now
            }
            await db.item_barcodes.add(unitBarcodeRecord)
            syncEngine.enqueueOperation('item_barcodes', 'INSERT', unitBarcodeRecord)
          }
        }

        // 5. Initial Price History Audit Record
        const priceHistoryRecord = {
          id: crypto.randomUUID(),
          store_id: storeId,
          item_id: itemId,
          old_buy_price: 0,
          new_buy_price: cleanBuy,
          old_sell_price: 0,
          new_sell_price: cleanSell,
          change_reason: 'السعر الافتتاحي عند إضافة الصنف للكتالوج',
          created_at: now
        }
        await db.item_price_history.add(priceHistoryRecord)
        syncEngine.enqueueOperation('item_price_history', 'INSERT', priceHistoryRecord)

        // 6. Handle Opening Stock (in base unit)
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

  const profileLabels: Record<string, { name: string; icon: any; color: string }> = {
    supermarket: { name: 'سوبر ماركت وتجارة عامة', icon: Scale, color: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800' },
    pharmacy: { name: 'صيدلية وأدوية ومستلزمات طبية', icon: Pill, color: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800' },
    clothing: { name: 'ملابس وأحذية وموضة', icon: Shirt, color: 'text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/40 border-purple-200 dark:border-purple-800' },
    general: { name: 'تجارة عامة ومخازن', icon: Sparkles, color: 'text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700' },
    restaurant: { name: 'مطاعم وكافيهات', icon: Sparkles, color: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800' },
  }

  const currentProfileInfo = profileLabels[businessType] || profileLabels.supermarket
  const ProfileIcon = currentProfileInfo.icon

  return (
    <div className="space-y-6 pb-12 select-none" dir="rtl">
      {/* Top Header with Dynamic Profile Indicator */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push('/dashboard/items')} className="h-10 w-10 shrink-0 cursor-pointer">
            <ArrowRight className="h-6 w-6" />
          </Button>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">إضافة منتج جديد</h1>
            <div className={`inline-flex items-center gap-1.5 mt-1.5 px-3 py-1 rounded-lg text-xs font-black border ${currentProfileInfo.color}`}>
              <ProfileIcon className="w-3.5 h-3.5" />
              <span>النمط النشط: {currentProfileInfo.name}</span>
            </div>
          </div>
        </div>

        {/* Quick inline action buttons in header */}
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
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
        
        {/* Column 1: Basic Info, Dynamic Profile Fields, and Dynamic Units */}
        <div className="lg:col-span-2 space-y-6">
          {/* Basic Info Card */}
          <Card className="border-slate-200/90 dark:border-slate-800 shadow-sm">
            <CardHeader className="border-b border-slate-100 dark:border-slate-800/80 pb-4">
              <CardTitle className="text-lg font-black text-slate-900 dark:text-white">المعلومات الأساسية</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5 pt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-slate-900 dark:text-white font-bold text-sm mb-2 block">اسم المنتج (عربي) *</Label>
                  <Input id="name" value={name} onChange={e => setName(e.target.value)} className="h-12 bg-slate-50 dark:bg-slate-900/90 text-slate-900 dark:text-white border-slate-300 dark:border-slate-700 font-bold" placeholder={isSupermarket ? "مثال: أرز الضحى / جبنة رومي" : isPharma ? "مثال: بنادول إكسترا 500 مجم" : "مثال: قميص قطن كلاسيك"} />
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

                {/* 🛒 Supermarket Decimal Scale Toggle (Shown only for Supermarket / General) */}
                {(isSupermarket || businessType === 'general') && (
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
                )}
              </div>
            </CardContent>
          </Card>

          {/* 💊 Dynamic Profile Card: Pharmacy Specific Fields */}
          {isPharma && (
            <Card className="border-emerald-500/30 dark:border-emerald-800 bg-emerald-50/20 dark:bg-emerald-950/10 shadow-sm">
              <CardHeader className="border-b border-emerald-100 dark:border-emerald-900/40 pb-4">
                <CardTitle className="text-lg font-black text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
                  <Pill className="w-5 h-5 text-emerald-600" />
                  المواصفات الصيدلانية والطبية
                </CardTitle>
                <CardDescription className="text-emerald-700/80 dark:text-emerald-400 font-medium">بيانات المادة الفعالة، تاريخ الصلاحية، وروشتة الصرف</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5 pt-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-2">
                    <Label className="text-slate-900 dark:text-white font-bold text-sm mb-2 block">الاسم العلمي (Scientific Name)</Label>
                    <Input value={scientificName} onChange={e => setScientificName(e.target.value)} placeholder="مثال: Paracetamol" className="h-12 bg-white dark:bg-slate-900 font-bold" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-900 dark:text-white font-bold text-sm mb-2 block">المادة الفعالة والتركيز</Label>
                    <Input value={activeIngredient} onChange={e => setActiveIngredient(e.target.value)} placeholder="مثال: Paracetamol 500mg" className="h-12 bg-white dark:bg-slate-900 font-bold" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-900 dark:text-white font-bold text-sm mb-2 block">رقم التشغيلة (Batch Number)</Label>
                    <Input value={batchNumber} onChange={e => setBatchNumber(e.target.value)} placeholder="مثال: B-9982" className="h-12 bg-white dark:bg-slate-900 font-mono font-bold" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-900 dark:text-white font-bold text-sm mb-2 block">تاريخ انتهاء الصلاحية</Label>
                    <Input type="date" value={expiryDate} onChange={e => setExpiryDate(e.target.value)} className="h-12 bg-white dark:bg-slate-900 font-mono font-bold" />
                  </div>
                  <div className="col-span-full flex items-center justify-between p-4 border border-emerald-200 dark:border-emerald-800 rounded-xl bg-white dark:bg-slate-900">
                    <div className="space-y-0.5">
                      <Label className="text-sm font-bold text-slate-900 dark:text-white">يتطلب روشتة طبية (Prescription Required)</Label>
                      <p className="text-xs text-slate-500 dark:text-slate-400">تنبيه الكاشير بضرورة وجود وصفة طبية لصرف هذا الدواء (جدول/مضادات)</p>
                    </div>
                    <Switch checked={prescriptionRequired} onCheckedChange={setPrescriptionRequired} />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* 👕 Dynamic Profile Card: Clothing & Apparel Specific Fields */}
          {isClothing && (
            <Card className="border-purple-500/30 dark:border-purple-800 bg-purple-50/20 dark:bg-purple-950/10 shadow-sm">
              <CardHeader className="border-b border-purple-100 dark:border-purple-900/40 pb-4">
                <CardTitle className="text-lg font-black text-purple-800 dark:text-purple-300 flex items-center gap-2">
                  <Shirt className="w-5 h-5 text-purple-600" />
                  مواصفات الملابس والموضة
                </CardTitle>
                <CardDescription className="text-purple-700/80 dark:text-purple-400 font-medium">المقاسات، الألوان، والعلامة التجارية</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5 pt-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-2">
                    <Label className="text-slate-900 dark:text-white font-bold text-sm mb-2 block">الماركة / البراند (Brand)</Label>
                    <Input value={brand} onChange={e => setBrand(e.target.value)} placeholder="مثال: Zara / Nike / Boss" className="h-12 bg-white dark:bg-slate-900 font-bold" />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-slate-900 dark:text-white font-bold text-sm mb-2 block">المقاس (Size)</Label>
                    <Input value={size} onChange={e => setSize(e.target.value)} placeholder="اكتب أو اختر مقاس..." className="h-12 bg-white dark:bg-slate-900 font-bold" />
                    <div className="flex flex-wrap gap-1.5 pt-1.5">
                      {clothingSizes.map(s => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setSize(s)}
                          className={`px-2.5 py-1 rounded-md text-xs font-bold border transition-colors cursor-pointer ${size === s ? 'bg-purple-600 text-white border-purple-600' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-purple-50'}`}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-slate-900 dark:text-white font-bold text-sm mb-2 block">اللون (Color)</Label>
                    <Input value={color} onChange={e => setColor(e.target.value)} placeholder="اكتب أو اختر لون..." className="h-12 bg-white dark:bg-slate-900 font-bold" />
                    <div className="flex flex-wrap gap-1.5 pt-1.5">
                      {clothingColors.map(c => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setColor(c)}
                          className={`px-2.5 py-1 rounded-md text-xs font-bold border transition-colors cursor-pointer ${color === c ? 'bg-purple-600 text-white border-purple-600' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-purple-50'}`}
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* 🔄 Dynamic Units of Measure (UOM) Card */}
          <Card className="border-slate-200/90 dark:border-slate-800 shadow-sm">
            <CardHeader className="border-b border-slate-100 dark:border-slate-800/80 pb-4">
              <CardTitle className="text-lg font-black text-slate-900 dark:text-white">
                ديناميكية وحدات القياس ومستويات التعبئة (Dynamic UOM)
              </CardTitle>
              <CardDescription className="text-slate-500 dark:text-slate-400 font-medium">
                تحديد اسم أي وحدة قياس مخصصة ومعامل التفكيك الرياضي (Conversion Factor)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5 pt-6">
              {/* Quick suggestion unit chips */}
              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-500 dark:text-slate-400 block">اقتراحات سريعة لمسميات الوحدات (يمكنك أيضاً كتابة أي اسم):</Label>
                <div className="flex flex-wrap gap-1.5">
                  {unitSuggestions.map(uName => (
                    <button
                      key={uName}
                      type="button"
                      onClick={() => {
                        const newUnits = [...units]
                        newUnits[0].unit_name = uName
                        setUnits(newUnits)
                      }}
                      className="px-3 py-1 rounded-lg text-xs font-bold bg-slate-100 dark:bg-slate-800 hover:bg-blue-100 hover:text-blue-700 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
                    >
                      + {uName}
                    </button>
                  ))}
                </div>
              </div>

              {units.map((unit, index) => (
                <div key={index} className="flex flex-col sm:flex-row gap-4 p-4 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-800/30 relative">
                  {index > 0 && (
                    <Button variant="ghost" size="icon" className="absolute top-2 left-2 text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer" onClick={() => removeUnit(index)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                  <div className="flex-1 space-y-2">
                    <Label className="text-slate-900 dark:text-white font-bold text-sm mb-2 block">
                      {index === 0 ? 'اسم الوحدة الأساسية الصغرى (المستوى 1)' : `اسم الوحدة الأكبر (المستوى ${unit.level})`}
                    </Label>
                    <Input 
                      placeholder="مثال: قطعة، كيلو جرام، علبة، شريط، باكت، شكارة..." 
                      value={unit.unit_name} 
                      onChange={e => {
                        const newUnits = [...units]
                        newUnits[index].unit_name = e.target.value
                        setUnits(newUnits)
                      }} 
                      className="h-12 bg-white dark:bg-slate-900 text-slate-900 dark:text-white border-slate-300 dark:border-slate-700 font-bold" 
                    />
                  </div>
                  {index > 0 && (
                    <div className="flex-1 space-y-2">
                      <Label className="text-slate-900 dark:text-white font-bold text-sm mb-2 block">
                        معامل التفكيك: كم {units[index - 1].unit_name || 'وحدة أصغر'} بداخل الـ {unit.unit_name || 'وحدة'}؟
                      </Label>
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
                    <Label className="text-slate-900 dark:text-white font-bold text-sm mb-2 block">باركود خاص بالوحدة (اختياري)</Label>
                    <div className="flex items-center gap-1.5">
                      <Input value={unit.barcode} onChange={e => {
                        const newUnits = [...units]; newUnits[index].barcode = e.target.value; setUnits(newUnits)
                      }} className="h-12 font-mono bg-white dark:bg-slate-900 text-slate-900 dark:text-white border-slate-300 dark:border-slate-700 font-bold" dir="ltr" placeholder="باركود العبوة..." />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        title="توليد باركود للوحدة"
                        onClick={() => {
                          const newUnits = [...units]
                          newUnits[index].barcode = generateBarcode()
                          setUnits(newUnits)
                          toast.success(`تم توليد باركود لوحدة (${unit.unit_name}) بنجاح`)
                        }}
                        className="h-12 w-12 shrink-0 border-slate-300 dark:border-slate-700 hover:border-blue-500 hover:text-blue-600 cursor-pointer"
                      >
                        <Wand2 className="w-4 h-4 text-blue-600" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}

              {/* Dynamic Mathematical Breakdown Banner */}
              {units.length > 1 && (
                <div className="p-3.5 bg-blue-50/80 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/60 rounded-xl text-xs font-bold text-blue-900 dark:text-blue-300 space-y-1">
                  <p className="flex items-center gap-1.5 font-black text-sm">
                    <Sparkles className="w-4 h-4 text-blue-600" />
                    المعادلة الرياضية للتفكيك:
                  </p>
                  <p>
                    1 {units[units.length - 1].unit_name} = {units[units.length - 1].qty_in_parent} {units[units.length - 2].unit_name} (يعتمد النظام تلقائياً على معامل التحويل في قيود الصرف والبيع).
                  </p>
                </div>
              )}

              {!allowDecimal && (
                <Button type="button" variant="outline" onClick={addUnit} className="w-full h-12 border-slate-300 dark:border-slate-700 font-bold cursor-pointer">
                  <Plus className="ml-2 h-4 w-4" />
                  إضافة مستوى تعبئة وتجزئة أعلى (شكارة / كرتونة / باكت / دستة)
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
                    <Label className="text-slate-900 dark:text-white font-bold text-sm mb-2 block">الرصيد الافتتاحي (بـ {units[0]?.unit_name || 'الوحدة الأساسية'})</Label>
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
                التسعير المالي {allowDecimal ? '(سعر الكيلوجرام)' : `(سعر الـ ${units[0]?.unit_name || 'قطعة'})`}
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
            <CardHeader className="border-b border-slate-100 dark:border-slate-800/80 pb-4 flex flex-row items-center justify-between">
              <CardTitle className="text-lg font-black text-slate-900 dark:text-white">الباركود الدولي والتلقائي</CardTitle>
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
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm" 
                    title="توليد باركود تلقائي مطابق للمواصفات الدولية EAN-13" 
                    onClick={() => {
                      const newBarcodes = [...barcodes]
                      newBarcodes[index].barcode = generateBarcode()
                      setBarcodes(newBarcodes)
                      toast.success('تم توليد باركود تلقائي بنجاح')
                    }}
                    className="h-12 px-3 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:text-blue-600 hover:border-blue-500 cursor-pointer shrink-0 font-bold text-xs"
                  >
                    <Wand2 className="w-4 h-4 ml-1 text-blue-600" />
                    توليد
                  </Button>
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

      {/* Clean In-Flow Bottom Action Bar */}
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
