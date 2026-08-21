'use client'

import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/lib/db'
import { format } from 'date-fns'
import { ar } from 'date-fns/locale'
import Link from 'next/link'
import { Plus, Search, FileText, ShoppingBag, ArrowUpRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useStore } from '@/lib/store-context'
import { DEFAULT_STORE_UUID } from '@/lib/sync-engine'

export default function PurchasesPage() {
  const { storeId } = useStore()
  const currentStoreId = storeId || DEFAULT_STORE_UUID
  const [searchTerm, setSearchTerm] = useState('')

  const purchases = useLiveQuery(
    () => db.purchases.where('store_id').equals(currentStoreId).reverse().sortBy('created_at'),
    [currentStoreId]
  )

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'received':
        return <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">مستلمة</span>
      case 'draft':
        return <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">مسودة</span>
      case 'cancelled':
        return <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">ملغاة</span>
      default:
        return <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">{status}</span>
    }
  }

  const getPaymentStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">مدفوعة</span>
      case 'partial':
        return <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">مدفوعة جزئياً</span>
      case 'unpaid':
        return <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">غير مدفوعة</span>
      default:
        return <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">{status}</span>
    }
  }

  const filteredPurchases = purchases?.filter(p => 
    p.purchase_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.supplier_name && p.supplier_name.toLowerCase().includes(searchTerm.toLowerCase()))
  )

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-sm transition-colors">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950/50 border border-amber-100 dark:border-amber-800/60 flex items-center justify-center text-amber-600 dark:text-amber-400 shadow-xs">
            <ShoppingBag className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
              المشتريات
            </h1>
            <p className="text-xs sm:text-sm font-semibold text-slate-500 dark:text-slate-400 mt-0.5">
              إدارة فواتير المشتريات والشركات الموردة
            </p>
          </div>
        </div>

        <Link href="/dashboard/purchases/new">
          <Button size="lg" className="w-full sm:w-auto h-12 px-6 text-sm font-black bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-xl shadow-md shadow-blue-600/25 hover:shadow-lg hover:shadow-blue-600/35 hover:-translate-y-0.5 active:scale-95 transition-all duration-200">
            <Plus className="w-5 h-5 ml-2" />
            فاتورة مشتريات جديدة
          </Button>
        </Link>
      </div>

      {/* Search Bar */}
      <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-sm flex items-center transition-colors">
        <div className="relative w-full max-w-md">
          <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 w-5 h-5 pointer-events-none" />
          <Input 
            placeholder="بحث برقم الفاتورة أو اسم المورد..."
            className="pr-12 h-12 text-sm text-slate-900 dark:text-slate-100 bg-slate-50/80 dark:bg-slate-800/80 border-slate-200/90 dark:border-slate-700 rounded-xl focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium placeholder:text-slate-400 dark:placeholder:text-slate-500"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Purchases Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-sm overflow-hidden transition-colors">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-right border-collapse">
            <thead className="bg-slate-50/90 dark:bg-slate-800/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-extrabold text-xs tracking-wider">
              <tr>
                <th className="py-4 px-6 font-black">رقم الفاتورة</th>
                <th className="py-4 px-6 font-black">المورد</th>
                <th className="py-4 px-6 font-black">التاريخ</th>
                <th className="py-4 px-6 font-black">الإجمالي</th>
                <th className="py-4 px-6 font-black">المدفوع</th>
                <th className="py-4 px-6 font-black text-center">حالة الفاتورة</th>
                <th className="py-4 px-6 font-black text-center">حالة الدفع</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 bg-white dark:bg-slate-900">
              {!filteredPurchases || filteredPurchases.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-20 text-center">
                    <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center mx-auto mb-4 text-slate-400 dark:text-slate-500">
                      <FileText className="w-8 h-8 opacity-60" />
                    </div>
                    <p className="text-base font-black text-slate-800 dark:text-slate-200">لا توجد فواتير مشتريات مسجلة</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
                      سجل فواتير توريد البضائع لزيادة المخزون تلقائياً
                    </p>
                    <div className="mt-5">
                      <Link href="/dashboard/purchases/new">
                        <Button size="sm" className="h-10 px-5 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-xs">
                          <Plus className="w-4 h-4 ml-1.5" />
                          إضافة فاتورة شراء
                        </Button>
                      </Link>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredPurchases.map(p => (
                  <tr 
                    key={p.id}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/60 transition-colors duration-150"
                  >
                    <td className="py-4 px-6 font-mono font-extrabold text-sm text-blue-600 dark:text-blue-400">
                      {p.purchase_number}
                    </td>
                    <td className="py-4 px-6 font-bold text-slate-900 dark:text-slate-100 text-sm">
                      {p.supplier_name || 'مورد عام'}
                    </td>
                    <td className="py-4 px-6 text-xs text-slate-500 dark:text-slate-400 font-medium">
                      {format(new Date(p.created_at), 'PPP', { locale: ar })}
                    </td>
                    <td className="py-4 px-6 font-black text-slate-900 dark:text-slate-100 font-mono text-base">
                      {(p.total || 0).toFixed(2)} <span className="text-xs font-bold text-slate-400">ج.م</span>
                    </td>
                    <td className="py-4 px-6 font-bold text-emerald-600 dark:text-emerald-400 font-mono text-sm">
                      {(p.paid_amount || 0).toFixed(2)} <span className="text-[10px] text-slate-400">ج.م</span>
                    </td>
                    <td className="py-4 px-6 text-center">
                      {getStatusBadge(p.status)}
                    </td>
                    <td className="py-4 px-6 text-center">
                      {getPaymentStatusBadge(p.payment_status || 'unpaid')}
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
