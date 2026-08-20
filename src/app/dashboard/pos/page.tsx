'use client'

import { useState, useEffect, useRef } from 'react'
import { db, getDeviceId } from '@/lib/db'
import { generateSaleNumber } from '@/lib/finance'
import { syncEngine } from '@/lib/sync-engine'
import { toast } from 'sonner'
import { Search, Plus, Minus, Trash2, ShoppingCart, CreditCard, Banknote, X, CheckCircle2, User, Sparkles } from 'lucide-react'
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
}

export default function POSPage() {
  const [searchTerm, setSearchTerm] = useState('')
  const [cart, setCart] = useState<CartItem[]>([])
  const [customerName, setCustomerName] = useState('عميل نقدي')
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card'>('cash')
  const [paidAmount, setPaidAmount] = useState<string>('')
  const [lastSale, setLastSale] = useState<any>(null)

  const searchInputRef = useRef<HTMLInputElement>(null)

  // Focus search input on load
  useEffect(() => {
    if (searchInputRef.current) {
      searchInputRef.current.focus()
    }
  }, [])

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
        toast.error('لم يتم العثور على الصنف')
      }
    }
  }

  const addToCart = (item: any) => {
    const price = item.sell_price || 0
    setCart(prev => {
      const existing = prev.find(i => i.item_id === item.id)
      if (existing) {
        return prev.map(i => i.item_id === item.id 
          ? { ...i, quantity: i.quantity + 1, total: (i.quantity + 1) * i.unit_price - i.discount } 
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
        total: price
      }]
    })
  }

  const updateQuantity = (id: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        const newQty = Math.max(1, item.quantity + delta)
        return { ...item, quantity: newQty, total: newQty * item.unit_price - item.discount }
      }
      return item
    }))
  }

  const updateItemDiscount = (id: string, amount: number) => {
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        const discount = Math.max(0, amount)
        return { ...item, discount, total: item.quantity * item.unit_price - discount }
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

  const subtotal = cart.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0)
  const totalDiscount = cart.reduce((sum, item) => sum + item.discount, 0)
  const totalAmount = Math.max(subtotal - totalDiscount, 0)
  const paid = paidAmount ? parseFloat(paidAmount) : totalAmount
  const change = Math.max(0, paid - totalAmount)

  const handleCompleteSale = async () => {
    if (cart.length === 0) {
      toast.error('عربة التسوق فارغة')
      return
    }

    try {
      const saleId = crypto.randomUUID()
      const now = new Date().toISOString()
      const saleNumber = generateSaleNumber()
      const storeId = 'default'
      const branchId = 'default'
      const deviceId = getDeviceId()

      const sale: Sale = {
        id: saleId,
        store_id: storeId,
        branch_id: branchId,
        customer_id: undefined,
        invoice_number: saleNumber,
        status: 'invoice',
        subtotal,
        discount_total: totalDiscount,
        tax_total: 0,
        total: totalAmount,
        paid_amount: paid > totalAmount ? totalAmount : paid,
        due_amount: 0,
        payment_method: paymentMethod,
        payment_status: 'paid',
        customer_name: customerName || 'عميل نقدي',
        sale_date: now,
        device_id: deviceId,
        created_at: now,
        updated_at: now,
      }

      await db.transaction('rw', [db.sales, db.sale_lines, db.stock_balances, db.stock_ledger, db.cash_transactions, db.sync_queue], async () => {
        await db.sales.add(sale)
        syncEngine.enqueueOperation('sales', 'INSERT', sale)

        for (const item of cart) {
          const line: SaleLine = {
            id: crypto.randomUUID(),
            store_id: storeId,
            sale_id: saleId,
            item_id: item.item_id,
            item_name: item.name,
            quantity: item.quantity,
            unit_price: item.unit_price,
            discount: item.discount,
            net_total: item.total,
          }
          await db.sale_lines.add(line)
          syncEngine.enqueueOperation('sale_lines', 'INSERT', line)

          // Update stock balance
          const stock = await db.stock_balances.where({ store_id: storeId, item_id: item.item_id, branch_id: branchId }).first()
          if (stock) {
            await db.stock_balances.where({ store_id: storeId, item_id: item.item_id, branch_id: branchId }).modify({
              quantity: stock.quantity - item.quantity,
              updated_at: now
            })
          }

          // Stock ledger
          const ledger = {
            id: crypto.randomUUID(),
            store_id: storeId,
            branch_id: branchId,
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

        // Cash transaction
        const cashTx: CashTransaction = {
          id: crypto.randomUUID(),
          store_id: storeId,
          branch_id: branchId,
          transaction_type: 'sale-payment',
          direction: 'in',
          amount: paid > totalAmount ? totalAmount : paid,
          payment_method: paymentMethod,
          account_name: 'الصندوق الرئيسي',
          source_table: 'sales',
          source_id: saleId,
          notes: `مبيعات فاتورة رقم ${saleNumber}`,
          created_at: now
        }
        await db.cash_transactions.add(cashTx)
        syncEngine.enqueueOperation('cash_transactions', 'INSERT', cashTx)
      })

      setLastSale({
        storeName: 'Leopard POS',
        invoiceNumber: saleNumber,
        date: new Date().toLocaleString('ar-SA'),
        customerName,
        items: cart.map(i => ({ name: i.name, quantity: i.quantity, unitPrice: i.unit_price, total: i.total })),
        subtotal,
        discount: totalDiscount,
        tax: 0,
        total: totalAmount,
        paid,
        change
      })

      toast.success('تم إتمام البيع بنجاح')

      setTimeout(() => {
        window.print()
        clearCart()
      }, 100)

    } catch (error: any) {
      console.error(error)
      toast.error('حدث خطأ أثناء إتمام البيع: ' + error.message)
    }
  }

  // Keyboard shortcuts (F1, F2, F9)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F1') {
        e.preventDefault()
        clearCart()
      } else if (e.key === 'F2') {
        e.preventDefault()
        searchInputRef.current?.focus()
      } else if (e.key === 'F9') {
        e.preventDefault()
        handleCompleteSale()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [cart, totalAmount, paidAmount, paymentMethod])

  return (
    <>
      <div className="h-[calc(100vh-8rem)] flex flex-col lg:flex-row gap-5 print:hidden" dir="rtl">
        {/* Left Area - Items & Cart (65%) */}
        <div className="flex-1 flex flex-col bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-sm overflow-hidden transition-colors">
          {/* Top Search Input */}
          <div className="p-4 border-b border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50">
            <div className="relative">
              <Search className="absolute right-4 top-1/2 -translate-y-1/2 h-6 w-6 text-slate-400 dark:text-slate-500 pointer-events-none" />
              <Input
                ref={searchInputRef}
                className="h-14 text-base sm:text-lg pr-13 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 rounded-2xl font-bold placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500/20 shadow-xs"
                placeholder="امسح الباركود أو ابحث بالاسم... (اضغط Enter)"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={handleSearchKeyDown}
              />
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-mono font-bold bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 px-2 py-1 rounded-md hidden sm:block">
                F2
              </span>
            </div>
          </div>

          {/* Cart Table */}
          <div className="flex-1 overflow-y-auto">
            <table className="w-full text-sm text-right border-collapse">
              <thead className="bg-slate-50/90 dark:bg-slate-800/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-extrabold text-xs sticky top-0 z-10">
                <tr>
                  <th className="py-3.5 px-5">الصنف</th>
                  <th className="py-3.5 px-5 w-28">السعر</th>
                  <th className="py-3.5 px-5 w-36 text-center">الكمية</th>
                  <th className="py-3.5 px-5 w-24 text-center">الخصم</th>
                  <th className="py-3.5 px-5 w-32">المجموع</th>
                  <th className="py-3.5 px-5 w-14"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                {cart.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-28 text-center text-slate-400 dark:text-slate-500">
                      <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center mx-auto mb-4 text-slate-400">
                        <ShoppingCart className="w-8 h-8 opacity-40" />
                      </div>
                      <p className="text-base font-black text-slate-800 dark:text-slate-200">عربة الكاشير فارغة</p>
                      <p className="text-xs text-slate-400 mt-1">امسح الباركود أو ابحث عن المنتجات لإضافتها فوراً</p>
                    </td>
                  </tr>
                ) : (
                  cart.map(item => (
                    <tr key={item.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="py-3.5 px-5 font-black text-slate-900 dark:text-white text-sm">
                        {item.name}
                      </td>
                      <td className="py-3.5 px-5 font-bold font-mono text-slate-600 dark:text-slate-400">
                        {item.unit_price.toFixed(2)}
                      </td>
                      <td className="py-3.5 px-5">
                        <div className="flex items-center justify-center gap-2">
                          <button 
                            type="button" 
                            className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 flex items-center justify-center active:scale-95 transition-all cursor-pointer font-bold"
                            onClick={() => updateQuantity(item.id, -1)}
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="w-8 text-center font-black font-mono text-base text-slate-900 dark:text-white">
                            {item.quantity}
                          </span>
                          <button 
                            type="button" 
                            className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 flex items-center justify-center active:scale-95 transition-all cursor-pointer font-bold text-blue-600 dark:text-blue-400"
                            onClick={() => updateQuantity(item.id, 1)}
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                      <td className="py-3.5 px-5 text-center">
                        <Input 
                          type="number" 
                          min="0"
                          className="h-8 w-18 text-center font-mono font-bold bg-slate-50 dark:bg-slate-800 rounded-lg text-xs" 
                          value={item.discount || ''} 
                          onChange={(e) => updateItemDiscount(item.id, parseFloat(e.target.value) || 0)}
                        />
                      </td>
                      <td className="py-3.5 px-5 font-black text-blue-600 dark:text-blue-400 font-mono text-base">
                        {item.total.toFixed(2)} <span className="text-[10px] text-slate-400">ج.م</span>
                      </td>
                      <td className="py-3.5 px-5 text-left">
                        <button 
                          type="button"
                          className="w-8 h-8 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center justify-center transition-colors cursor-pointer"
                          onClick={() => removeFromCart(item.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Area - Checkout & Settlement (35%) */}
        <div className="w-full lg:w-[380px] flex flex-col gap-4 shrink-0">
          {/* Customer & Pricing breakdown */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-sm p-5 space-y-4 transition-colors">
            <div>
              <Label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-slate-400" />
                اسم العميل
              </Label>
              <Input 
                value={customerName} 
                onChange={e => setCustomerName(e.target.value)}
                className="font-bold h-11 text-sm bg-slate-50 dark:bg-slate-800 rounded-xl"
              />
            </div>
            
            <div className="space-y-2 pt-3 border-t border-slate-100 dark:border-slate-800 text-sm">
              <div className="flex justify-between text-slate-500 dark:text-slate-400 font-medium">
                <span>المجموع الفرعي:</span>
                <span className="font-mono font-bold text-slate-700 dark:text-slate-300">{subtotal.toFixed(2)} ج.م</span>
              </div>
              <div className="flex justify-between text-rose-600 dark:text-rose-400 font-medium">
                <span>إجمالي الخصم:</span>
                <span className="font-mono font-bold">{totalDiscount.toFixed(2)} ج.م</span>
              </div>
              <div className="flex justify-between items-end pt-3 border-t border-slate-200/80 dark:border-slate-700">
                <span className="text-base font-black text-slate-900 dark:text-white">الإجمالي النهائي:</span>
                <span className="text-3xl font-black text-blue-600 dark:text-blue-400 font-mono tracking-tight">
                  {totalAmount.toFixed(2)} <span className="text-xs font-bold text-slate-400">ج.م</span>
                </span>
              </div>
            </div>
          </div>

          {/* Payment Method & Complete Actions */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-sm p-5 space-y-4 flex-1 flex flex-col justify-between transition-colors">
            <div className="space-y-4">
              <div>
                <Label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 block">
                  طريقة الدفع
                </Label>
                <div className="grid grid-cols-2 gap-2">
                  <button 
                    type="button"
                    className={`h-12 rounded-xl text-sm font-black flex items-center justify-center gap-2 border transition-all cursor-pointer ${
                      paymentMethod === 'cash'
                        ? 'bg-blue-600 text-white border-blue-500 shadow-md shadow-blue-600/30 scale-[1.02]'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                    }`}
                    onClick={() => setPaymentMethod('cash')}
                  >
                    <Banknote className="h-4 w-4" />
                    نقدي
                  </button>
                  <button 
                    type="button"
                    className={`h-12 rounded-xl text-sm font-black flex items-center justify-center gap-2 border transition-all cursor-pointer ${
                      paymentMethod === 'card'
                        ? 'bg-blue-600 text-white border-blue-500 shadow-md shadow-blue-600/30 scale-[1.02]'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                    }`}
                    onClick={() => setPaymentMethod('card')}
                  >
                    <CreditCard className="h-4 w-4" />
                    بطاقة (فيزا)
                  </button>
                </div>
              </div>

              <div>
                <Label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5 block">
                  المبلغ المدفوع
                </Label>
                <Input 
                  type="number"
                  value={paidAmount} 
                  onChange={e => setPaidAmount(e.target.value)}
                  className="h-14 text-2xl font-black font-mono text-center bg-slate-50 dark:bg-slate-800 rounded-xl"
                  placeholder={totalAmount.toFixed(2)}
                />
              </div>

              <div className="flex justify-between items-center p-3.5 bg-slate-50 dark:bg-slate-800/70 border border-slate-200/90 dark:border-slate-700 rounded-xl">
                <span className="font-bold text-sm text-slate-600 dark:text-slate-300">المتبقي للعميل:</span>
                <span className={`text-xl font-black font-mono ${change > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-700 dark:text-slate-300'}`}>
                  {change.toFixed(2)} ج.م
                </span>
              </div>
            </div>

            {/* Quick Action buttons */}
            <div className="pt-3 grid grid-cols-3 gap-2">
              <Button 
                variant="outline" 
                className="h-14 col-span-1 text-xs font-bold text-rose-600 border-rose-200 hover:bg-rose-50 dark:border-rose-900 dark:hover:bg-rose-950/40 rounded-xl" 
                onClick={clearCart}
              >
                <X className="w-4 h-4 ml-1" />
                إلغاء (F1)
              </Button>
              <Button 
                className="h-14 col-span-2 text-base font-black bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl shadow-lg shadow-emerald-600/30 active:scale-95" 
                onClick={handleCompleteSale}
              >
                <CheckCircle2 className="w-5 h-5 ml-2" />
                إتمام البيع (F9)
              </Button>
            </div>
          </div>
        </div>
      </div>
      
      {/* Hidden Thermal Receipt for Printing */}
      {lastSale && (
        <ThermalReceipt {...lastSale} />
      )}
    </>
  )
}
