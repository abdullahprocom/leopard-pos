'use client'

import React, { useState, useEffect, useRef, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, getDeviceId } from '@/lib/db'
import { generateSaleNumber, cleanPositiveQuantity, cleanPositivePrice, cleanPositiveDiscount, money, formatCurrency } from '@/lib/finance'
import { syncEngine, DEFAULT_STORE_UUID, DEFAULT_BRANCH_UUID } from '@/lib/sync-engine'
import { useStore } from '@/lib/store-context'
import { useAuth } from '@/lib/auth-context'
import { toast } from 'sonner'
import { 
  Search, 
  Plus, 
  Minus, 
  Trash2, 
  ShoppingCart, 
  CreditCard, 
  Banknote, 
  X, 
  CheckCircle2, 
  User, 
  Sparkles, 
  Printer, 
  RotateCcw, 
  Scale, 
  Tag, 
  ChevronDown,
  Home,
  Sun,
  Moon,
  Bell,
  Headphones,
  Calendar,
  Layers,
  Calculator,
  Receipt,
  FileSpreadsheet,
  Undo2,
  Clock,
  ArrowRightLeft,
  DollarSign,
  Building2,
  Info,
  LogOut,
  ShoppingBag
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { WeightScaleModal } from '@/components/WeightScaleModal'
import { CalculatorModal } from '@/components/calculator-modal'
import { ThermalReceipt } from './receipt'
import type { Sale, SaleLine, CashTransaction, Customer, Item, PaymentStatus, PaymentMethod } from '@/lib/types'

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
  const router = useRouter()
  const { storeName, storeId, branchId } = useStore()
  const { currentUser, logout } = useAuth()

  const [searchTerm, setSearchTerm] = useState('')
  const [cart, setCart] = useState<CartItem[]>([])
  const [customerMode, setCustomerMode] = useState<'cash' | 'customer' | 'supplier'>('cash')
  const [customerName, setCustomerName] = useState('عميل نقدي')
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null)
  const [priceCategory, setPriceCategory] = useState<'default' | 'wholesale' | 'retail'>('default')
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'credit' | 'split'>('cash')
  const [paidAmount, setPaidAmount] = useState<string>('')
  const [lastSale, setLastSale] = useState<any>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [selectedCatId, setSelectedCatId] = useState<string>('all')
  const [showQuickItems, setShowQuickItems] = useState(false)

  // Modals state
  const [scaleModalOpen, setScaleModalOpen] = useState(false)
  const [scaleItem, setScaleItem] = useState<any>(null)
  const [calculatorOpen, setCalculatorOpen] = useState(false)
  const [inquiryModalOpen, setInquiryModalOpen] = useState(false)
  const [inquiryQuery, setInquiryQuery] = useState('')
  const [expenseModalOpen, setExpenseModalOpen] = useState(false)
  const [expenseAmount, setExpenseAmount] = useState('')
  const [expenseNote, setExpenseNote] = useState('')
  const [suspendedCarts, setSuspendedCarts] = useState<{ id: string; name: string; date: string; cart: CartItem[] }[]>([])
  const [suspendedModalOpen, setSuspendedModalOpen] = useState(false)
  const [recentSalesModalOpen, setRecentSalesModalOpen] = useState(false)
  const [shiftModalOpen, setShiftModalOpen] = useState(false)

  const searchInputRef = useRef<HTMLInputElement>(null)
  const currentStoreId = storeId || DEFAULT_STORE_UUID

  // Live queries
  const allItems = useLiveQuery(
    () => db.items.where('store_id').equals(currentStoreId).filter(i => i.status === 'active').toArray(),
    [currentStoreId]
  ) || []
  const allCategories = useLiveQuery(
    () => db.categories.where('store_id').equals(currentStoreId).sortBy('sort_order'),
    [currentStoreId]
  ) || []
  const allCustomers = useLiveQuery(
    () => db.customers.where('store_id').equals(currentStoreId).toArray(),
    [currentStoreId]
  ) || []
  const recentSalesList = useLiveQuery(
    () => db.sales.where('store_id').equals(currentStoreId).reverse().limit(10).toArray(),
    [currentStoreId]
  ) || []

  // Focus search input on load & listen for F-keys shortcuts
  useEffect(() => {
    if (searchInputRef.current) {
      searchInputRef.current.focus()
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault()
        if (searchInputRef.current) searchInputRef.current.focus()
      } else if (e.key === 'F3') {
        e.preventDefault()
        setInquiryModalOpen(true)
      } else if (e.key === 'F4') {
        e.preventDefault()
        setCalculatorOpen(prev => !prev)
      } else if (e.key === 'F9') {
        e.preventDefault()
        handleCompleteSale('split')
      } else if (e.key === 'F10') {
        e.preventDefault()
        handleCompleteSale('cash')
      } else if (e.key === 'F12' || e.key === 'Escape') {
        e.preventDefault()
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

      // 1. Search in item_barcodes
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
      setScaleItem(item)
      setScaleModalOpen(true)
    } else {
      addToCart(item, 1)
    }
  }

  const addToCart = (item: any, quantity: number = 1, unitLabel?: string, overridePrice?: number) => {
    const rawPrice = overridePrice !== undefined && overridePrice > 0 
      ? overridePrice 
      : cleanPositivePrice(priceCategory === 'wholesale' && item.wholesale_price ? item.wholesale_price : (item.sell_price || item.unit_price || 0))
    
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
        unit_price: rawPrice,
        discount: 0,
        total: money(validQty * rawPrice),
        allow_decimal: allowDec
      }]
    })
    toast.success(`تمت إضافة: ${item.name}`, { duration: 1200 })
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
    toast.success(`تم إدراج الوزن: ${validKg} كجم`)
  }

  const updateQuantity = (id: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        const newQty = cleanPositiveQuantity(item.quantity + delta, item.allow_decimal)
        if (newQty <= 0) return null
        return {
          ...item,
          quantity: newQty,
          total: money(newQty * item.unit_price - item.discount)
        }
      }
      return item
    }).filter(Boolean) as CartItem[])
  }

  const removeFromCart = (id: string) => {
    setCart(prev => prev.filter(item => item.id !== id))
    toast.info('تم حذف الصنف من السلة')
  }

  const clearCart = () => {
    if (cart.length > 0) {
      setCart([])
      setPaidAmount('')
      toast.info('تم تفريغ السلة')
    }
  }

  // Hold / Suspend cart
  const handleHoldCart = () => {
    if (cart.length === 0) {
      toast.error('السلة فارغة، لا يمكن تعليقها')
      return
    }
    const suspended = {
      id: crypto.randomUUID(),
      name: `${customerName} (${cart.length} أصناف)`,
      date: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
      cart: [...cart]
    }
    setSuspendedCarts(prev => [suspended, ...prev])
    setCart([])
    toast.success('تم تعليق الفاتورة بنجاح')
  }

  const handleResumeCart = (item: typeof suspendedCarts[0]) => {
    setCart(item.cart)
    setSuspendedCarts(prev => prev.filter(s => s.id !== item.id))
    setSuspendedModalOpen(false)
    toast.success(`تم استرجاع سلة: ${item.name}`)
  }

  // Quick expense creation
  const handleSaveExpense = async (e: React.FormEvent) => {
    e.preventDefault()
    const num = cleanPositivePrice(parseFloat(expenseAmount))
    if (num <= 0) {
      toast.error('يرجى إدخال مبلغ صحيح للمصروف')
      return
    }
    const tx: CashTransaction = {
      id: crypto.randomUUID(),
      store_id: currentStoreId,
      branch_id: branchId || DEFAULT_BRANCH_UUID,
      type: 'expense',
      transaction_type: 'expense_out',
      amount: num,
      payment_method: 'cash',
      notes: expenseNote.trim() || 'مصروف نقطة البيع',
      created_at: new Date().toISOString(),
    }
    await db.cash_transactions.add(tx)
    setExpenseAmount('')
    setExpenseNote('')
    setExpenseModalOpen(false)
    toast.success(`تم تسجيل مصروف بقيمة ${num.toFixed(2)} ج.م في الخزينة`)
  }

  // Calculations
  const subtotal = money(cart.reduce((acc, item) => acc + (item.quantity * item.unit_price), 0))
  const totalDiscount = money(cart.reduce((acc, item) => acc + item.discount, 0))
  const finalTotal = Math.max(0, money(subtotal - totalDiscount))
  const totalItemsCount = cart.reduce((acc, item) => acc + (item.allow_decimal ? 1 : item.quantity), 0)

  // Complete checkout
  const handleCompleteSale = async (method: 'cash' | 'card' | 'credit' | 'split' = paymentMethod) => {
    if (cart.length === 0) {
      toast.error('السلة فارغة! يرجى إضافة أصناف أولاً')
      return
    }

    try {
      setIsProcessing(true)
      const saleId = crypto.randomUUID()
      const invoiceNumber = generateSaleNumber()
      const now = new Date().toISOString()
      const deviceId = getDeviceId()

      const isCredit = method === 'credit'
      const parsedPaid = isCredit ? 0 : finalTotal
      const paymentStatus: PaymentStatus = isCredit ? 'unpaid' : 'paid'
      const pMethod: PaymentMethod = method === 'card' ? 'card' : 'cash'

      const saleRecord: Sale = {
        id: saleId,
        store_id: currentStoreId,
        branch_id: branchId || DEFAULT_BRANCH_UUID,
        invoice_number: invoiceNumber,
        customer_id: selectedCustomerId || undefined,
        customer_name: customerName || 'عميل نقدي',
        subtotal,
        discount_total: totalDiscount,
        tax_total: 0,
        round_diff: 0,
        total: finalTotal,
        paid_amount: parsedPaid,
        change_amount: 0,
        due_amount: Math.max(0, money(finalTotal - parsedPaid)),
        payment_method: pMethod,
        payment_status: paymentStatus,
        status: 'invoice',
        created_by: currentUser?.id || 'cashier',
        device_id: deviceId,
        sale_date: now,
        created_at: now,
        updated_at: now
      }

      const saleLines: SaleLine[] = cart.map(item => ({
        id: crypto.randomUUID(),
        store_id: currentStoreId,
        sale_id: saleId,
        item_id: item.item_id,
        item_name: item.name,
        quantity: item.quantity,
        unit_price: item.unit_price,
        cost_price: 0,
        discount: item.discount,
        tax: 0,
        net_total: item.total,
      }))

      await db.transaction('rw', [db.sales, db.sale_lines, db.cash_transactions, db.stock_ledger], async () => {
        await db.sales.add(saleRecord)
        await db.sale_lines.bulkAdd(saleLines)

        if (parsedPaid > 0) {
          const cashTx: CashTransaction = {
            id: crypto.randomUUID(),
            store_id: currentStoreId,
            branch_id: branchId || DEFAULT_BRANCH_UUID,
            type: 'sale',
            transaction_type: 'sale_in',
            amount: parsedPaid,
            payment_method: pMethod,
            notes: `تحصيل فاتورة مبيعات رقم ${invoiceNumber}`,
            reference_type: 'sale',
            reference_id: saleId,
            created_at: now
          }
          await db.cash_transactions.add(cashTx)
        }
      })

      setLastSale({
        ...saleRecord,
        lines: cart.map(c => ({ name: c.name, quantity: c.quantity, unitPrice: c.unit_price, total: c.total }))
      })

      toast.success(`تم حفظ الفاتورة بنجاح: ${invoiceNumber}`)
      setCart([])
      setPaidAmount('')

    } catch (err: any) {
      console.error('POS Error:', err)
      toast.error('حدث خطأ أثناء حفظ الفاتورة: ' + err.message)
    } finally {
      setIsProcessing(false)
    }
  }

  const quickItems = useMemo(() => {
    if (selectedCatId === 'all') return allItems.slice(0, 24)
    return allItems.filter(i => i.category_id === selectedCatId).slice(0, 24)
  }, [allItems, selectedCatId])

  const filteredInquiryItems = useMemo(() => {
    if (!inquiryQuery.trim()) return allItems.slice(0, 15)
    const q = inquiryQuery.trim().toLowerCase()
    return allItems.filter(i => 
      (i.name || '').toLowerCase().includes(q) || 
      (i.sku || '').toLowerCase().includes(q) || 
      (i.search_text || '').toLowerCase().includes(q)
    ).slice(0, 20)
  }, [allItems, inquiryQuery])

  const todayDateFormatted = new Date().toLocaleDateString('ar-EG', { year: 'numeric', month: '2-digit', day: '2-digit' })

  return (
    <div className="min-h-screen bg-[#070d18] text-white flex flex-col justify-between select-none" dir="rtl">
      
      {/* ─── 1. TOP HEADER & MULTI-ACTION TOOLBAR (Matches Image 1) ─── */}
      <div className="bg-[#0b1528] border-b border-slate-800 px-5 py-3 flex flex-col gap-3 shadow-lg">
        
        {/* Row 1: App Controls + Navigation */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          
          {/* Right: Home Button & POS Title */}
          <div className="flex items-center gap-3.5">
            <Link
              href="/dashboard"
              className="w-11 h-11 rounded-2xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white flex items-center justify-center shadow-lg shadow-blue-600/30 transition-all cursor-pointer hover:scale-105 active:scale-95"
              title="العودة للرئيسية"
            >
              <Home className="w-6 h-6" />
            </Link>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                نقطة البيع (الكاشير)
              </h1>
            </div>
          </div>

          {/* Center: Action Buttons Row 1 (Solid Colored Pills - Enriched Size & Weight) */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              type="button"
              onClick={() => setExpenseModalOpen(true)}
              className="px-4 py-2 rounded-xl bg-[#e11d48] hover:bg-[#be123c] text-white text-xs sm:text-sm font-black flex items-center gap-2 shadow-md transition-all active:scale-95 cursor-pointer"
            >
              <Receipt className="w-4 h-4" />
              <span>إضافة مصروفات</span>
            </button>

            <button
              type="button"
              onClick={() => setInquiryModalOpen(true)}
              className="px-4 py-2 rounded-xl bg-[#7c3aed] hover:bg-[#6d28d9] text-white text-xs sm:text-sm font-black flex items-center gap-2 shadow-md transition-all active:scale-95 cursor-pointer"
            >
              <Info className="w-4 h-4" />
              <span>استعلام أصناف (F3)</span>
            </button>

            <button
              type="button"
              onClick={() => setShowQuickItems(!showQuickItems)}
              className={`px-4 py-2 rounded-xl text-white text-xs sm:text-sm font-black flex items-center gap-2 shadow-md transition-all active:scale-95 cursor-pointer ${
                showQuickItems ? 'bg-amber-600 ring-2 ring-amber-400' : 'bg-[#d97706] hover:bg-[#b45309]'
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>أصناف سريعة</span>
            </button>

            <button
              type="button"
              onClick={() => setRecentSalesModalOpen(true)}
              className="px-4 py-2 rounded-xl bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-xs sm:text-sm font-black flex items-center gap-2 shadow-md transition-all active:scale-95 cursor-pointer"
            >
              <Clock className="w-4 h-4" />
              <span>آخر العمليات</span>
            </button>

            <button
              type="button"
              onClick={() => setSuspendedModalOpen(true)}
              className="px-4 py-2 rounded-xl bg-[#0d9488] hover:bg-[#0f766e] text-white text-xs sm:text-sm font-black flex items-center gap-2 shadow-md transition-all active:scale-95 cursor-pointer relative"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>مبيعات معلقة</span>
              {suspendedCarts.length > 0 && (
                <span className="w-5 h-5 rounded-full bg-rose-500 text-white text-xs font-black flex items-center justify-center -mr-1 animate-pulse">
                  {suspendedCarts.length}
                </span>
              )}
            </button>

            <Link
              href="/dashboard/sales-returns"
              className="px-4 py-2 rounded-xl bg-[#059669] hover:bg-[#047857] text-white text-xs sm:text-sm font-black flex items-center gap-2 shadow-md transition-all active:scale-95 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>مرتجع مبيعات</span>
            </Link>

            <Link
              href="/dashboard/purchase-returns"
              className="px-4 py-2 rounded-xl bg-[#ea580c] hover:bg-[#c2410c] text-white text-xs sm:text-sm font-black flex items-center gap-2 shadow-md transition-all active:scale-95 cursor-pointer"
            >
              <Undo2 className="w-4 h-4" />
              <span>مرتجع مشتريات</span>
            </Link>

            <button
              type="button"
              onClick={() => setShiftModalOpen(true)}
              className="px-4 py-2 rounded-xl bg-[#db2777] hover:bg-[#be185d] text-white text-xs sm:text-sm font-black flex items-center gap-2 shadow-md transition-all active:scale-95 cursor-pointer"
            >
              <Receipt className="w-4 h-4" />
              <span>تفاصيل الجلسة</span>
            </button>
          </div>

          {/* Left: System Badges and Quick Shortcuts */}
          <div className="flex items-center gap-3">
            <div className="bg-slate-800/90 border border-slate-700 rounded-xl px-3 py-2 flex items-center gap-2 text-xs sm:text-sm font-mono text-slate-200 font-black shadow-xs">
              <Calendar className="w-4 h-4 text-blue-400" />
              <span>{todayDateFormatted}</span>
            </div>

            <button
              type="button"
              onClick={() => setCalculatorOpen(true)}
              className="w-10 h-10 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 flex items-center justify-center cursor-pointer transition-all hover:scale-105 active:scale-95 shadow-xs"
              title="آلة حاسبة (F4)"
            >
              <Calculator className="w-5 h-5 text-cyan-400" />
            </button>

            <div className="bg-emerald-950/80 border border-emerald-700 text-emerald-400 text-xs font-black px-3 py-1.5 rounded-full flex items-center gap-2 shadow-xs">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>متصل</span>
            </div>

            {/* User Badge */}
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-700 to-indigo-600 text-white font-black text-base flex items-center justify-center ring-2 ring-blue-400/50 shadow-md">
              {currentUser?.name ? currentUser.name.charAt(0) : 'ع'}
            </div>
          </div>

        </div>

        {/* Row 2: Secondary Quick Actions Mini Row */}
        <div className="flex items-center justify-end gap-2.5 pt-1.5 border-t border-slate-800">
          <button
            type="button"
            onClick={() => toast.info('شاشة تحصيل مديونية عميل')}
            className="px-3.5 py-1.5 rounded-lg bg-[#10b981] hover:bg-[#059669] text-white text-xs font-black flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Banknote className="w-3.5 h-3.5" />
            <span>تحصيل عميل</span>
          </button>

          <button
            type="button"
            onClick={() => toast.info('شاشة سداد دفعة لمورد')}
            className="px-3.5 py-1.5 rounded-lg bg-[#f43f5e] hover:bg-[#e11d48] text-white text-xs font-black flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>دفع لمورد</span>
          </button>

          <button
            type="button"
            onClick={() => setShiftModalOpen(true)}
            className="px-3.5 py-1.5 rounded-lg bg-[#ef4444] hover:bg-[#dc2626] text-white text-xs font-black flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>إغلاق الوردية</span>
          </button>
        </div>

      </div>

      {/* ─── 2. SEARCH & CUSTOMER BAR (Matches Image 1) ─── */}
      <div className="bg-[#0b1528] border-b border-slate-800 px-5 py-3.5 flex items-center justify-between gap-4 flex-wrap shadow-sm">
        
        {/* Left/Center: Search Bar with Clear & Counter */}
        <div className="flex-1 min-w-[320px] max-w-3xl relative">
          <Input
            ref={searchInputRef}
            placeholder="ابحث هنا... [F2]"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            className="h-13 bg-[#13223d] border-slate-700 text-white rounded-2xl pr-12 pl-20 text-base font-bold placeholder:text-slate-500 focus:border-blue-500 shadow-inner"
            autoFocus
          />
          <div className="absolute right-4 top-4 text-slate-400 pointer-events-none">
            <Search className="w-5 h-5" />
          </div>
          <div className="absolute left-3 top-2.5 flex items-center gap-1.5">
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
            <span className="px-3 py-1 rounded-lg bg-blue-900/80 text-blue-200 font-mono text-sm font-black border border-blue-700/50">
              {cart.length}
            </span>
          </div>
        </div>

        {/* Price Category Dropdown */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="flex items-center gap-2 px-4 py-2.5 bg-[#13223d] border border-slate-700 rounded-2xl text-xs sm:text-sm font-black text-slate-200">
              <Tag className="w-4 h-4 text-blue-400" />
              <span className="text-slate-400 font-normal">فئة السعر:</span>
              <select
                value={priceCategory}
                onChange={e => setPriceCategory(e.target.value as any)}
                className="bg-transparent text-white font-black outline-none cursor-pointer text-xs sm:text-sm"
              >
                <option value="default" className="bg-[#0b1528] text-white font-bold">الافتراضي</option>
                <option value="wholesale" className="bg-[#0b1528] text-white font-bold">جملة</option>
                <option value="retail" className="bg-[#0b1528] text-white font-bold">قطاعي</option>
              </select>
            </div>
            <span className="absolute -top-2 left-3 text-[9px] bg-slate-800 text-blue-300 px-1.5 py-0.5 rounded font-mono font-bold border border-slate-700">
              F2
            </span>
          </div>

          {/* Customer / Supplier Mode Buttons */}
          <div className="flex items-center bg-[#13223d] border border-slate-700 p-1.5 rounded-2xl gap-1.5 shadow-inner">
            <button
              type="button"
              onClick={() => {
                setCustomerMode('cash')
                setCustomerName('عميل نقدي')
                setSelectedCustomerId(null)
              }}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-black flex items-center gap-1.5 transition-all cursor-pointer ${
                customerMode === 'cash' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
              }`}
            >
              <User className="w-4 h-4" />
              <span>نقدي</span>
            </button>

            <button
              type="button"
              onClick={() => {
                const name = prompt('أدخل اسم العميل:')
                if (name && name.trim()) {
                  setCustomerMode('customer')
                  setCustomerName(name.trim())
                }
              }}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-black flex items-center gap-1.5 transition-all cursor-pointer ${
                customerMode === 'customer' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
              }`}
            >
              <User className="w-4 h-4" />
              <span>{customerMode === 'customer' ? customerName : 'العملاء'}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                const sName = prompt('أدخل اسم المورد:')
                if (sName && sName.trim()) {
                  setCustomerMode('supplier')
                  setCustomerName(sName.trim())
                }
              }}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-black flex items-center gap-1.5 transition-all cursor-pointer ${
                customerMode === 'supplier' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Building2 className="w-4 h-4" />
              <span>{customerMode === 'supplier' ? customerName : 'مورد'}</span>
            </button>
          </div>
        </div>

      </div>

      {/* ─── 3. QUICK ITEMS GALLERY (Toggleable) ─── */}
      {showQuickItems && (
        <div className="bg-[#0b1528] border-b border-slate-800 p-4 space-y-3">
          <div className="flex items-center gap-2 overflow-x-auto pb-1.5 custom-scrollbar-horizontal">
            <button
              type="button"
              onClick={() => setSelectedCatId('all')}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-black shrink-0 transition-colors ${
                selectedCatId === 'all' ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              الكل ({allItems.length})
            </button>
            {allCategories.map(c => (
              <button
                key={c.id}
                type="button"
                onClick={() => setSelectedCatId(c.id)}
                className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-black shrink-0 transition-colors ${
                  selectedCatId === c.id ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2.5 max-h-44 overflow-y-auto p-1">
            {quickItems.map(item => (
              <button
                key={item.id}
                type="button"
                onClick={() => handleItemClick(item)}
                className="p-3 rounded-2xl bg-[#13223d] hover:bg-blue-900/40 border border-slate-700 text-right flex flex-col justify-between gap-1.5 transition-all cursor-pointer active:scale-95 shadow-xs"
              >
                <p className="text-xs sm:text-sm font-black text-white truncate w-full">{item.name}</p>
                <span className="text-xs sm:text-sm font-black text-emerald-400 font-mono" dir="ltr">
                  {cleanPositivePrice(item.sell_price).toFixed(2)} ج.م
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ─── 4. MAIN CART DISPLAY / EMPTY BAG ILLUSTRATION (Matches Image 1) ─── */}
      <div className="flex-1 flex flex-col p-5 overflow-y-auto min-h-[340px]">
        {cart.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-500 space-y-5 my-auto">
            <div className="w-28 h-28 rounded-3xl bg-[#0e1b33] border border-slate-800/80 flex items-center justify-center text-slate-500 shadow-2xl">
              <ShoppingBag className="w-14 h-14 stroke-1 text-slate-400 opacity-60" />
            </div>
            <p className="text-xl sm:text-2xl font-black text-slate-300 tracking-wide">
              السلة فارغة، ابدأ بإضافة المنتجات
            </p>
          </div>
        ) : (
          <div className="bg-[#0b1528] rounded-2xl border border-slate-800 overflow-hidden shadow-2xl">
            <table className="w-full text-right text-sm sm:text-base">
              <thead>
                <tr className="bg-[#13223d] border-b border-slate-800 text-xs sm:text-sm font-black text-slate-300">
                  <th className="p-4">الصنف</th>
                  <th className="p-4 text-center">السعر</th>
                  <th className="p-4 text-center w-56">الكمية</th>
                  <th className="p-4 text-center">الإجمالي</th>
                  <th className="p-4 text-center w-14">حذف</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80 font-black">
                {cart.map(item => (
                  <tr key={item.id} className="hover:bg-slate-800/50 transition-colors">
                    <td className="p-4">
                      <p className="text-white font-black text-base sm:text-lg">{item.name}</p>
                      {item.allow_decimal && (
                        <span className="text-xs text-blue-400 font-bold">
                          وزن: {Math.round(item.quantity * 1000)} جرام
                        </span>
                      )}
                    </td>
                    <td className="p-4 text-center font-mono text-slate-200 text-base" dir="ltr">
                      {item.unit_price.toFixed(2)}
                    </td>
                    <td className="p-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.id, -1)}
                          className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 text-white flex items-center justify-center cursor-pointer active:scale-95"
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                        <span className="font-mono font-black text-base px-3 text-white">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.id, 1)}
                          className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 text-white flex items-center justify-center cursor-pointer active:scale-95"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                    <td className="p-4 text-center font-mono font-black text-emerald-400 text-lg" dir="ltr">
                      {item.total.toFixed(2)}
                    </td>
                    <td className="p-4 text-center">
                      <button
                        type="button"
                        onClick={() => removeFromCart(item.id)}
                        className="w-9 h-9 rounded-xl hover:bg-rose-950/60 text-slate-500 hover:text-rose-400 flex items-center justify-center transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ─── 5. FIXED BOTTOM SUMMARY & CHECKOUT ACTIONS (Matches Image 1) ─── */}
      <div className="bg-[#0b1528] border-t border-slate-800 p-5 space-y-4 shadow-2xl">
        
        {/* Row 1: Figures & Summary Labels */}
        <div className="flex items-center justify-between flex-wrap gap-4 px-2 border-b border-slate-800/80 pb-3.5">
          
          {/* Left: Final Net Amount (Large Bold Glowing) */}
          <div className="flex items-baseline gap-3">
            <span className="text-sm font-black text-slate-400">الصافي النهائي:</span>
            <span className="text-4xl sm:text-5xl font-black text-emerald-400 font-mono tracking-tight" dir="ltr">
              {finalTotal.toFixed(2)} <span className="text-base sm:text-lg font-bold">ج.م</span>
            </span>
          </div>

          {/* Center/Right: Subtotal, Discounts, and Items count */}
          <div className="flex items-center gap-8 flex-wrap text-sm sm:text-base font-black">
            <div className="flex items-center gap-2 text-slate-300">
              <span className="text-xs sm:text-sm text-slate-400 font-bold">إجمالي الخصومات:</span>
              <span className="font-mono text-amber-400 font-black text-base" dir="ltr">{totalDiscount.toFixed(2)} ج.م</span>
            </div>

            <div className="flex items-center gap-2 text-slate-300">
              <span className="text-xs sm:text-sm text-slate-400 font-bold">الإجمالي قبل الخصم:</span>
              <span className="font-mono text-white font-black text-base" dir="ltr">{subtotal.toFixed(2)} ج.م</span>
            </div>

            <div className="flex items-center gap-2 text-slate-300">
              <span className="text-xs sm:text-sm text-slate-400 font-bold">الأصناف:</span>
              <span className="font-mono text-white text-lg font-black">{totalItemsCount}</span>
            </div>
          </div>

        </div>

        {/* Row 2: Bottom Action Checkout Buttons (Matches Image 1) */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          
          {/* Left Sub Actions */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              type="button"
              onClick={handleHoldCart}
              className="px-5 py-3 rounded-2xl bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-xs sm:text-sm font-black flex items-center gap-2 shadow-md transition-all active:scale-95 cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>مسودة</span>
            </button>

            <Link
              href="/dashboard/quotations"
              className="px-5 py-3 rounded-2xl bg-[#f59e0b] hover:bg-[#d97706] text-white text-xs sm:text-sm font-black flex items-center gap-2 shadow-md transition-all active:scale-95 cursor-pointer"
            >
              <Receipt className="w-4 h-4" />
              <span>عرض سعر</span>
            </Link>

            <button
              type="button"
              disabled={cart.length === 0}
              onClick={() => router.push('/dashboard/sales-returns')}
              className="px-5 py-3 rounded-2xl bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 text-xs sm:text-sm font-black flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
            >
              <RotateCcw className="w-4 h-4" />
              <span>مرتجع</span>
            </button>
          </div>

          {/* Right Main Payment Checkout Buttons */}
          <div className="flex items-center gap-3 flex-wrap">
            
            {/* Credit Sale */}
            <button
              type="button"
              disabled={isProcessing || cart.length === 0}
              onClick={() => handleCompleteSale('credit')}
              className="px-6 py-3 rounded-2xl bg-[#8b5cf6] hover:bg-[#7c3aed] text-white text-sm sm:text-base font-black flex items-center gap-2 shadow-lg shadow-purple-600/20 transition-all active:scale-95 cursor-pointer disabled:opacity-50"
            >
              <CreditCard className="w-5 h-5" />
              <span>بيع آجل</span>
            </button>

            {/* Split / Card Payment */}
            <button
              type="button"
              disabled={isProcessing || cart.length === 0}
              onClick={() => handleCompleteSale('split')}
              className="px-6 py-3 rounded-2xl bg-[#334155] hover:bg-[#475569] text-white text-sm sm:text-base font-black flex items-center gap-2 shadow-md transition-all active:scale-95 cursor-pointer disabled:opacity-50"
            >
              <ArrowRightLeft className="w-5 h-5" />
              <span>دفع مختلط (F9)</span>
            </button>

            {/* Cash Payment (Prominent Emerald Button - Large & High Impact) */}
            <button
              type="button"
              disabled={isProcessing || cart.length === 0}
              onClick={() => handleCompleteSale('cash')}
              className="px-10 py-3.5 rounded-2xl bg-[#10b981] hover:bg-[#059669] text-white text-base sm:text-lg font-black flex items-center gap-2.5 shadow-2xl shadow-emerald-600/40 transition-all hover:scale-105 active:scale-95 cursor-pointer disabled:opacity-50"
            >
              <Banknote className="w-6 h-6" />
              <span>دفع نقدي (F10)</span>
            </button>

            {/* Cancel Sale */}
            <button
              type="button"
              disabled={cart.length === 0}
              onClick={clearCart}
              className="px-5 py-3 rounded-2xl bg-[#ef4444] hover:bg-[#dc2626] text-white text-xs sm:text-sm font-black flex items-center gap-2 shadow-md transition-all active:scale-95 cursor-pointer disabled:opacity-50"
            >
              <X className="w-4 h-4" />
              <span>إلغاء (F12)</span>
            </button>

          </div>

        </div>

      </div>

      {/* ─── 6. MODALS & SUB-WIDGETS ─── */}
      {/* Item Inquiry Modal (F3) */}
      {inquiryModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0b1528] border border-slate-700 rounded-3xl p-6 w-full max-w-2xl shadow-2xl space-y-4 text-right">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-lg font-black text-white flex items-center gap-2">
                <Search className="w-5 h-5 text-purple-400" />
                استعلام وبحث الأصناف والأسعار (F3)
              </h3>
              <button
                type="button"
                onClick={() => setInquiryModalOpen(false)}
                className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <Input
              placeholder="اكتب اسم الصنف أو كود الباركود..."
              value={inquiryQuery}
              onChange={e => setInquiryQuery(e.target.value)}
              className="h-12 bg-[#13223d] border-slate-700 text-white rounded-xl text-sm font-bold"
              autoFocus
            />

            <div className="max-h-72 overflow-y-auto divide-y divide-slate-800 border border-slate-800 rounded-xl">
              {filteredInquiryItems.map(item => (
                <div key={item.id} className="p-3 flex items-center justify-between hover:bg-slate-800/50 transition-colors">
                  <div>
                    <p className="text-sm font-bold text-white">{item.name}</p>
                    <p className="text-xs text-slate-400 font-mono">الكود: {item.sku || '—'}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-black text-emerald-400 font-mono" dir="ltr">
                      {cleanPositivePrice(item.sell_price).toFixed(2)} ج.م
                    </span>
                    <Button
                      size="sm"
                      onClick={() => {
                        handleItemClick(item)
                        setInquiryModalOpen(false)
                      }}
                      className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg cursor-pointer"
                    >
                      إضافة للسلة
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Quick Expense Modal */}
      {expenseModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <form onSubmit={handleSaveExpense} className="bg-[#0b1528] border border-slate-700 rounded-3xl p-6 w-full max-w-md shadow-2xl space-y-4 text-right">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-lg font-black text-white flex items-center gap-2">
                <Receipt className="w-5 h-5 text-rose-500" />
                تسجيل مصروف جديد من الكاشير
              </h3>
              <button
                type="button"
                onClick={() => setExpenseModalOpen(false)}
                className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-300">مبلغ المصروف (ج.م) *</Label>
              <Input
                type="number"
                step="0.01"
                required
                value={expenseAmount}
                onChange={e => setExpenseAmount(e.target.value)}
                placeholder="0.00"
                className="h-12 bg-[#13223d] border-slate-700 text-white rounded-xl text-base font-bold font-mono"
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-300">بيان المصروف / الملاحظات</Label>
              <Input
                value={expenseNote}
                onChange={e => setExpenseNote(e.target.value)}
                placeholder="مثال: فاتورة كهرباء، بوفيه، إكرامية..."
                className="h-12 bg-[#13223d] border-slate-700 text-white rounded-xl text-sm font-semibold"
              />
            </div>

            <Button
              type="submit"
              className="w-full h-12 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold cursor-pointer"
            >
              خصم وتسجيل المصروف
            </Button>
          </form>
        </div>
      )}

      {/* Suspended Carts Modal */}
      {suspendedModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0b1528] border border-slate-700 rounded-3xl p-6 w-full max-w-lg shadow-2xl space-y-4 text-right">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-lg font-black text-white flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-teal-400" />
                المبيعات المعلقة (الفواتير المحفوظة)
              </h3>
              <button
                type="button"
                onClick={() => setSuspendedModalOpen(false)}
                className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {suspendedCarts.length === 0 ? (
              <p className="text-center text-slate-400 py-8 font-bold text-sm">
                لا توجد فواتير معلقة حالياً
              </p>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {suspendedCarts.map(s => (
                  <div key={s.id} className="p-3 bg-[#13223d] border border-slate-700 rounded-xl flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold text-white">{s.name}</p>
                      <p className="text-xs text-slate-400 font-mono">{s.date}</p>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => handleResumeCart(s)}
                      className="bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-lg cursor-pointer"
                    >
                      استرجاع السلة
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Recent Sales Modal */}
      {recentSalesModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0b1528] border border-slate-700 rounded-3xl p-6 w-full max-w-2xl shadow-2xl space-y-4 text-right">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-lg font-black text-white flex items-center gap-2">
                <Clock className="w-5 h-5 text-blue-400" />
                آخر العمليات والفواتير الصادرة
              </h3>
              <button
                type="button"
                onClick={() => setRecentSalesModalOpen(false)}
                className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="max-h-80 overflow-y-auto divide-y divide-slate-800 border border-slate-800 rounded-xl">
              {recentSalesList.map(sale => (
                <div key={sale.id} className="p-3 flex items-center justify-between hover:bg-slate-800/40">
                  <div>
                    <p className="text-xs font-mono font-bold text-blue-400" dir="ltr">{sale.invoice_number}</p>
                    <p className="text-xs text-slate-300 font-bold">{sale.customer_name || 'عميل نقدي'}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-black text-emerald-400 font-mono" dir="ltr">
                      {cleanPositivePrice(sale.total).toFixed(2)} ج.م
                    </span>
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800">
                      {sale.payment_method === 'cash' ? 'نقدي' : sale.payment_method === 'card' ? 'فيزا' : 'آجل'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Shift Details Modal */}
      {shiftModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0b1528] border border-slate-700 rounded-3xl p-6 w-full max-w-md shadow-2xl space-y-4 text-right">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-lg font-black text-white flex items-center gap-2">
                <Receipt className="w-5 h-5 text-pink-500" />
                تفاصيل وردية الكاشير
              </h3>
              <button
                type="button"
                onClick={() => setShiftModalOpen(false)}
                className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 bg-[#13223d] p-4 rounded-2xl border border-slate-700 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-400 font-bold">المستخدم الحالي:</span>
                <span className="text-white font-black">{currentUser?.name || 'كاشير عام'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-bold">الفرع:</span>
                <span className="text-white font-bold">{storeName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-bold">حالة الوردية:</span>
                <span className="text-emerald-400 font-black">نشطة ومفتوحة</span>
              </div>
            </div>

            <Button
              onClick={() => {
                setShiftModalOpen(false)
                toast.success('تم إنهاء وإغلاق وردية الكاشير بنجاح')
                router.push('/dashboard')
              }}
              className="w-full h-12 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold cursor-pointer"
            >
              تأكيد إغلاق الوردية
            </Button>
          </div>
        </div>
      )}

      {/* Weight Scale Modal */}
      {scaleItem && (
        <WeightScaleModal
          isOpen={scaleModalOpen}
          onClose={() => setScaleModalOpen(false)}
          item={scaleItem}
          onConfirm={handleScaleConfirm}
        />
      )}

      {/* Calculator Modal */}
      <CalculatorModal
        isOpen={calculatorOpen}
        onClose={() => setCalculatorOpen(false)}
      />

      {/* Thermal Receipt Print Component */}
      {lastSale && (
        <div className="hidden print:block">
          <ThermalReceipt
            storeName={storeName}
            invoiceNumber={lastSale.invoice_number}
            date={lastSale.sale_date}
            customerName={lastSale.customer_name}
            items={lastSale.lines || []}
            subtotal={lastSale.subtotal}
            discount={lastSale.discount_total}
            tax={0}
            total={lastSale.total}
            paid={lastSale.paid_amount}
            change={0}
          />
        </div>
      )}

    </div>
  )
}
