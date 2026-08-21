'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, getDeviceId } from '@/lib/db'
import { generateSaleNumber, cleanPositiveQuantity, cleanPositivePrice, cleanPositiveDiscount, money, formatCurrency } from '@/lib/finance'
import { syncEngine, DEFAULT_STORE_UUID, DEFAULT_BRANCH_UUID } from '@/lib/sync-engine'
import { useStore } from '@/lib/store-context'
import { toast } from 'sonner'
import { Search, Plus, Minus, Trash2, ShoppingCart, CreditCard, Banknote, X, CheckCircle2, User, Sparkles, Printer, RotateCcw, Scale, Weight, Tag, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { WeightScaleModal } from '@/components/WeightScaleModal'
import { ThermalReceipt } from './receipt'
import type { Sale, SaleLine, CashTransaction, Customer } from '@/lib/types'

interface CartItem {
  id: string
  item_id: string
  name: string
  quantity: number
  unit_price: number
  discount: number
  total: number
  allow_decimal?: boolean
}

export default function POSPage() {
  const { storeName, storeId, branchId } = useStore()
  const [searchTerm, setSearchTerm] = useState('')
  const [cart, setCart] = useState<CartItem[]>([])
  const [customerName, setCustomerName] = useState('عميل نقدي')
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null)
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card'>('cash')
  const [paidAmount, setPaidAmount] = useState<string>('')
  const [lastSale, setLastSale] = useState<any>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [selectedCatId, setSelectedCatId] = useState<string>('all')

  // Scale Modal State
  const [scaleModalOpen, setScaleModalOpen] = useState(false)
  const [scaleItem, setScaleItem] = useState<any>(null)

  const searchInputRef = useRef<HTMLInputElement>(null)

  // Live queries for quick product touch grid & customers
  const allItems = useLiveQuery(() => db.items.filter(i => i.status === 'active').toArray()) || []
  const allCategories = useLiveQuery(() => db.categories.toArray()) || []
  const allCustomers = useLiveQuery(() => db.customers.toArray()) || []

  // Filter items for quick grid
  const quickItems = useMemo(() => {
    if (selectedCatId === 'all') {
      return allItems.slice(0, 18)
    }
    return allItems.filter(i => i.category_id === selectedCatId).slice(0, 18)
  }, [allItems, selectedCatId])

  // Focus search input on load & listen for F-keys shortcuts
  useEffect(() => {
    if (searchInputRef.current) {
      searchInputRef.current.focus()
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault()
        if (searchInputRef.current) searchInputRef.current.focus()
      } else if (e.key === 'F9') {
        e.preventDefault()
        handleCompleteSale()
      } else if (e.key === 'Escape') {
        clearCart()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [cart, paidAmount, paymentMethod, customerName])

  const handleSearchKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && searchTerm.trim()) {
      e.preventDefault()
      const query = searchTerm.trim().toLowerCase()
      let item: any = null
      let matchedUnitName: string | undefined = undefined
      let matchedMultiplier: number = 1
      let matchedPrice: number | undefined = undefined

      // 1. Search in item_barcodes (finds both main barcodes and unit-specific packaging barcodes)
      const barcodeRecord = await db.item_barcodes.where('barcode').equals(query).first()
      if (barcodeRecord) {
        item = await db.items.get(barcodeRecord.item_id)
        if (barcodeRecord.conversion_factor && barcodeRecord.conversion_factor > 1) {
          matchedMultiplier = barcodeRecord.conversion_factor
          matchedUnitName = barcodeRecord.unit_name
          matchedPrice = barcodeRecord.price_override
        }
      }

      // 2. Or search by SKU or name
      if (!item) {
        item = await db.items.where('sku').equals(query).first()
      }
      if (!item) {
        item = await db.items.filter(i => (i.search_text || i.name || '').toLowerCase().includes(query)).first()
      }

      if (item) {
        if (matchedMultiplier > 1) {
          // Unit packaging barcode scanned (e.g. Carton or Pack)
          addToCart(item, matchedMultiplier, matchedUnitName, matchedPrice)
        } else {
          handleItemClick(item)
        }
        setSearchTerm('')
      } else {
        toast.error('لم يتم العثور على الصنف - تأكد من قراءة الباركود أو كتابة الاسم بشكل صحيح')
      }
    }
  }

  const handleItemClick = (item: any) => {
    if (item.allow_decimal) {
      // Open Smart Scale Calculator immediately for weight-based items
      setScaleItem(item)
      setScaleModalOpen(true)
    } else {
      addToCart(item, 1)
    }
  }

  const addToCart = (item: any, quantity: number = 1, unitLabel?: string, overridePrice?: number) => {
    const price = overridePrice !== undefined && overridePrice > 0 
      ? overridePrice 
      : cleanPositivePrice(item.sell_price || item.unit_price || 0)
    const allowDec = Boolean(item.allow_decimal)
    const validQty = cleanPositiveQuantity(quantity, allowDec)

    setCart(prev => {
      const existing = prev.find(i => i.item_id === item.id)
      if (existing) {
        const nextQty = allowDec 
          ? validQty 
          : cleanPositiveQuantity(existing.quantity + validQty, false)
        const nextTotal = money(nextQty * existing.unit_price - existing.discount)
        return prev.map(i => i.item_id === item.id 
          ? { ...i, quantity: nextQty, total: Math.max(0, nextTotal) } 
          : i
        )
      }
      return [...prev, {
        id: crypto.randomUUID(),
        item_id: item.id,
        name: unitLabel ? `${item.name} (${unitLabel})` : item.name,
        quantity: validQty,
        unit_price: price,
        discount: 0,
        total: money(validQty * price),
        allow_decimal: allowDec
      }]
    })
    const displayName = unitLabel ? `${item.name} [عبوة: ${unitLabel}]` : item.name
    toast.success(`تمت إضافة: ${displayName} (${validQty} ${allowDec ? 'كجم' : (item.unit || 'وحدة')})`, { duration: 1500 })
  }

  const handleOpenScaleForCartItem = (cartItem: CartItem) => {
    setScaleItem({
      id: cartItem.item_id,
      name: cartItem.name,
      sell_price: cartItem.unit_price,
      quantity: cartItem.quantity
    })
    setScaleModalOpen(true)
  }

  const handleScaleConfirm = (calculatedKg: number) => {
    if (!scaleItem) return
    const validKg = cleanPositiveQuantity(calculatedKg, true)
    const price = cleanPositivePrice(scaleItem.sell_price || scaleItem.unit_price || 0)

    setCart(prev => {
      const existing = prev.find(i => i.item_id === scaleItem.id)
      if (existing) {
        const nextTotal = money(validKg * existing.unit_price - existing.discount)
        return prev.map(i => i.item_id === scaleItem.id
          ? { ...i, quantity: validKg, total: Math.max(0, nextTotal) }
          : i
        )
      }
      return [...prev, {
        id: crypto.randomUUID(),
        item_id: scaleItem.id,
        name: scaleItem.name,
        quantity: validKg,
        unit_price: price,
        discount: 0,
        total: money(validKg * price),
        allow_decimal: true
      }]
    })

    const grams = Math.round(validKg * 1000)
    const totalCalc = money(validKg * price)
    toast.success(`تم إدراج الوزن: ${validKg} كجم (${grams} جم) بسعر ${totalCalc.toFixed(2)} ج.م`)
  }

  const updateQuantity = (id: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        const step = item.allow_decimal ? 0.250 : 1
        const newQty = cleanPositiveQuantity(item.quantity + (delta > 0 ? step : -step), item.allow_decimal)
        const newTotal = money(newQty * item.unit_price - item.discount)
        return { ...item, quantity: newQty, total: Math.max(0, newTotal) }
      }
      return item
    }))
  }

  const handleSetDirectQuantity = (id: string, rawVal: string) => {
    const item = cart.find(i => i.id === id)
    if (!item) return
    const parsed = parseFloat(rawVal)
    if (isNaN(parsed) || parsed < 0) return

    const newQty = cleanPositiveQuantity(parsed, item.allow_decimal)
    const newTotal = money(newQty * item.unit_price - item.discount)
    setCart(prev => prev.map(i => i.id === id ? { ...i, quantity: newQty, total: Math.max(0, newTotal) } : i))
  }

  const removeFromCart = (id: string) => {
    setCart(prev => prev.filter(item => item.id !== id))
  }

  const clearCart = () => {
    setCart([])
    setPaidAmount('')
    setCustomerName('عميل نقدي')
    setSelectedCustomerId(null)
  }

  // Calculations
  const subtotal = money(cart.reduce((sum, i) => sum + (i.quantity * i.unit_price), 0))
  const totalDiscount = money(cart.reduce((sum, i) => sum + i.discount, 0))
  const totalAmount = money(Math.max(0, subtotal - totalDiscount))

  const parsedPaid = paidAmount === '' ? totalAmount : Math.max(0, parseFloat(paidAmount) || 0)
  const change = Math.max(0, money(parsedPaid - totalAmount))

  // Complete and save invoice
  const handleCompleteSale = async () => {
    if (cart.length === 0) {
      toast.error('السلة فارغة، يرجى إضافة أصناف أولاً')
      return
    }

    try {
      setIsProcessing(true)
      const now = new Date().toISOString()
      const saleId = crypto.randomUUID()
      const saleNumber = generateSaleNumber()
      const activeStoreId = storeId || DEFAULT_STORE_UUID
      const activeBranchId = branchId || DEFAULT_BRANCH_UUID

      const sale: Sale = {
        id: saleId,
        store_id: activeStoreId,
        branch_id: activeBranchId,
        customer_id: selectedCustomerId || undefined,
        invoice_number: saleNumber,
        status: 'invoice',
        subtotal,
        discount_total: totalDiscount,
        tax_total: 0,
        round_diff: 0,
        total: totalAmount,
        paid_amount: parsedPaid >= totalAmount ? totalAmount : parsedPaid,
        due_amount: Math.max(0, money(totalAmount - parsedPaid)),
        change_amount: change,
        payment_method: paymentMethod,
        payment_status: parsedPaid >= totalAmount ? 'paid' : (parsedPaid > 0 ? 'partial' : 'unpaid'),
        customer_name: customerName.trim() || 'عميل نقدي',
        sale_date: now,
        created_at: now,
        updated_at: now,
      }

      await db.transaction('rw', [db.sales, db.sale_lines, db.stock_balances, db.stock_ledger, db.cash_transactions, db.sync_queue], async () => {
        await db.sales.add(sale)
        syncEngine.enqueueOperation('sales', 'INSERT', sale)

        for (const item of cart) {
          const line: SaleLine = {
            id: crypto.randomUUID(),
            store_id: activeStoreId,
            sale_id: saleId,
            item_id: item.item_id,
            item_name: item.name,
            quantity: item.quantity,
            unit_price: item.unit_price,
            cost_price: 0,
            discount: item.discount,
            tax: 0,
            net_total: item.total,
          }
          await db.sale_lines.add(line)
          syncEngine.enqueueOperation('sale_lines', 'INSERT', line)

          // Safe stock reduction
          const stock = await db.stock_balances.where({ store_id: activeStoreId, item_id: item.item_id, branch_id: activeBranchId }).first()
          if (stock) {
            const safeNewStock = Math.max(0, stock.quantity - item.quantity)
            await db.stock_balances.where({ store_id: activeStoreId, item_id: item.item_id, branch_id: activeBranchId }).modify({
              quantity: safeNewStock,
              updated_at: now
            })
          }

          // Stock ledger entry
          const ledger = {
            id: crypto.randomUUID(),
            store_id: activeStoreId,
            branch_id: activeBranchId,
            item_id: item.item_id,
            movement_type: 'sale' as const,
            direction: 'out' as const,
            quantity: item.quantity,
            unit_price: item.unit_price,
            total: item.total,
            source_table: 'sales',
            source_id: saleId,
            notes: `فاتورة بيع رقم ${saleNumber}`,
            created_at: now
          }
          await db.stock_ledger.add(ledger)
          syncEngine.enqueueOperation('stock_ledger', 'INSERT', ledger)
        }

        // Cash transaction ledger
        if (paymentMethod === 'cash' && parsedPaid > 0) {
          const cashTx: CashTransaction = {
            id: crypto.randomUUID(),
            store_id: activeStoreId,
            branch_id: activeBranchId,
            type: 'sale',
            direction: 'in',
            amount: parsedPaid >= totalAmount ? totalAmount : parsedPaid,
            payment_method: 'cash',
            source_table: 'sales',
            source_id: saleId,
            notes: `تحصيل فاتورة بيع ${saleNumber}`,
            created_at: now
          }
          await db.cash_transactions.add(cashTx)
          syncEngine.enqueueOperation('cash_transactions', 'INSERT', cashTx)
        }
      })

      // Prepare receipt data
      const receiptData = {
        storeName: storeName || 'ERP Supermarket',
        invoiceNumber: saleNumber,
        date: new Date().toLocaleString('ar-EG'),
        customerName: customerName || 'عميل نقدي',
        items: cart.map(i => ({
          name: i.name,
          quantity: i.quantity,
          unitPrice: i.unit_price,
          total: i.total
        })),
        subtotal,
        discount: totalDiscount,
        total: totalAmount,
        paid: parsedPaid,
        change,
        paymentMethod
      }

      setLastSale(receiptData)
      toast.success(`تم إتمام الفاتورة ${saleNumber} بنجاح`, {
        icon: <CheckCircle2 className="w-5 h-5 text-emerald-500" />
      })

      // Clear cart for next customer
      clearCart()

      // Auto trigger thermal print
      setTimeout(() => {
        window.print()
      }, 300)

    } catch (err: any) {
      console.error('POS Error:', err)
      toast.error('حدث خطأ أثناء حفظ الفاتورة: ' + err.message)
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="h-full flex flex-col gap-4 pb-20 select-none" dir="rtl">
      
      {/* Top Bar: Barcode Scan & Search & Customer */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-sm flex flex-col md:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
          <Input
            ref={searchInputRef}
            placeholder="امسح الباركود بجهاز المسح أو اكتب اسم الصنف / الكود (اضغط Enter)... [F2]"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            className="pr-12 h-14 text-base font-bold bg-slate-50/80 dark:bg-slate-800/80 text-slate-900 dark:text-white border-slate-300 dark:border-slate-700 rounded-xl"
            autoFocus
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          {/* Customer Selection */}
          <div className="relative w-full md:w-64">
            <User className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="اسم العميل"
              value={customerName}
              onChange={e => setCustomerName(e.target.value)}
              className="pr-10 h-14 text-sm font-bold bg-slate-50/80 dark:bg-slate-800/80 text-slate-900 dark:text-white border-slate-300 dark:border-slate-700 rounded-xl"
            />
          </div>

          <Button 
            variant="outline" 
            size="icon" 
            onClick={clearCart} 
            className="h-14 w-14 rounded-xl border-slate-300 dark:border-slate-700 text-slate-500 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 shrink-0 cursor-pointer" 
            title="مسح السلة بالكامل (Esc)"
          >
            <RotateCcw className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Quick Visual Product Touch Gallery (for Touchscreens & Fast Selection) */}
      <div className="bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-sm space-y-3">
        {/* Category Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          <button
            type="button"
            onClick={() => setSelectedCatId('all')}
            className={`px-4 py-2 rounded-xl text-xs font-black shrink-0 transition-all cursor-pointer ${
              selectedCatId === 'all'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/25'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
            }`}
          >
            جميع الأصناف ({allItems.length})
          </button>
          {allCategories.map(cat => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCatId(cat.id)}
              className={`px-4 py-2 rounded-xl text-xs font-black shrink-0 transition-all cursor-pointer ${
                selectedCatId === cat.id
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/25'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Quick Items Grid */}
        {quickItems.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5 max-h-[140px] overflow-y-auto p-1">
            {quickItems.map(item => {
              const isWeight = Boolean(item.allow_decimal)
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleItemClick(item)}
                  className="flex flex-col justify-between p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:border-blue-300 dark:hover:border-blue-700 transition-all text-right active:scale-95 cursor-pointer group"
                >
                  <p className="text-xs font-bold text-slate-900 dark:text-white truncate w-full group-hover:text-blue-600 dark:group-hover:text-blue-400">
                    {item.name}
                  </p>
                  <div className="flex items-center justify-between w-full mt-1.5 pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
                    <span className="text-xs font-black text-blue-600 dark:text-blue-400" dir="ltr">
                      {cleanPositivePrice(item.sell_price).toFixed(2)} ج.م
                    </span>
                    {isWeight && (
                      <span className="text-[10px] bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded font-bold">
                        ميزان
                      </span>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Main Grid: Cart Items (Left/Center) & Payment Terminal (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 flex-1 min-h-0">
        
        {/* Cart Table Container */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-sm flex flex-col overflow-hidden">
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2 font-black text-slate-900 dark:text-white">
              <ShoppingCart className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <span>محتويات الفاتورة الحالية ({cart.length} أصناف)</span>
            </div>
            <span className="text-xs font-mono text-slate-400 font-bold">ERP POS Terminal</span>
          </div>

          <div className="flex-1 overflow-y-auto p-2">
            {cart.length === 0 ? (
              <div className="h-full min-h-[260px] flex flex-col items-center justify-center text-slate-400 space-y-3">
                <ShoppingCart className="w-16 h-16 stroke-1 opacity-40 text-blue-500" />
                <p className="font-bold text-base text-slate-400">السلة فارغة، امسح باركود أو اضغط على صنف للإضافة</p>
                <span className="text-xs bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full font-mono text-slate-400">
                  اختصار لوحة المفاتيح: F2 للبحث، F9 للحفظ والطباعة
                </span>
              </div>
            ) : (
              <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800 text-xs font-extrabold text-slate-500 dark:text-slate-400">
                    <th className="p-3">الصنف</th>
                    <th className="p-3 text-center w-28">سعر الوحدة</th>
                    <th className="p-3 text-center w-52">الكمية / الوزن</th>
                    <th className="p-3 text-center w-28">الإجمالي</th>
                    <th className="p-3 text-center w-12">حذف</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-bold text-sm">
                  {cart.map((item) => {
                    const isWeight = Boolean(item.allow_decimal)
                    const grams = Math.round(item.quantity * 1000)

                    return (
                      <tr key={item.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="p-3">
                          <p className="text-slate-900 dark:text-white font-bold">{item.name}</p>
                          {isWeight && (
                            <span className="inline-flex items-center gap-1 text-[11px] text-blue-600 dark:text-blue-400 font-bold mt-0.5">
                              <Scale className="w-3 h-3" />
                              صنف ميزان: {item.quantity} كجم ({grams} جم)
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-center font-mono font-bold text-slate-700 dark:text-slate-200">
                          {item.unit_price.toFixed(2)} ج.م
                        </td>
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <div className="inline-flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                              <button 
                                type="button"
                                onClick={() => updateQuantity(item.id, -1)}
                                className="w-7 h-7 rounded-lg bg-white dark:bg-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600 active:scale-95 transition-all cursor-pointer"
                                title={isWeight ? "إنقاص 250 جم" : "إنقاص 1"}
                              >
                                <Minus className="w-3.5 h-3.5" />
                              </button>
                              <input 
                                type="number"
                                min="0.001"
                                step={isWeight ? "0.001" : "1"}
                                value={item.quantity}
                                onChange={(e) => handleSetDirectQuantity(item.id, e.target.value)}
                                className="w-16 text-center font-mono font-black text-sm bg-transparent text-slate-900 dark:text-white outline-none"
                              />
                              <button 
                                type="button"
                                onClick={() => updateQuantity(item.id, 1)}
                                className="w-7 h-7 rounded-lg bg-white dark:bg-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600 active:scale-95 transition-all cursor-pointer"
                                title={isWeight ? "زيادة 250 جم" : "زيادة 1"}
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            {/* Weight Scale Modal Trigger Button */}
                            {isWeight && (
                              <button
                                type="button"
                                onClick={() => handleOpenScaleForCartItem(item)}
                                className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/60 border border-blue-200 dark:border-blue-800/80 transition-colors cursor-pointer shadow-xs"
                                title="فتح حاسبة الجرامات والمبالغ (مثال: بـ 10 ج)"
                              >
                                <Scale className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="p-3 text-center font-mono font-black text-blue-600 dark:text-blue-400">
                          {item.total.toFixed(2)} ج.م
                        </td>
                        <td className="p-3 text-center">
                          <button 
                            type="button"
                            onClick={() => removeFromCart(item.id)}
                            className="p-2 text-slate-400 hover:text-rose-500 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Payment & Checkout Summary Container */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-sm flex flex-col justify-between p-6 space-y-6">
          
          <div className="space-y-4">
            <h3 className="font-black text-lg text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-3 flex items-center justify-between">
              <span>ملخص الدفع والحساب</span>
              <span className="text-xs bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded-md font-bold">F9 للإنهاء</span>
            </h3>

            {/* Payment Method Selector */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setPaymentMethod('cash')}
                className={`flex items-center justify-center gap-2 py-3 rounded-xl font-black text-sm transition-all cursor-pointer border ${
                  paymentMethod === 'cash'
                    ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-600/30'
                    : 'bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                }`}
              >
                <Banknote className="w-4 h-4" />
                <span>نقدي (كاش)</span>
              </button>
              <button
                type="button"
                onClick={() => setPaymentMethod('card')}
                className={`flex items-center justify-center gap-2 py-3 rounded-xl font-black text-sm transition-all cursor-pointer border ${
                  paymentMethod === 'card'
                    ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-600/30'
                    : 'bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                }`}
              >
                <CreditCard className="w-4 h-4" />
                <span>فيزا / بطاقة</span>
              </button>
            </div>

            {/* Amounts Summary */}
            <div className="space-y-2.5 pt-2 text-sm">
              <div className="flex justify-between text-slate-500 dark:text-slate-400 font-bold">
                <span>المجموع الفرعي:</span>
                <span className="font-mono text-slate-900 dark:text-white" dir="ltr">{subtotal.toFixed(2)} ج.م</span>
              </div>
              {totalDiscount > 0 && (
                <div className="flex justify-between text-rose-500 font-bold">
                  <span>الخصم الإجمالي:</span>
                  <span className="font-mono" dir="ltr">-{totalDiscount.toFixed(2)} ج.م</span>
                </div>
              )}
              <div className="flex justify-between text-xl font-black text-slate-900 dark:text-white border-t border-slate-100 dark:border-slate-800 pt-3">
                <span>المطلوب دفعه:</span>
                <span className="font-mono text-2xl text-blue-600 dark:text-blue-400" dir="ltr">{totalAmount.toFixed(2)} ج.م</span>
              </div>
            </div>

            {/* Paid Amount Input */}
            <div className="space-y-2 pt-2">
              <Label className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1">المبلغ المستلم من العميل</Label>
              <div className="relative">
                <Input
                  type="text"
                  inputMode="decimal"
                  placeholder={totalAmount > 0 ? totalAmount.toFixed(2) : '0.00'}
                  value={paidAmount}
                  onChange={(e) => {
                    const clean = e.target.value.replace(/[^0-9.]/g, '')
                    setPaidAmount(clean)
                  }}
                  className="h-12 pl-12 text-lg font-mono font-black bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white border-slate-300 dark:border-slate-700"
                />
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">ج.م</span>
              </div>
            </div>

            {/* Change Remaining */}
            {parsedPaid > totalAmount && totalAmount > 0 && (
              <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl flex items-center justify-between text-emerald-800 dark:text-emerald-300">
                <span className="font-bold text-sm">المتبقي للعميل (الفكة):</span>
                <span className="font-mono font-black text-xl" dir="ltr">{change.toFixed(2)} ج.م</span>
              </div>
            )}
          </div>

          {/* Complete Button */}
          <Button
            type="button"
            size="lg"
            disabled={cart.length === 0 || isProcessing}
            onClick={handleCompleteSale}
            className="w-full h-14 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-lg rounded-xl shadow-lg shadow-emerald-600/30 transition-all active:scale-98 cursor-pointer flex items-center justify-center gap-2"
          >
            {isProcessing ? (
              <span>جاري الحفظ...</span>
            ) : (
              <>
                <Printer className="w-5 h-5" />
                <span>إتمام الفاتورة والطباعة (F9)</span>
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Smart Weight Scale Modal */}
      {scaleItem && (
        <WeightScaleModal
          isOpen={scaleModalOpen}
          onClose={() => setScaleModalOpen(false)}
          item={scaleItem}
          onConfirm={handleScaleConfirm}
        />
      )}

      {/* Hidden Thermal Receipt for Print */}
      {lastSale && (
        <div className="hidden print:block">
          <ThermalReceipt
            storeName={lastSale.storeName}
            invoiceNumber={lastSale.invoiceNumber}
            date={lastSale.date}
            customerName={lastSale.customerName}
            items={lastSale.items}
            subtotal={lastSale.subtotal}
            discount={lastSale.discount}
            tax={0}
            total={lastSale.total}
            paid={lastSale.paid}
            change={lastSale.change}
          />
        </div>
      )}
    </div>
  )
}
