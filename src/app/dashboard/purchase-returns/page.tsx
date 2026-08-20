'use client'

import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/lib/db'
import { generateReturnNumber } from '@/lib/finance'
import { syncEngine, DEFAULT_STORE_UUID, DEFAULT_BRANCH_UUID } from '@/lib/sync-engine'
import { toast } from 'sonner'
import { Search, Undo2, AlertCircle, CheckCircle2, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { PurchaseReturn, PurchaseReturnLine, CashTransaction } from '@/lib/types'

export default function PurchaseReturnsPage() {
  const [purchaseNumber, setPurchaseNumber] = useState('')
  const [purchaseSearchTerm, setPurchaseSearchTerm] = useState('')
  const [returnQuantities, setReturnQuantities] = useState<Record<string, number>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Search purchase invoice
  const currentPurchase = useLiveQuery(async () => {
    if (!purchaseSearchTerm) return null
    const purchase = await db.purchases.where('purchase_number').equals(purchaseSearchTerm.trim()).first()
    if (!purchase) return null
    const lines = await db.purchase_lines.where('purchase_id').equals(purchase.id).toArray()
    const enrichedLines = await Promise.all(lines.map(async line => {
      const item = await db.items.get(line.item_id)
      return {
        ...line,
        item_name: item?.name || 'صنف غير معروف',
      }
    }))
    return { purchase, lines: enrichedLines }
  }, [purchaseSearchTerm])

  // List existing purchase returns
  const returnsList = useLiveQuery(
    () => db.purchase_returns.orderBy('created_at').reverse().toArray()
  ) || []

  const handleSearchPurchase = () => {
    if (!purchaseNumber.trim()) {
      toast.error('يرجى إدخال رقم فاتورة الشراء للبحث')
      return
    }
    setReturnQuantities({})
    setPurchaseSearchTerm(purchaseNumber.trim())
  }

  const handleQtyChange = (lineId: string, qty: number, maxQty: number) => {
    const validQty = Math.min(Math.max(0, qty), maxQty)
    setReturnQuantities(prev => ({
      ...prev,
      [lineId]: validQty
    }))
  }

  const processPurchaseReturn = async () => {
    if (!currentPurchase) return
    
    const linesToReturn = currentPurchase.lines
      .map(l => ({
        ...l,
        return_qty: returnQuantities[l.id] || 0
      }))
      .filter(l => l.return_qty > 0)

    if (linesToReturn.length === 0) {
      toast.error('يرجى تحديد كمية للإرجاع (أكبر من 0) لصنف واحد على الأقل')
      return
    }

    try {
      setIsSubmitting(true)
      const returnId = crypto.randomUUID()
      const now = new Date().toISOString()
      const returnNumber = generateReturnNumber('purchase')
      const storeId = currentPurchase.purchase.store_id || DEFAULT_STORE_UUID
      const branchId = currentPurchase.purchase.branch_id || DEFAULT_BRANCH_UUID

      const totalRefund = linesToReturn.reduce((sum, l) => sum + (l.return_qty * l.buy_price), 0)

      const purchaseReturn: PurchaseReturn = {
        id: returnId,
        store_id: storeId,
        branch_id: branchId,
        purchase_id: currentPurchase.purchase.id,
        return_number: returnNumber,
        purchase_number: currentPurchase.purchase.purchase_number,
        supplier_name: currentPurchase.purchase.supplier_name,
        total: totalRefund,
        refund_amount: totalRefund,
        reason: 'مرتجع مشتريات للمورد',
        return_date: now,
        created_at: now,
        updated_at: now,
      }

      await db.transaction('rw', [db.purchase_returns, db.purchase_return_lines, db.stock_balances, db.stock_ledger, db.cash_transactions, db.sync_queue], async () => {
        await db.purchase_returns.add(purchaseReturn)
        syncEngine.enqueueOperation('purchase_returns', 'INSERT', purchaseReturn)

        for (const line of linesToReturn) {
          const retLine: PurchaseReturnLine = {
            id: crypto.randomUUID(),
            store_id: storeId,
            return_id: returnId,
            item_id: line.item_id,
            quantity: line.return_qty,
            buy_price: line.buy_price,
            total: line.return_qty * line.buy_price,
          }
          await db.purchase_return_lines.add(retLine)
          syncEngine.enqueueOperation('purchase_return_lines', 'INSERT', retLine)

          const stock = await db.stock_balances.where({ store_id: storeId, item_id: line.item_id, branch_id: branchId }).first()
          if (stock) {
            await db.stock_balances.where({ store_id: storeId, item_id: line.item_id, branch_id: branchId }).modify({
              quantity: Math.max(0, stock.quantity - line.return_qty),
              updated_at: now,
            })
          }

          const ledger = {
            id: crypto.randomUUID(),
            store_id: storeId,
            branch_id: branchId,
            item_id: line.item_id,
            movement_type: 'return' as const,
            direction: 'out' as const,
            quantity: line.return_qty,
            unit_price: line.buy_price,
            total: line.return_qty * line.buy_price,
            source_table: 'purchase_returns',
            source_id: returnId,
            notes: `مرتجع مشتريات رقم ${returnNumber} للفاتورة ${currentPurchase.purchase.purchase_number}`,
            created_at: now,
          }
          await db.stock_ledger.add(ledger)
          syncEngine.enqueueOperation('stock_ledger', 'INSERT', ledger)
        }

        const cashTx: CashTransaction = {
          id: crypto.randomUUID(),
          store_id: storeId,
          branch_id: branchId,
          type: 'purchase_return',
          direction: 'in',
          amount: totalRefund,
          payment_method: 'cash',
          source_table: 'purchase_returns',
          source_id: returnId,
          notes: `استرداد مرتجع مشتريات ${returnNumber} للفاتورة ${currentPurchase.purchase.purchase_number}`,
          created_at: now,
        }
        await db.cash_transactions.add(cashTx)
        syncEngine.enqueueOperation('cash_transactions', 'INSERT', cashTx)
      })

      toast.success(`تم تسجيل مرتجع الشراء ${returnNumber} بنجاح واسترداد ${totalRefund.toFixed(2)} ج.م`)
      setPurchaseNumber('')
      setPurchaseSearchTerm('')
      setReturnQuantities({})

    } catch (error: any) {
      console.error(error)
      toast.error('حدث خطأ أثناء معالجة المرتجع: ' + error.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-6 pb-24 select-none" dir="rtl">
      {/* Header Banner */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-sm transition-colors">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-orange-50 dark:bg-orange-950/50 border border-orange-100 dark:border-orange-800/60 flex items-center justify-center text-orange-600 dark:text-orange-400 shadow-xs">
            <Undo2 className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
              مرتجعات المشتريات
            </h1>
            <p className="text-xs sm:text-sm font-semibold text-slate-500 dark:text-slate-400 mt-0.5">
              إرجاع البضائع التالفة أو الزائدة للموردين، خصمها من المخزن، واسترداد النقدية
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Side: Create Return Form (2 Cols) */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-slate-200/90 dark:border-slate-800 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg font-black text-slate-900 dark:text-white">
                البحث عن فاتورة شراء سابقة
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex flex-col sm:flex-row gap-3 max-w-lg">
                <Input 
                  placeholder="رقم الفاتورة (مثال: ERP-PUR-...)" 
                  value={purchaseNumber}
                  onChange={(e) => setPurchaseNumber(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearchPurchase()}
                  className="h-12 text-base font-mono bg-slate-50/80 dark:bg-slate-800/80 rounded-xl"
                  dir="ltr"
                />
                <Button onClick={handleSearchPurchase} size="lg" className="h-12 px-8 text-sm font-black bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-xl shadow-md shadow-blue-600/25 cursor-pointer">
                  <Search className="w-4 h-4 ml-2" />
                  بحث
                </Button>
              </div>

              {currentPurchase && (
                <div className="space-y-6">
                  <div className="bg-slate-50 dark:bg-slate-800/50 p-5 rounded-2xl border border-slate-200/90 dark:border-slate-700 flex flex-wrap gap-6 justify-between items-center">
                    <div>
                      <p className="text-xs font-semibold text-slate-400">رقم الفاتورة</p>
                      <p className="font-black font-mono text-lg text-blue-600 dark:text-blue-400">{currentPurchase.purchase.purchase_number}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-400">المورد</p>
                      <p className="font-black text-lg text-slate-900 dark:text-white">{currentPurchase.purchase.supplier_name || 'مورد عام'}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-400">إجمالي الفاتورة</p>
                      <p className="font-black text-lg text-emerald-600 dark:text-emerald-400">{currentPurchase.purchase.total.toFixed(2)} ج.م</p>
                    </div>
                  </div>

                  <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 overflow-hidden shadow-xs">
                    <table className="w-full text-sm text-right">
                      <thead className="bg-slate-50/90 dark:bg-slate-800/90 border-b border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-extrabold text-xs">
                        <tr>
                          <th className="py-3.5 px-5">اسم المنتج</th>
                          <th className="py-3.5 px-5 text-center">الكمية المشتراة</th>
                          <th className="py-3.5 px-5 text-center">سعر التكلفة</th>
                          <th className="py-3.5 px-5 w-40 text-center">كمية المرتجع</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {currentPurchase.lines.map(line => (
                          <tr key={line.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50">
                            <td className="py-3.5 px-5 font-bold text-slate-900 dark:text-slate-100">{line.item_name}</td>
                            <td className="py-3.5 px-5 text-center font-bold font-mono">{line.quantity}</td>
                            <td className="py-3.5 px-5 text-center font-mono">{line.buy_price.toFixed(2)} ج.م</td>
                            <td className="py-3.5 px-5">
                              <Input 
                                type="number" 
                                min="0" 
                                max={line.quantity}
                                value={returnQuantities[line.id] !== undefined ? returnQuantities[line.id] : 0}
                                onChange={(e) => handleQtyChange(line.id, parseInt(e.target.value) || 0, line.quantity)}
                                className="h-10 text-center font-bold text-base font-mono bg-slate-50 dark:bg-slate-800 rounded-xl"
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex justify-end">
                    <Button 
                      size="lg" 
                      onClick={processPurchaseReturn} 
                      disabled={isSubmitting}
                      className="h-14 px-8 text-base font-black bg-orange-600 hover:bg-orange-700 active:bg-orange-800 text-white rounded-xl shadow-md shadow-orange-600/25 active:scale-95 cursor-pointer"
                    >
                      <CheckCircle2 className="w-5 h-5 ml-2" />
                      {isSubmitting ? 'جاري المعالجة...' : 'تأكيد مرتجع الشراء واسترداد المبلغ'}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Side: Existing Returns Log (1 Col) */}
        <div>
          <Card className="border-slate-200/90 dark:border-slate-800 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                <FileText className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                سجل المرتجعات السابقة
              </CardTitle>
            </CardHeader>
            <CardContent>
              {returnsList.length === 0 ? (
                <div className="py-12 text-center text-slate-400 dark:text-slate-500">
                  <p className="text-sm font-bold">لا توجد مرتجعات مشتريات سابقة</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {returnsList.map(ret => (
                    <div key={ret.id} className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/80 dark:border-slate-700 flex justify-between items-center">
                      <div>
                        <p className="font-mono font-bold text-xs text-blue-600 dark:text-blue-400">{ret.return_number}</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">{new Date(ret.created_at).toLocaleDateString('ar-EG')}</p>
                      </div>
                      <span className="font-black font-mono text-sm text-emerald-600 dark:text-emerald-400">
                        {ret.refund_amount.toFixed(2)} ج.م
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
