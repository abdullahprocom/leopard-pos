'use client'

import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/lib/db'
import { generateReturnNumber, cleanPositivePrice, money } from '@/lib/finance'
import { syncEngine, DEFAULT_STORE_UUID, DEFAULT_BRANCH_UUID } from '@/lib/sync-engine'
import { toast } from 'sonner'
import { Search, Undo2, AlertCircle, Trash, FileText, RotateCcw, Plus, Minus, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useStore } from '@/lib/store-context'
import type { SalesReturn, SalesReturnLine, CashTransaction } from '@/lib/types'

export default function SalesReturnsPage() {
  const { storeId, branchId } = useStore()
  const currentStoreId = storeId || DEFAULT_STORE_UUID
  const currentBranchId = branchId || DEFAULT_BRANCH_UUID

  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [invoiceSearchTerm, setInvoiceSearchTerm] = useState('')
  const [invoiceReturnQuantities, setInvoiceReturnQuantities] = useState<Record<string, number>>({})
  
  // For free return
  const [itemSearchTerm, setItemSearchTerm] = useState('')
  const [freeReturnItems, setFreeReturnItems] = useState<any[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Search invoice strictly for current store
  const currentInvoice = useLiveQuery(async () => {
    if (!invoiceSearchTerm) return null
    const sale = await db.sales
      .where('store_id').equals(currentStoreId)
      .and(s => s.invoice_number === invoiceSearchTerm.trim())
      .first()
    if (!sale) return null
    const lines = await db.sale_lines.where('sale_id').equals(sale.id).toArray()
    return { sale, lines }
  }, [invoiceSearchTerm, currentStoreId])

  // Search items for free return strictly for current store
  const searchResults = useLiveQuery(async () => {
    if (itemSearchTerm.length < 1) return []
    const q = itemSearchTerm.toLowerCase()
    return await db.items
      .where('store_id').equals(currentStoreId)
      .filter(item => (item.search_text || item.name || '').toLowerCase().includes(q))
      .limit(6)
      .toArray()
  }, [itemSearchTerm, currentStoreId]) || []

  // List existing sales returns strictly for current store
  const returnsList = useLiveQuery(
    () => db.sales_returns.where('store_id').equals(currentStoreId).reverse().sortBy('created_at'),
    [currentStoreId]
  ) || []

  const handleSearchInvoice = () => {
    if (!invoiceNumber.trim()) {
      toast.error('يرجى إدخال رقم الفاتورة للبحث')
      return
    }
    setInvoiceReturnQuantities({})
    setInvoiceSearchTerm(invoiceNumber.trim())
  }

  const handleInvoiceQtyChange = (lineId: string, qty: number, maxQty: number) => {
    const validQty = Math.min(Math.max(0, qty), maxQty)
    setInvoiceReturnQuantities(prev => ({
      ...prev,
      [lineId]: validQty
    }))
  }

  const handleAddFreeReturnItem = (item: any) => {
    if (freeReturnItems.some(i => i.item_id === item.id)) {
      toast.info('هذا الصنف مضاف بالفعل في قائمة الإرجاع')
      return
    }

    setFreeReturnItems(prev => [
      ...prev,
      {
        item_id: item.id,
        name: item.name,
        unit_price: cleanPositivePrice(item.sell_price),
        return_qty: 1,
      }
    ])
    setItemSearchTerm('')
  }

  const handleFreeQtyChange = (itemId: string, qty: number) => {
    setFreeReturnItems(prev => prev.map(item => {
      if (item.item_id === itemId) {
        return { ...item, return_qty: Math.max(1, qty) }
      }
      return item
    }))
  }

  const handleRemoveFreeItem = (itemId: string) => {
    setFreeReturnItems(prev => prev.filter(item => item.item_id !== itemId))
  }

  const submitInvoiceReturn = async () => {
    if (!currentInvoice) return

    const linesToReturn = currentInvoice.lines
      .map(line => ({
        ...line,
        return_qty: invoiceReturnQuantities[line.id] || 0
      }))
      .filter(l => l.return_qty > 0)

    if (linesToReturn.length === 0) {
      toast.error('يرجى تحديد كمية للإرجاع (أكبر من 0) لصنف واحد على الأقل')
      return
    }

    try {
      setIsSubmitting(true)
      const now = new Date().toISOString()
      const returnNumber = generateReturnNumber('sale')
      const returnId = crypto.randomUUID()
      const storeId = currentInvoice.sale.store_id || DEFAULT_STORE_UUID
      const branchId = currentInvoice.sale.branch_id || DEFAULT_BRANCH_UUID

      const totalRefund = money(linesToReturn.reduce((sum, l) => sum + (l.return_qty * l.unit_price), 0))

      const salesReturn: SalesReturn = {
        id: returnId,
        store_id: storeId,
        branch_id: branchId,
        sale_id: currentInvoice.sale.id,
        return_number: returnNumber,
        invoice_number: currentInvoice.sale.invoice_number,
        customer_name: currentInvoice.sale.customer_name || 'عميل نقدي',
        return_type: 'invoice',
        total: totalRefund,
        refund_amount: totalRefund,
        reason: 'مرتجع فاتورة مبيعات',
        return_date: now,
        created_at: now,
        updated_at: now,
      }

      await db.transaction('rw', [db.sales_returns, db.sales_return_lines, db.stock_balances, db.stock_ledger, db.cash_transactions, db.sync_queue], async () => {
        await db.sales_returns.add(salesReturn)
        syncEngine.enqueueOperation('sales_returns', 'INSERT', salesReturn)

        for (const line of linesToReturn) {
          const returnLine: SalesReturnLine = {
            id: crypto.randomUUID(),
            store_id: storeId,
            return_id: returnId,
            item_id: line.item_id,
            quantity: line.return_qty,
            unit_price: line.unit_price,
            total: money(line.return_qty * line.unit_price),
          }
          await db.sales_return_lines.add(returnLine)
          syncEngine.enqueueOperation('sales_return_lines', 'INSERT', returnLine)

          // Return stock to balance
          const stock = await db.stock_balances.where({ store_id: storeId, item_id: line.item_id, branch_id: branchId }).first()
          if (stock) {
            await db.stock_balances.where({ store_id: storeId, item_id: line.item_id, branch_id: branchId }).modify({
              quantity: stock.quantity + line.return_qty,
              updated_at: now,
            })
          } else {
            await db.stock_balances.add({
              id: crypto.randomUUID(),
              store_id: storeId,
              item_id: line.item_id,
              branch_id: branchId,
              quantity: line.return_qty,
              updated_at: now
            })
          }

          // Stock ledger entry
          const ledger = {
            id: crypto.randomUUID(),
            store_id: storeId,
            branch_id: branchId,
            item_id: line.item_id,
            movement_type: 'return' as const,
            direction: 'in' as const,
            quantity: line.return_qty,
            unit_price: line.unit_price,
            total: money(line.return_qty * line.unit_price),
            source_table: 'sales_returns',
            source_id: returnId,
            notes: `مرتجع مبيعات رقم ${returnNumber} للفاتورة ${currentInvoice.sale.invoice_number}`,
            created_at: now,
          }
          await db.stock_ledger.add(ledger)
          syncEngine.enqueueOperation('stock_ledger', 'INSERT', ledger)
        }

        // Refund cash transaction
        const cashTx: CashTransaction = {
          id: crypto.randomUUID(),
          store_id: storeId,
          branch_id: branchId,
          type: 'sale_return',
          direction: 'out',
          amount: totalRefund,
          payment_method: 'cash',
          source_table: 'sales_returns',
          source_id: returnId,
          notes: `استرداد نقدي لمرتجع مبيعات ${returnNumber} للفاتورة ${currentInvoice.sale.invoice_number}`,
          created_at: now,
        }
        await db.cash_transactions.add(cashTx)
        syncEngine.enqueueOperation('cash_transactions', 'INSERT', cashTx)
      })

      toast.success(`تم تسجيل المرتجع بنجاح برقم ${returnNumber} واسترداد ${totalRefund.toFixed(2)} ج.م للعميل`)
      setInvoiceNumber('')
      setInvoiceSearchTerm('')
      setInvoiceReturnQuantities({})

    } catch (error: any) {
      console.error(error)
      toast.error('حدث خطأ أثناء معالجة الإرجاع: ' + error.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const submitFreeReturn = async () => {
    if (freeReturnItems.length === 0) {
      toast.error('يرجى اختيار صنف واحد على الأقل للإرجاع')
      return
    }

    try {
      setIsSubmitting(true)
      const now = new Date().toISOString()
      const returnNumber = generateReturnNumber('sale')
      const returnId = crypto.randomUUID()
      const storeId = currentStoreId
      const branchId = currentBranchId

      const totalRefund = money(freeReturnItems.reduce((sum, item) => sum + (item.return_qty * item.unit_price), 0))

      const salesReturn: SalesReturn = {
        id: returnId,
        store_id: storeId,
        branch_id: branchId,
        return_number: returnNumber,
        customer_name: 'مرتجع حر',
        return_type: 'free',
        total: totalRefund,
        refund_amount: totalRefund,
        reason: 'مرتجع مبيعات حر بدون فاتورة',
        return_date: now,
        created_at: now,
        updated_at: now,
      }

      await db.transaction('rw', [db.sales_returns, db.sales_return_lines, db.stock_balances, db.stock_ledger, db.cash_transactions, db.sync_queue], async () => {
        await db.sales_returns.add(salesReturn)
        syncEngine.enqueueOperation('sales_returns', 'INSERT', salesReturn)

        for (const item of freeReturnItems) {
          const returnLine: SalesReturnLine = {
            id: crypto.randomUUID(),
            store_id: storeId,
            return_id: returnId,
            item_id: item.item_id,
            quantity: item.return_qty,
            unit_price: item.unit_price,
            total: money(item.return_qty * item.unit_price),
          }
          await db.sales_return_lines.add(returnLine)
          syncEngine.enqueueOperation('sales_return_lines', 'INSERT', returnLine)

          const stock = await db.stock_balances.where({ store_id: storeId, item_id: item.item_id, branch_id: branchId }).first()
          if (stock) {
            await db.stock_balances.where({ store_id: storeId, item_id: item.item_id, branch_id: branchId }).modify({
              quantity: stock.quantity + item.return_qty,
              updated_at: now,
            })
          } else {
            await db.stock_balances.add({
              id: crypto.randomUUID(),
              store_id: storeId,
              item_id: item.item_id,
              branch_id: branchId,
              quantity: item.return_qty,
              updated_at: now
            })
          }

          const ledger = {
            id: crypto.randomUUID(),
            store_id: storeId,
            branch_id: branchId,
            item_id: item.item_id,
            movement_type: 'return' as const,
            direction: 'in' as const,
            quantity: item.return_qty,
            unit_price: item.unit_price,
            total: money(item.return_qty * item.unit_price),
            source_table: 'sales_returns',
            source_id: returnId,
            notes: `مرتجع مبيعات حر رقم ${returnNumber}`,
            created_at: now,
          }
          await db.stock_ledger.add(ledger)
          syncEngine.enqueueOperation('stock_ledger', 'INSERT', ledger)
        }

        const cashTx: CashTransaction = {
          id: crypto.randomUUID(),
          store_id: storeId,
          branch_id: branchId,
          type: 'sale_return',
          direction: 'out',
          amount: totalRefund,
          payment_method: 'cash',
          source_table: 'sales_returns',
          source_id: returnId,
          notes: `استرداد نقدي لمرتجع مبيعات حر ${returnNumber}`,
          created_at: now,
        }
        await db.cash_transactions.add(cashTx)
        syncEngine.enqueueOperation('cash_transactions', 'INSERT', cashTx)
      })

      toast.success(`تم تسجيل المرتجع الحر بنجاح واسترداد ${totalRefund.toFixed(2)} ج.م`)
      setFreeReturnItems([])

    } catch (error: any) {
      console.error(error)
      toast.error('حدث خطأ أثناء معالجة الإرجاع: ' + error.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-6 pb-24 select-none" dir="rtl">
      {/* Header Banner */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-sm transition-colors">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-100 dark:border-rose-800/60 flex items-center justify-center text-rose-600 dark:text-rose-400 shadow-xs">
            <Undo2 className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
              مرتجعات المبيعات
            </h1>
            <p className="text-xs sm:text-sm font-semibold text-slate-500 dark:text-slate-400 mt-0.5">
              إدارة إرجاع الأصناف، إعادة الكميات للمخزن، واسترداد المبالغ للعملاء
            </p>
          </div>
        </div>
      </div>

      {/* Tabs with Prominent Buttons */}
      <Tabs defaultValue="invoice" className="w-full">
        <TabsList className="w-full max-w-lg grid grid-cols-2">
          <TabsTrigger value="invoice">
            <FileText className="w-4 h-4" />
            مرتجع من فاتورة
          </TabsTrigger>
          <TabsTrigger value="free">
            <RotateCcw className="w-4 h-4" />
            مرتجع حر (بدون فاتورة)
          </TabsTrigger>
        </TabsList>
        
        {/* Tab 1: Return from invoice */}
        <TabsContent value="invoice" className="space-y-6">
          <Card className="border-slate-200/90 dark:border-slate-800 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg font-black text-slate-900 dark:text-white">
                البحث عن الفاتورة المبيعة
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex flex-col sm:flex-row gap-3 max-w-lg">
                <Input 
                  placeholder="رقم الفاتورة (مثال: ERP-INV-...)" 
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearchInvoice()}
                  className="h-12 text-base font-mono bg-slate-50/80 dark:bg-slate-800/80 rounded-xl"
                  dir="ltr"
                />
                <Button onClick={handleSearchInvoice} size="lg" className="h-12 px-8 text-sm font-black bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-xl shadow-md shadow-blue-600/25 cursor-pointer">
                  <Search className="w-4 h-4 ml-2" />
                  بحث
                </Button>
              </div>

              {currentInvoice && (
                <div className="space-y-6">
                  <div className="bg-slate-50 dark:bg-slate-800/50 p-5 rounded-2xl border border-slate-200/90 dark:border-slate-700 flex flex-wrap gap-6 justify-between items-center">
                    <div>
                      <p className="text-xs font-semibold text-slate-400">رقم الفاتورة</p>
                      <p className="font-black font-mono text-lg text-blue-600 dark:text-blue-400">{currentInvoice.sale.invoice_number}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-400">اسم العميل</p>
                      <p className="font-black text-lg text-slate-900 dark:text-white">{currentInvoice.sale.customer_name || 'عميل نقدي'}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-400">إجمالي الفاتورة</p>
                      <p className="font-black text-lg text-emerald-600 dark:text-emerald-400">{currentInvoice.sale.total.toFixed(2)} ج.م</p>
                    </div>
                  </div>

                  <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 overflow-hidden shadow-xs">
                    <table className="w-full text-sm text-right">
                      <thead className="bg-slate-50/90 dark:bg-slate-800/90 border-b border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-extrabold text-xs">
                        <tr>
                          <th className="py-3.5 px-5">اسم المنتج</th>
                          <th className="py-3.5 px-5 text-center">الكمية المباعة</th>
                          <th className="py-3.5 px-5 text-center">سعر الوحدة</th>
                          <th className="py-3.5 px-5 text-center">الإجمالي</th>
                          <th className="py-3.5 px-5 w-48 text-center">الكمية المرتجعة</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {currentInvoice.lines.map(line => {
                          const currentVal = invoiceReturnQuantities[line.id] !== undefined ? invoiceReturnQuantities[line.id] : 0
                          return (
                            <tr key={line.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50">
                              <td className="py-3.5 px-5 font-bold text-slate-900 dark:text-slate-100">{line.item_name}</td>
                              <td className="py-3.5 px-5 text-center font-bold font-mono">{line.quantity}</td>
                              <td className="py-3.5 px-5 text-center font-mono">{line.unit_price.toFixed(2)} ج.م</td>
                              <td className="py-3.5 px-5 text-center font-mono font-bold">{(line.quantity * line.unit_price).toFixed(2)} ج.م</td>
                              <td className="py-3.5 px-5">
                                <div className="inline-flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl mx-auto w-full justify-center">
                                  <button 
                                    type="button"
                                    onClick={() => handleInvoiceQtyChange(line.id, currentVal - 1, line.quantity)}
                                    className="w-8 h-8 rounded-lg bg-white dark:bg-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600 active:scale-95 transition-all cursor-pointer"
                                  >
                                    <Minus className="w-3.5 h-3.5" />
                                  </button>
                                  <input 
                                    type="number" 
                                    min="0" 
                                    max={line.quantity}
                                    value={currentVal}
                                    onChange={(e) => handleInvoiceQtyChange(line.id, parseInt(e.target.value) || 0, line.quantity)}
                                    className="w-16 h-8 text-center font-black font-mono text-base bg-transparent text-slate-900 dark:text-white outline-none"
                                  />
                                  <button 
                                    type="button"
                                    onClick={() => handleInvoiceQtyChange(line.id, currentVal + 1, line.quantity)}
                                    className="w-8 h-8 rounded-lg bg-white dark:bg-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600 active:scale-95 transition-all cursor-pointer"
                                  >
                                    <Plus className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex justify-end">
                    <Button 
                      size="lg" 
                      onClick={submitInvoiceReturn} 
                      disabled={isSubmitting}
                      className="h-14 px-8 text-base font-black bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white rounded-xl shadow-md shadow-rose-600/25 active:scale-95 cursor-pointer"
                    >
                      <CheckCircle2 className="w-5 h-5 ml-2" />
                      {isSubmitting ? 'جاري المعالجة...' : 'تأكيد مرتجع الفاتورة واسترداد المبلغ'}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 2: Free return */}
        <TabsContent value="free" className="space-y-6">
          <Card className="border-slate-200/90 dark:border-slate-800 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg font-black text-slate-900 dark:text-white">
                إرجاع حر مباشر (بدون فاتورة)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              
              {/* Isolated Search dropdown */}
              <div className="relative max-w-md z-30">
                <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 w-5 h-5 pointer-events-none" />
                <Input 
                  placeholder="ابحث بالاسم أو الباركود لإضافة صنف للمرتجع..." 
                  value={itemSearchTerm}
                  onChange={(e) => setItemSearchTerm(e.target.value)}
                  className="pr-12 h-12 text-sm bg-slate-50/80 dark:bg-slate-800/80 rounded-xl"
                />

                {searchResults.length > 0 && (
                  <div className="absolute top-full right-0 left-0 mt-2 z-50 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl overflow-hidden divide-y dark:divide-slate-800">
                    {searchResults.map(item => (
                      <div 
                        key={item.id} 
                        onClick={() => handleAddFreeReturnItem(item)}
                        className="p-3.5 hover:bg-blue-50 dark:hover:bg-slate-800 cursor-pointer flex justify-between items-center transition-colors"
                      >
                        <div>
                          <p className="font-bold text-sm text-slate-900 dark:text-white">{item.name}</p>
                          <p className="text-xs font-mono text-slate-400">{item.sku || 'بدون SKU'}</p>
                        </div>
                        <span className="font-black text-blue-600 dark:text-blue-400 font-mono">{item.sell_price.toFixed(2)} ج.م</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {freeReturnItems.length > 0 && (
                <div className="space-y-6">
                  <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 overflow-hidden shadow-xs">
                    <table className="w-full text-sm text-right">
                      <thead className="bg-slate-50/90 dark:bg-slate-800/90 border-b border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-extrabold text-xs">
                        <tr>
                          <th className="py-3.5 px-5">اسم المنتج</th>
                          <th className="py-3.5 px-5">سعر الإرجاع</th>
                          <th className="py-3.5 px-5 w-48 text-center">الكمية</th>
                          <th className="py-3.5 px-5">الإجمالي</th>
                          <th className="py-3.5 px-5 w-16"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {freeReturnItems.map(item => (
                          <tr key={item.item_id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50">
                            <td className="py-3.5 px-5 font-bold text-slate-900 dark:text-slate-100">{item.name}</td>
                            <td className="py-3.5 px-5 font-mono">{item.unit_price.toFixed(2)} ج.م</td>
                            <td className="py-3.5 px-5">
                              <div className="inline-flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl mx-auto w-full justify-center">
                                <button 
                                  type="button"
                                  onClick={() => handleFreeQtyChange(item.item_id, item.return_qty - 1)}
                                  className="w-8 h-8 rounded-lg bg-white dark:bg-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600 active:scale-95 transition-all cursor-pointer"
                                >
                                  <Minus className="w-3.5 h-3.5" />
                                </button>
                                <input 
                                  type="number" 
                                  min="1" 
                                  value={item.return_qty}
                                  onChange={(e) => handleFreeQtyChange(item.item_id, parseInt(e.target.value) || 1)}
                                  className="w-16 h-8 text-center font-black font-mono text-base bg-transparent text-slate-900 dark:text-white outline-none"
                                />
                                <button 
                                  type="button"
                                  onClick={() => handleFreeQtyChange(item.item_id, item.return_qty + 1)}
                                  className="w-8 h-8 rounded-lg bg-white dark:bg-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600 active:scale-95 transition-all cursor-pointer"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                            <td className="py-3.5 px-5 font-mono font-black text-blue-600 dark:text-blue-400">
                              {(item.return_qty * item.unit_price).toFixed(2)} ج.م
                            </td>
                            <td className="py-3.5 px-5 text-center">
                              <Button variant="ghost" size="icon" className="text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl" onClick={() => handleRemoveFreeItem(item.item_id)}>
                                <Trash className="w-4 h-4" />
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex justify-end">
                    <Button 
                      size="lg" 
                      onClick={submitFreeReturn} 
                      disabled={isSubmitting}
                      className="h-14 px-8 text-base font-black bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white rounded-xl shadow-md shadow-rose-600/25 active:scale-95 cursor-pointer"
                    >
                      <CheckCircle2 className="w-5 h-5 ml-2" />
                      {isSubmitting ? 'جاري المعالجة...' : 'تأكيد المرتجع الحر واسترداد المبلغ'}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
