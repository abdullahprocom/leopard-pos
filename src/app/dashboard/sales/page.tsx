'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/lib/db'
import { Plus, Search, FileText, ShoppingCart, Receipt, Calendar, CreditCard, Banknote } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export default function SalesListPage() {
  const [searchTerm, setSearchTerm] = useState('')

  const sales = useLiveQuery(
    () => db.sales.orderBy('created_at').reverse().toArray()
  ) || []

  const filteredSales = sales.filter(s =>
    s.invoice_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (s.customer_name && s.customer_name.toLowerCase().includes(searchTerm.toLowerCase()))
  )

  return (
    <div className="space-y-6" dir="rtl">
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
              عرض ومتابعة كافة فواتير المبيعات الصادرة من الكاشير
            </p>
          </div>
        </div>

        <Link href="/dashboard/pos">
          <Button size="lg" className="w-full sm:w-auto h-12 px-6 text-sm font-black bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-xl shadow-md shadow-blue-600/25 hover:shadow-lg hover:shadow-blue-600/35 hover:-translate-y-0.5 active:scale-95 transition-all duration-200">
            <ShoppingCart className="w-5 h-5 ml-2" />
            فتح شاشة الكاشير
          </Button>
        </Link>
      </div>

      {/* Search Bar */}
      <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-sm flex items-center transition-colors">
        <div className="relative w-full max-w-md">
          <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 w-5 h-5 pointer-events-none" />
          <Input 
            placeholder="بحث برقم الفاتورة أو اسم العميل..."
            className="pr-12 h-12 text-sm text-slate-900 dark:text-slate-100 bg-slate-50/80 dark:bg-slate-800/80 border-slate-200/90 dark:border-slate-700 rounded-xl focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium placeholder:text-slate-400 dark:placeholder:text-slate-500"
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
                <th className="py-4 px-6 font-black">التاريخ والوقت</th>
                <th className="py-4 px-6 font-black">طريقة الدفع</th>
                <th className="py-4 px-6 font-black">الإجمالي</th>
                <th className="py-4 px-6 font-black text-center">حالة الفاتورة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 bg-white dark:bg-slate-900">
              {filteredSales.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-20 text-center">
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
                filteredSales.map(sale => (
                  <tr 
                    key={sale.id}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/60 transition-colors duration-150"
                  >
                    <td className="py-4 px-6 font-mono font-extrabold text-sm text-blue-600 dark:text-blue-400">
                      {sale.invoice_number}
                    </td>
                    <td className="py-4 px-6 font-bold text-slate-900 dark:text-slate-100 text-sm">
                      {sale.customer_name || 'عميل نقدي'}
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
                    <td className="py-4 px-6 font-black text-slate-900 dark:text-slate-100 font-mono text-base">
                      {sale.total.toFixed(2)} <span className="text-xs font-bold text-slate-400">ج.م</span>
                    </td>
                    <td className="py-4 px-6 text-center">
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-black bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 shadow-2xs">
                        {sale.status === 'invoice' ? 'معتمدة' : sale.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
