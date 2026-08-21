'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/lib/db'
import { Plus, Search, FileText, ShoppingCart, Receipt, Calendar, CreditCard, Banknote, Eye, Printer, X, Scale } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ThermalReceipt } from '../pos/receipt'

export default function SalesListPage() {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedSale, setSelectedSale] = useState<any>(null)

  // Fetch sales and sale lines
  const salesData = useLiveQuery(async () => {
    const salesList = await db.sales.orderBy('created_at').reverse().toArray()
    const allLines = await db.sale_lines.toArray()

    // Map lines to their sales
    const linesBySaleId = new Map<string, typeof allLines>()
    allLines.forEach(line => {
      if (!linesBySaleId.has(line.sale_id)) {
        linesBySaleId.set(line.sale_id, [])
      }
      linesBySaleId.get(line.sale_id)!.push(line)
    })

    return salesList.map(sale => ({
      ...sale,
      lines: linesBySaleId.get(sale.id) || []
    }))
  }, []) || []

  const filteredSales = salesData.filter(s =>
    s.invoice_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (s.customer_name && s.customer_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
    s.lines.some(l => (l.item_name || '').toLowerCase().includes(searchTerm.toLowerCase()))
  )

  const handlePrint = (sale: any) => {
    setSelectedSale(sale)
    setTimeout(() => {
      window.print()
    }, 200)
  }

  return (
    <div className="space-y-6 select-none" dir="rtl">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-sm transition-colors">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/50 border border-blue-100 dark:border-blue-800/60 flex items-center justify-center text-blue-600 dark:text-blue-400 shadow-xs">
            <Receipt className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
              سجل المبيعات والفواتير
            </h1>
            <p className="text-xs sm:text-sm font-semibold text-slate-500 dark:text-slate-400 mt-0.5">
              عرض ومتابعة كافة فواتير المبيعات وتفاصيل الأصناف الصادرة من الكاشير
            </p>
          </div>
        </div>

        <Link href="/dashboard/pos">
          <Button size="lg" className="w-full sm:w-auto h-12 px-6 text-sm font-black bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-xl shadow-md shadow-blue-600/25 hover:shadow-lg hover:shadow-blue-600/35 hover:-translate-y-0.5 active:scale-95 transition-all duration-200 cursor-pointer">
            <ShoppingCart className="w-5 h-5 ml-2" />
            فتح شاشة الكاشير
          </Button>
        </Link>
      </div>

      {/* Search Bar */}
      <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-sm flex items-center transition-colors">
        <div className="relative w-full max-w-lg">
          <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 w-5 h-5 pointer-events-none" />
          <Input 
            placeholder="بحث برقم الفاتورة، اسم العميل، أو اسم الصنف المباع..."
            className="pr-12 h-12 text-sm text-slate-900 dark:text-white bg-slate-50/80 dark:bg-slate-800/80 border-slate-300 dark:border-slate-700 rounded-xl font-bold placeholder:text-slate-400 dark:placeholder:text-slate-400"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Sales Invoices Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-sm overflow-hidden transition-colors">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-right border-collapse">
            <thead className="bg-slate-50/90 dark:bg-slate-800/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-extrabold text-xs tracking-wider">
              <tr>
                <th className="py-4 px-6 font-black">رقم الفاتورة</th>
                <th className="py-4 px-6 font-black">العميل</th>
                <th className="py-4 px-6 font-black">الأصناف المشتراة (المحتويات)</th>
                <th className="py-4 px-6 font-black">التاريخ والوقت</th>
                <th className="py-4 px-6 font-black">طريقة الدفع</th>
                <th className="py-4 px-6 font-black">الإجمالي</th>
                <th className="py-4 px-6 font-black text-center">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 bg-white dark:bg-slate-900">
              {filteredSales.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-20 text-center">
                    <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center mx-auto mb-4 text-slate-400 dark:text-slate-500">
                      <FileText className="w-8 h-8 opacity-60" />
                    </div>
                    <p className="text-base font-black text-slate-800 dark:text-slate-200">لا توجد فواتير مبيعات مسجلة</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
                      جميع عمليات البيع التي تتم عبر شاشة الكاشير ستظهر هنا فوراً
                    </p>
                    <div className="mt-5">
                      <Link href="/dashboard/pos">
                        <Button size="sm" className="h-10 px-5 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-xs">
                          <ShoppingCart className="w-4 h-4 ml-1.5" />
                          فتح الكاشير وبدء البيع
                        </Button>
                      </Link>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredSales.map(sale => {
                  const lineCount = sale.lines?.length || 0
                  return (
                    <tr 
                      key={sale.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/60 transition-colors duration-150 cursor-pointer group"
                      onClick={() => setSelectedSale(sale)}
                    >
                      <td className="py-4 px-6 font-mono font-extrabold text-sm text-blue-600 dark:text-blue-400">
                        {sale.invoice_number}
                      </td>
                      <td className="py-4 px-6 font-bold text-slate-900 dark:text-white text-sm">
                        {sale.customer_name || 'عميل نقدي'}
                      </td>
                      {/* Bought items preview */}
                      <td className="py-4 px-6 max-w-md">
                        {lineCount > 0 ? (
                          <div className="flex flex-wrap gap-1.5">
                            {sale.lines.slice(0, 3).map((line: any, idx: number) => {
                              const isWeight = line.quantity % 1 !== 0 || line.quantity < 1
                              return (
                                <span 
                                  key={idx} 
                                  className="inline-flex items-center gap-1 text-xs bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-bold px-2 py-0.5 rounded-lg"
                                >
                                  <span>{line.item_name}</span>
                                  <span className="text-blue-600 dark:text-blue-400 font-mono">
                                    ({line.quantity} {isWeight ? 'كجم' : 'ق'})
                                  </span>
                                </span>
                              )
                            })}
                            {lineCount > 3 && (
                              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-lg">
                                +{lineCount - 3} أصناف أخرى
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">لا توجد بنود مسجلة</span>
                        )}
                      </td>
                      <td className="py-4 px-6 text-xs text-slate-500 dark:text-slate-400 font-medium">
                        {new Date(sale.sale_date).toLocaleString('ar-EG')}
                      </td>
                      <td className="py-4 px-6">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                          {sale.payment_method === 'cash' ? (
                            <>
                              <Banknote className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                              نقدي
                            </>
                          ) : (
                            <>
                              <CreditCard className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                              بطاقة
                            </>
                          )}
                        </span>
                      </td>
                      <td className="py-4 px-6 font-black text-slate-900 dark:text-white font-mono text-base">
                        {sale.total.toFixed(2)} <span className="text-xs font-bold text-slate-400">ج.م</span>
                      </td>
                      <td className="py-4 px-6 text-center" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setSelectedSale(sale)}
                            className="h-9 px-3 text-xs font-bold border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl cursor-pointer"
                            title="عرض تفاصيل الفاتورة"
                          >
                            <Eye className="w-3.5 h-3.5 ml-1 text-blue-500" />
                            عرض
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handlePrint(sale)}
                            className="h-9 w-9 p-0 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl cursor-pointer"
                            title="طباعة الإيصال"
                          >
                            <Printer className="w-3.5 h-3.5 text-emerald-500" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Invoice Details Modal */}
      {selectedSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs select-none" dir="rtl">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in duration-150 flex flex-col max-h-[90vh]">
            
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-5 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center shadow-md">
                  <Receipt className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-white">تفاصيل الفاتورة: {selectedSale.invoice_number}</h3>
                  <p className="text-xs font-bold text-blue-100">
                    العميل: {selectedSale.customer_name || 'عميل نقدي'} | {new Date(selectedSale.sale_date).toLocaleString('ar-EG')}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedSale(null)}
                className="p-2 rounded-xl text-white/80 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Items List */}
            <div className="p-6 overflow-y-auto flex-1 space-y-5">
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                <table className="w-full text-right text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 font-extrabold text-xs">
                    <tr>
                      <th className="p-3">اسم الصنف</th>
                      <th className="p-3 text-center">الكمية / الوزن</th>
                      <th className="p-3 text-center">سعر الوحدة</th>
                      <th className="p-3 text-center">الإجمالي</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-bold">
                    {selectedSale.lines && selectedSale.lines.length > 0 ? (
                      selectedSale.lines.map((line: any) => {
                        const isWeight = line.quantity % 1 !== 0 || line.quantity < 1
                        const grams = Math.round(line.quantity * 1000)
                        return (
                          <tr key={line.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                            <td className="p-3 text-slate-900 dark:text-white">
                              <p className="font-bold">{line.item_name}</p>
                              {isWeight && (
                                <span className="inline-flex items-center gap-1 text-[11px] text-blue-500 font-bold">
                                  <Scale className="w-3 h-3" />
                                  وزن: {line.quantity} كجم ({grams} جم)
                                </span>
                              )}
                            </td>
                            <td className="p-3 text-center font-mono text-slate-700 dark:text-slate-300">
                              {line.quantity} {isWeight ? 'كجم' : 'قطعة'}
                            </td>
                            <td className="p-3 text-center font-mono text-slate-700 dark:text-slate-300">
                              {line.unit_price.toFixed(2)} ج.م
                            </td>
                            <td className="p-3 text-center font-mono font-black text-blue-600 dark:text-blue-400">
                              {line.net_total.toFixed(2)} ج.م
                            </td>
                          </tr>
                        )
                      })
                    ) : (
                      <tr>
                        <td colSpan={4} className="p-6 text-center text-slate-400">لا توجد بنود</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Financial Totals Summary */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2">
                <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400 font-bold">
                  <span>المجموع الفرعي:</span>
                  <span className="font-mono">{selectedSale.subtotal?.toFixed(2) || selectedSale.total?.toFixed(2)} ج.م</span>
                </div>
                {selectedSale.discount_total > 0 && (
                  <div className="flex justify-between text-xs text-rose-500 font-bold">
                    <span>إجمالي الخصم:</span>
                    <span className="font-mono">-{selectedSale.discount_total.toFixed(2)} ج.م</span>
                  </div>
                )}
                <div className="border-t border-slate-200 dark:border-slate-700 pt-2 flex justify-between items-center">
                  <span className="text-base font-black text-slate-900 dark:text-white">إجمالي الفاتورة:</span>
                  <span className="text-2xl font-black text-blue-600 dark:text-blue-400 font-mono">
                    {selectedSale.total.toFixed(2)} <span className="text-xs">ج.م</span>
                  </span>
                </div>
                <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400 font-bold pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
                  <span>المدفوع: {selectedSale.paid_amount?.toFixed(2) || selectedSale.total?.toFixed(2)} ج.م</span>
                  <span>المتبقي: {selectedSale.change_amount?.toFixed(2) || '0.00'} ج.م</span>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="p-5 pt-0 flex gap-3">
              <Button
                variant="outline"
                onClick={() => setSelectedSale(null)}
                className="flex-1 h-12 rounded-xl font-bold border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 cursor-pointer"
              >
                إغلاق
              </Button>
              <Button
                onClick={() => handlePrint(selectedSale)}
                className="flex-1 h-12 rounded-xl font-black text-white bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-600/25 cursor-pointer"
              >
                <Printer className="w-4 h-4 ml-2" />
                طباعة الفاتورة
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Print receipt renderer */}
      {selectedSale && (
        <div className="hidden print:block">
          <ThermalReceipt 
            storeName="ERP Supermarket"
            invoiceNumber={selectedSale.invoice_number}
            date={new Date(selectedSale.sale_date).toLocaleString('ar-EG')}
            customerName={selectedSale.customer_name || 'عميل نقدي'}
            items={(selectedSale.lines || []).map((l: any) => ({
              name: l.item_name,
              quantity: l.quantity,
              unitPrice: l.unit_price,
              total: l.net_total
            }))}
            subtotal={selectedSale.subtotal || selectedSale.total}
            discount={selectedSale.discount_total || 0}
            tax={0}
            total={selectedSale.total}
            paid={selectedSale.paid_amount || selectedSale.total}
            change={selectedSale.change_amount || 0}
          />
        </div>
      )}
    </div>
  )
}
