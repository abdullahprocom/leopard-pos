'use client'

import Link from 'next/link'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/lib/db'
import { Plus, ClipboardCheck, ClipboardList, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function StocktakingPage() {
  const stocktakings = useLiveQuery(
    () => db.stocktaking.orderBy('created_at').reverse().toArray()
  ) || []

  return (
    <div className="space-y-6 pb-20" dir="rtl">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-sm transition-colors">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-purple-50 dark:bg-purple-950/50 border border-purple-100 dark:border-purple-800/60 flex items-center justify-center text-purple-600 dark:text-purple-400 shadow-xs">
            <ClipboardList className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
              الجرد والتسوية المخزنية
            </h1>
            <p className="text-xs sm:text-sm font-semibold text-slate-500 dark:text-slate-400 mt-0.5">
              تسوية أرصدة الأصناف ومطابقة المخزون الفعلي مع رصيد النظام
            </p>
          </div>
        </div>

        <Link href="/dashboard/stocktaking/new">
          <Button size="lg" className="w-full sm:w-auto h-12 px-6 text-sm font-black bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-xl shadow-md shadow-blue-600/25 hover:shadow-lg hover:shadow-blue-600/35 hover:-translate-y-0.5 active:scale-95 transition-all duration-200">
            <Plus className="w-5 h-5 ml-2" />
            بدء جلسة جرد جديدة
          </Button>
        </Link>
      </div>

      {/* Stocktaking Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-sm overflow-hidden transition-colors">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-right border-collapse">
            <thead className="bg-slate-50/90 dark:bg-slate-800/90 border-b border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-extrabold text-xs">
              <tr>
                <th className="py-4 px-6 font-black">رقم الجرد</th>
                <th className="py-4 px-6 font-black">التاريخ</th>
                <th className="py-4 px-6 font-black text-center">حالة الجرد</th>
                <th className="py-4 px-6 font-black">الملاحظات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
              {stocktakings.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-20 text-center text-slate-400 dark:text-slate-500">
                    <ClipboardCheck className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p className="font-bold text-base text-slate-700 dark:text-slate-300">لا توجد عمليات جرد مسجلة حتى الآن</p>
                    <p className="text-xs text-slate-400 mt-1">ابدأ جلسة جرد لحصر الفروقات والعجز الفعلي</p>
                    <div className="mt-5">
                      <Link href="/dashboard/stocktaking/new">
                        <Button size="sm" className="h-10 px-5 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-xs">
                          <Plus className="w-4 h-4 ml-1.5" />
                          بدء أول جلسة جرد
                        </Button>
                      </Link>
                    </div>
                  </td>
                </tr>
              ) : (
                stocktakings.map(st => (
                  <tr key={st.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="py-4 px-6 font-mono font-bold text-sm text-blue-600 dark:text-blue-400">
                      {st.stocktaking_number}
                    </td>
                    <td className="py-4 px-6 text-xs text-slate-500 dark:text-slate-400 font-medium">
                      {new Date(st.created_at).toLocaleDateString('ar-EG')}
                    </td>
                    <td className="py-4 px-6 text-center">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-black ${
                        st.status === 'completed'
                          ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 shadow-2xs'
                          : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                      }`}>
                        {st.status === 'completed' ? 'مكتمل ومعتمد' : 'مسودة'}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-xs text-slate-500 dark:text-slate-400">
                      {st.notes || '-'}
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
