'use client'

import { useState, useEffect, useRef } from 'react'
import { db, getDeviceId } from '@/lib/db'
import { generateSaleNumber, cleanPositiveQuantity, cleanPositivePrice, cleanPositiveDiscount, money, formatCurrency } from '@/lib/finance'
import { syncEngine } from '@/lib/sync-engine'
import { useStore } from '@/lib/store-context'
import { toast } from 'sonner'
import { Search, Plus, Minus, Trash2, ShoppingCart, CreditCard, Banknote, X, CheckCircle2, User, Sparkles, Printer, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ThermalReceipt } from './receipt'
import type { Sale, SaleLine, CashTransaction } from '@/lib/types'

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
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card'>('cash')
  const [paidAmount, setPaidAmount] = useState<string>('')
  const [lastSale, setLastSale] = useState<any>(null)
  const [isProcessing, setIsProcessing] = useState(false)

  const searchInputRef = useRef<HTMLInputElement>(null)

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

      // 1. Look up by barcode in item_barcodes
      const barcodeRecord = await db.item_barcodes.where('barcode').equals(query).first()
      let item = null
      if (barcodeRecord) {
        item = await db.items.get(barcodeRecord.item_id)
      }

      // 2. Or search by SKU or name
      if (!item) {
        item = await db.items.where('sku').equals(query).first()
      }
      if (!item) {
        item = await db.items.filter(i => (i.search_text || i.name).toLowerCase().includes(query)).first()
      }

      if (item) {
        addToCart(item)
        setSearchTerm('')
      } else {
        toast.error('لم يتم العثور على الصنف - تأكد من قراءة الباركود أو كتابة الاسم بشكل صحيح')
      }
    }
  }

  const addToCart = (item: any) => {
    const price = cleanPositivePrice(item.sell_price || 0)
    const allowDec = Boolean(item.allow_decimal)

    setCart(prev => {
      const existing = prev.find(i => i.item_id === item.id)
      if (existing) {
        const nextQty = cleanPositiveQuantity(existing.quantity + 1, allowDec)
        const nextTotal = money(nextQty * existing.unit_price - existing.discount)
        return prev.map(i => i.item_id === item.id 
          ? { ...i, quantity: nextQty, total: Math.max(0, nextTotal) } 
          : i
        )
      }
      return [...prev, {
        id: crypto.randomUUID(),
        item_id: item.id,
        name: item.name,
        quantity: 1,
        unit_price: price,
        discount: 0,
        total: price,
        allow_decimal: allowDec
      }]
    })
    toast.success(`تمت إضافة: ${item.name}`, { duration: 1200 })
  }

  const updateQuantity = (id: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        const newQty = cleanPositiveQuantity(item.quantity + delta, item.allow_decimal)
        const newTotal = money(newQty * item.unit_price - item.discount)
        return { ...item, quantity: newQty, total: Math.max(0, newTotal) }
      }
      return item
    }))
  }

  const handleSetDirectQuantity = (id: string, val: string) => {
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        const parsed = Math.max(0, parseFloat(val) || 0)
        const newQty = cleanPositiveQuantity(parsed, item.allow_decimal)
        const newTotal = money(newQty * item.unit_price - item.discount)
        return { ...item, quantity: newQty, total: Math.max(0, newTotal) }
      }
      return item
    }))
  }

  const updateItemDiscount = (id: string, amount: number) => {
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        const maxBase = item.quantity * item.unit_price
        const cleanDisc = cleanPositiveDiscount(amount, maxBase)
        return { ...item, discount: cleanDisc, total: Math.max(0, money(maxBase - cleanDisc)) }
      }
      return item
    }))
  }

  const removeFromCart = (id: string) => {
    setCart(prev => prev.filter(item => item.id !== id))
  }

  const clearCart = () => {
    setCart([])
    setCustomerName('عميل نقدي')
    setPaidAmount('')
    setPaymentMethod('cash')
    if (searchInputRef.current) searchInputRef.current.focus()
  }

  // Pure strict non-negative totals
  const subtotal = money(cart.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0))
  const totalDiscount = money(cart.reduce((sum, item) => sum + item.discount, 0))
  const totalAmount = Math.max(0, money(subtotal - totalDiscount))
  const parsedPaid = paidAmount !== '' ? cleanPositivePrice(paidAmount) : totalAmount
  const change = Math.max(0, money(parsedPaid - totalAmount))

  const handleCompleteSale = async () => {
    if (cart.length === 0) {
      toast.error('عربة التسوق فارغة! أضف أصنافاً أولاً')
      return
    }

    if (isProcessing) return

    try {
      setIsProcessing(true)
      const saleId = crypto.randomUUID()
      const now = new Date().toISOString()
      const saleNumber = generateSaleNumber()
      const activeStoreId = storeId || 'default-store-001'
      const activeBranchId = branchId || 'default-branch-001'
      const deviceId = getDeviceId()

      const sale: Sale = {
        id: saleId,
        store_id: activeStoreId,
        branch_id: activeBranchId,
        customer_id: undefined,
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
            const safeNewStock = stock.quantity - item.quantity
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
            amount: parsedPaid >= totalAmount ? totalAmount : parsedPaid,
            payment_method: 'cash',
            reference_type: 'sale',
            reference_id: saleId,
            notes: `تحصيل فاتورة بيع ${saleNumber}`,
            created_at: now
          }
          await db.cash_transactions.add(cashTx)
          syncEngine.enqueueOperation('cash_transactions', 'INSERT', cashTx)
        }
      })

      // Prepare receipt data
      const receiptData = {
        storeName: storeName || 'APR Supermarket',
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
        tax: 0,
        total: totalAmount,
        paid: parsedPaid,
        change
      }

      setLastSale(receiptData)
      toast.success(`تم حفظ الفاتورة ${saleNumber} بنجاح!`)
      
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
      
      {/* Top Bar: Barcode Scan & Search */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-sm flex flex-col md:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
          <Input
            ref={searchInputRef}
            placeholder="امسح الباركود بجهاز المسح أو اكتب اسم الصنف / الكود (اضغط Enter)... [F2]"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            className="pr-12 h-14 text-base font-bold bg-slate-50/80 dark:bg-slate-800/80 rounded-xl"
            autoFocus
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <div className="relative w-full md:w-64">
            <User className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="اسم العميل"
              value={customerName}
              onChange={e => setCustomerName(e.target.value)}
              className="pr-10 h-14 text-sm font-bold bg-slate-50/80 dark:bg-slate-800/80 rounded-xl"
            />
          </div>

          <Button 
            variant="outline" 
            size="icon" 
            onClick={clearCart} 
            className="h-14 w-14 rounded-xl border-slate-300 dark:border-slate-700 text-slate-500 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 shrink-0" 
            title="مسح السلة بالكامل (Esc)"
          >
            <RotateCcw className="h-5 w-5" />
          </Button>
        </div>
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
              <div className="h-full min-h-[300px] flex flex-col items-center justify-center text-slate-400 space-y-3">
                <ShoppingCart className="w-16 h-16 stroke-1 opacity-40 text-blue-500" />
                <p className="font-bold text-base">السلة فارغة، قم بمسح باركود لبدء الفاتورة</p>
                <span className="text-xs bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full font-mono">
                  اختصار لوحة المفاتيح: F2 للبحث، F9 للحفظ والطباعة
                </span>
              </div>
            ) : (
              <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800 text-xs font-extrabold text-slate-400">
                    <th className="p-3">الصنف</th>
                    <th className="p-3 text-center w-28">السعر</th>
                    <th className="p-3 text-center w-40">الكمية</th>
                    <th className="p-3 text-center w-28">الإجمالي</th>
                    <th className="p-3 text-center w-12">حذف</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-bold text-sm">
                  {cart.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="p-3">
                        <p className="text-slate-900 dark:text-white">{item.name}</p>
                        {item.allow_decimal && (
                          <span className="text-[10px] text-blue-500 font-bold">صنف ميزان (كسور كجم)</span>
                        )}
                      </td>
                      <td className="p-3 text-center font-mono font-bold text-slate-700 dark:text-slate-300">
                        {item.unit_price.toFixed(2)}
                      </td>
                      <td className="p-3 text-center">
                        <div className="inline-flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                          <button 
                            onClick={() => updateQuantity(item.id, -1)}
                            className="w-7 h-7 rounded-lg bg-white dark:bg-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600 active:scale-95 transition-all cursor-pointer"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <input 
                            type="number"
                            min="0.001"
                            step={item.allow_decimal ? "0.001" : "1"}
                            value={item.quantity}
                            onChange={(e) => handleSetDirectQuantity(item.id, e.target.value)}
                            className="w-14 text-center font-mono font-black bg-transparent text-slate-900 dark:text-white outline-none"
                          />
                          <button 
                            onClick={() => updateQuantity(item.id, 1)}
                            className="w-7 h-7 rounded-lg bg-white dark:bg-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600 active:scale-95 transition-all cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                      <td className="p-3 text-center font-mono font-black text-blue-600 dark:text-blue-400">
                        {item.total.toFixed(2)}
                      </td>
                      <td className="p-3 text-center">
                        <button 
                          onClick={() => removeFromCart(item.id)}
                          className="p-2 text-slate-400 hover:text-rose-500 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
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
                <span>نقدي (Cash)</span>
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
                <span>فيزا / كارت</span>
              </button>
            </div>

            {/* Calculation Totals */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 space-y-2.5">
              <div className="flex justify-between text-sm text-slate-600 dark:text-slate-400 font-semibold">
                <span>المجموع الفرعي:</span>
                <span className="font-mono">{subtotal.toFixed(2)} ج.م</span>
              </div>
              {totalDiscount > 0 && (
                <div className="flex justify-between text-sm text-rose-500 font-semibold">
                  <span>إجمالي الخصم:</span>
                  <span className="font-mono">-{totalDiscount.toFixed(2)} ج.م</span>
                </div>
              )}
              <div className="border-t border-slate-200 dark:border-slate-700 pt-2 flex justify-between items-center">
                <span className="text-base font-black text-slate-900 dark:text-white">المبلغ المطلوب:</span>
                <span className="text-3xl font-black text-blue-600 dark:text-blue-400 font-mono">
                  {totalAmount.toFixed(2)} <span className="text-sm font-bold">ج.م</span>
                </span>
              </div>
            </div>

            {/* Cash Paid & Change Calculator */}
            {paymentMethod === 'cash' && (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-600 dark:text-slate-300">المبلغ المدفوع من العميل:</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.5"
                    placeholder={`مثال: ${totalAmount.toFixed(0)}`}
                    value={paidAmount}
                    onChange={e => setPaidAmount(Math.max(0, parseFloat(e.target.value) || 0).toString())}
                    className="h-12 text-lg font-mono font-bold text-center bg-slate-50/80 dark:bg-slate-800/80 rounded-xl"
                  />
                </div>

                <div className="flex justify-between items-center p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                  <span className="text-xs font-bold">المتبقي للعميل (الفكة):</span>
                  <span className="text-lg font-black font-mono">{change.toFixed(2)} ج.م</span>
                </div>
              </div>
            )}
          </div>

          {/* Checkout Big Button */}
          <Button
            onClick={handleCompleteSale}
            disabled={cart.length === 0 || isProcessing}
            size="lg"
            className="w-full h-16 text-lg font-black bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-2xl shadow-xl shadow-emerald-600/30 active:scale-95 transition-all cursor-pointer"
          >
            <CheckCircle2 className="w-6 h-6 ml-2" />
            {isProcessing ? 'جاري الاعتماد والطباعة...' : `إتمام الفاتورة والطباعة (${totalAmount.toFixed(2)} ج.م)`}
          </Button>

        </div>

      </div>

      {/* Hidden Thermal Receipt for Direct Printing */}
      {lastSale && (
        <ThermalReceipt
          storeName={lastSale.storeName}
          invoiceNumber={lastSale.invoiceNumber}
          date={lastSale.date}
          customerName={lastSale.customerName}
          items={lastSale.items}
          subtotal={lastSale.subtotal}
          discount={lastSale.discount}
          tax={lastSale.tax}
          total={lastSale.total}
          paid={lastSale.paid}
          change={lastSale.change}
        />
      )}

    </div>
  )
}
