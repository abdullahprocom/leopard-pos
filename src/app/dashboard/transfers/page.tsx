'use client'

import Link from 'next/link'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/lib/db'
import { Plus, ArrowLeftRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

import { useStore } from '@/lib/store-context'
import { DEFAULT_STORE_UUID } from '@/lib/sync-engine'

export default function TransfersPage() {
  const { storeId } = useStore()
  const currentStoreId = storeId || DEFAULT_STORE_UUID

  const transfers = useLiveQuery(
    () => db.stock_transfers.where('store_id').equals(currentStoreId).reverse().sortBy('created_at'),
    [currentStoreId]
  ) || []

  return (
    <div className="space-y-6 pb-20" dir="rtl">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-sm transition-colors">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-cyan-50 dark:bg-cyan-950/50 border border-cyan-100 dark:border-cyan-800/60 flex items-center justify-center text-cyan-600 dark:text-cyan-400 shadow-xs">
            <ArrowLeftRight className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
              التحويل والنقل المخزني
            </h1>
            <p className="text-xs sm:text-sm font-semibold text-slate-500 dark:text-slate-400 mt-0.5">
              تحويل البضائع والأصناف بين الفروع والمخازن المختلفة
            </p>
          </div>
        </div>

        <Link href="/dashboard/transfers/new">
          <Button size="lg" className="w-full sm:w-auto h-12 px-6 text-sm font-black bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-xl shadow-md shadow-blue-600/25 hover:shadow-lg hover:shadow-blue-600/35 hover:-translate-y-0.5 active:scale-95 transition-all duration-200">
            <Plus className="w-5 h-5 ml-2" />
            تحويل مخزني جديد
          </Button>
        </Link>
      </div>

      {/* Transfers Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-sm overflow-hidden transition-colors">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-right border-collapse">
            <thead className="bg-slate-50/90 dark:bg-slate-800/90 border-b border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-extrabold text-xs">
              <tr>
                <th className="py-4 px-6 font-black">رقم التحويل</th>
                <th className="py-4 px-6 font-black">التاريخ</th>
                <th className="py-4 px-6 font-black text-center">حالة التحويل</th>
                <th className="py-4 px-6 font-black">الملاحظات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
              {transfers.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-20 text-center text-slate-400 dark:text-slate-500">
                    <ArrowLeftRight className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p className="font-bold text-base text-slate-700 dark:text-slate-300">لا توجد تحويلات مخزنية مسجلة حتى الآن</p>
                    <p className="text-xs text-slate-400 mt-1">سجل تحويل بضائع بين المستودعات والفروع</p>
                    <div className="mt-5">
                      <Link href="/dashboard/transfers/new">
                        <Button size="sm" className="h-10 px-5 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-xs">
                          <Plus className="w-4 h-4 ml-1.5" />
                          تسجيل أول تحويل مخزني
                        </Button>
                      </Link>
                    </div>
                  </td>
                </tr>
              ) : (
                transfers.map(tr => (
                  <tr key={tr.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="py-4 px-6 font-mono font-bold text-sm text-blue-600 dark:text-blue-400">
                      {tr.transfer_number}
                    </td>
                    <td className="py-4 px-6 text-xs text-slate-500 dark:text-slate-400 font-medium">
                      {new Date(tr.created_at).toLocaleDateString('ar-EG')}
                    </td>
                    <td className="py-4 px-6 text-center">
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-black bg-cyan-50 dark:bg-cyan-950/40 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800 shadow-2xs">
                        {tr.status === 'completed' ? 'مكتمل' : 'قيد التنفيذ'}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-xs text-slate-500 dark:text-slate-400">
                      {tr.notes || '-'}
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
