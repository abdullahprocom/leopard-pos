'use client'

import React, { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/lib/db'
import { useStore } from '@/lib/store-context'
import { useAuth } from '@/lib/auth-context'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { 
  Clock, 
  Wallet, 
  AlertTriangle, 
  CheckCircle2, 
  TrendingUp, 
  TrendingDown, 
  User, 
  Calendar, 
  Search, 
  FileText, 
  ShieldAlert, 
  ArrowUpRight,
  Eye,
  X
} from 'lucide-react'
import { formatCurrency, formatNumber } from '@/lib/finance'
import type { CashierShift } from '@/lib/types'

export default function ShiftsPage() {
  const { storeId } = useStore()
  const { role } = useAuth()
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedShift, setSelectedShift] = useState<CashierShift | null>(null)

  // Protect page: Cashier cannot view shifts audit/reconciliation history
  if (role === 'cashier') {
    return (
      <div className="p-8 text-center" dir="rtl">
        <div className="inline-flex p-4 rounded-2xl bg-amber-500/10 text-amber-500 mb-4">
          <ShieldAlert className="w-10 h-10" />
        </div>
        <h2 className="text-xl font-black text-slate-900 dark:text-white">غير مصرح بالدخول</h2>
        <p className="text-sm text-slate-500 mt-2 font-semibold">
          شاشة مطابقة الورديات والدرج مخصصة للإدارة والمشرفين لمراجعة العجز والزيادة.
        </p>
      </div>
    )
  }

  // Live Query: Fetch all shifts for the current store
  const shifts = useLiveQuery(async () => {
    if (!storeId) return []
    return await db.cashier_shifts
      .where('store_id')
      .equals(storeId)
      .reverse()
      .sortBy('opened_at')
  }, [storeId]) || []

  // Computed summary metrics
  const totalShifts = shifts.length
  const openShifts = shifts.filter(s => s.status === 'open').length
  const deficitShifts = shifts.filter(s => s.status === 'closed' && (s.cash_difference || 0) < -0.01)
  const totalDeficitAmount = deficitShifts.reduce((sum, s) => sum + Math.abs(s.cash_difference || 0), 0)
  const surplusShifts = shifts.filter(s => s.status === 'closed' && (s.cash_difference || 0) > 0.01)
  const totalSurplusAmount = surplusShifts.reduce((sum, s) => sum + (s.cash_difference || 0), 0)

  // Filter shifts by search
  const filteredShifts = shifts.filter(s => {
    if (!searchTerm.trim()) return true
    const q = searchTerm.toLowerCase()
    return (
      (s.cashier_name || '').toLowerCase().includes(q) ||
      (s.shift_number || '').toLowerCase().includes(q) ||
      (s.id || '').toLowerCase().includes(q)
    )
  })

  // Format date helper
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-'
    const d = new Date(dateStr)
    return d.toLocaleDateString('ar-EG', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <div className="space-y-6 p-4 md:p-6" dir="rtl">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-3">
            <Wallet className="w-7 h-7 text-blue-600" />
            إدارة ومطابقة ورديات الكاشير والدرج (Cash Drawer Audit)
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 font-medium">
            متابعة دقيقة للنقدية الفعلية مقابل المتوقعة وكشف العجز والزيادة في كل وردية
          </p>
        </div>

        {/* Search bar */}
        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 absolute right-3.5 top-3.5 text-slate-400" />
          <Input
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="بحث باسم الكاشير أو رقم الوردية..."
            className="pr-10 h-11 bg-white dark:bg-slate-900 rounded-xl font-bold text-xs"
          />
        </div>
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400">إجمالي الورديات</p>
              <h3 className="text-2xl font-black text-slate-900 dark:text-white mt-1 font-mono">{totalShifts}</h3>
              <p className="text-[11px] text-slate-400 mt-0.5">{openShifts} وردية مفتوحة حالياً</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 flex items-center justify-center">
              <Clock className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400">الورديات المفتوحة الآن</p>
              <h3 className="text-2xl font-black text-emerald-600 mt-1 font-mono">{openShifts}</h3>
              <p className="text-[11px] text-emerald-600/80 mt-0.5">جلسات بيع نشطة</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-rose-200 dark:border-rose-900/60 shadow-sm bg-rose-50/20 dark:bg-rose-950/10">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-rose-600 dark:text-rose-400">ورديات بها عجز (Deficit)</p>
              <h3 className="text-2xl font-black text-rose-600 mt-1 font-mono">{deficitShifts.length}</h3>
              <p className="text-[11px] text-rose-500 font-bold mt-0.5 font-mono">-{formatCurrency(totalDeficitAmount)}</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-rose-100 dark:bg-rose-900/40 text-rose-600 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-emerald-200 dark:border-emerald-900/60 shadow-sm bg-emerald-50/20 dark:bg-emerald-950/10">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400">ورديات بها زيادة (Surplus)</p>
              <h3 className="text-2xl font-black text-emerald-600 mt-1 font-mono">{surplusShifts.length}</h3>
              <p className="text-[11px] text-emerald-600 font-bold mt-0.5 font-mono">+{formatCurrency(totalSurplusAmount)}</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 flex items-center justify-center">
              <TrendingUp className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Shifts List Table */}
      <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
        <CardHeader className="border-b border-slate-100 dark:border-slate-800 pb-4">
          <CardTitle className="text-base font-black text-slate-900 dark:text-white">
            سجل الورديات والمطابقات المحاسبية
          </CardTitle>
          <CardDescription className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            يتم احتساب النقدية المتوقعة آلياً ومقارنتها بما أدخله الكاشير عند الإغلاق الأعمى
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {filteredShifts.length === 0 ? (
            <div className="p-12 text-center text-slate-400">
              <Wallet className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm font-bold">لا توجد ورديات مسجلة حتى الآن</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 font-black border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="p-3.5">الوردية</th>
                    <th className="p-3.5">الكاشير</th>
                    <th className="p-3.5">الحالة</th>
                    <th className="p-3.5">وقت الفتح</th>
                    <th className="p-3.5">وقت الإغلاق</th>
                    <th className="p-3.5">بداية الدرج</th>
                    <th className="p-3.5">مبيعات الكاش</th>
                    <th className="p-3.5">المتوقع في الدرج</th>
                    <th className="p-3.5">الفعلي (عد الكاشير)</th>
                    <th className="p-3.5">الفارق (عجز/زيادة)</th>
                    <th className="p-3.5 text-center">التفاصيل</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 font-medium">
                  {filteredShifts.map(s => {
                    const diff = s.cash_difference || 0
                    const isClosed = s.status === 'closed'
                    const isDeficit = isClosed && diff < -0.01
                    const isSurplus = isClosed && diff > 0.01
                    const isBalanced = isClosed && !isDeficit && !isSurplus

                    return (
                      <tr key={s.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="p-3.5 font-mono font-bold text-slate-900 dark:text-white">
                          {s.shift_number || s.id.slice(0, 8)}
                        </td>
                        <td className="p-3.5 font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-slate-400" />
                          {s.cashier_name}
                        </td>
                        <td className="p-3.5">
                          {s.status === 'open' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-black bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                              مفتوحة الآن
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                              مغلقة
                            </span>
                          )}
                        </td>
                        <td className="p-3.5 text-slate-500 dark:text-slate-400 font-mono text-[11px]">
                          {formatDate(s.opened_at)}
                        </td>
                        <td className="p-3.5 text-slate-500 dark:text-slate-400 font-mono text-[11px]">
                          {formatDate(s.closed_at)}
                        </td>
                        <td className="p-3.5 font-mono font-bold text-slate-800 dark:text-slate-200">
                          {formatCurrency(s.opening_balance || 0)}
                        </td>
                        <td className="p-3.5 font-mono font-bold text-slate-800 dark:text-slate-200">
                          {formatCurrency(s.total_cash_sales || 0)}
                        </td>
                        <td className="p-3.5 font-mono font-bold text-blue-600 dark:text-blue-400">
                          {isClosed ? formatCurrency(s.expected_cash || 0) : 'قيد التشغيل...'}
                        </td>
                        <td className="p-3.5 font-mono font-bold text-slate-900 dark:text-white">
                          {isClosed && s.actual_cash !== undefined ? formatCurrency(s.actual_cash) : '-'}
                        </td>
                        <td className="p-3.5">
                          {!isClosed ? (
                            <span className="text-slate-400 text-xs">-</span>
                          ) : isDeficit ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-black bg-rose-50 dark:bg-rose-950/40 text-rose-600 border border-rose-200 dark:border-rose-900 font-mono">
                              <AlertTriangle className="w-3 h-3" />
                              عجز: {formatCurrency(Math.abs(diff))}
                            </span>
                          ) : isSurplus ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-black bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 border border-emerald-200 dark:border-emerald-900 font-mono">
                              <TrendingUp className="w-3 h-3" />
                              زيادة: {formatCurrency(diff)}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-blue-50 dark:bg-blue-950/40 text-blue-600 border border-blue-200 dark:border-blue-900 font-mono">
                              <CheckCircle2 className="w-3 h-3" />
                              مطابق تماماً
                            </span>
                          )}
                        </td>
                        <td className="p-3.5 text-center">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedShift(s)}
                            className="h-8 w-8 p-0 rounded-lg"
                          >
                            <Eye className="w-4 h-4 text-slate-500" />
                          </Button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail Modal for a single shift */}
      {selectedShift && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 w-full max-w-lg shadow-2xl space-y-5 text-right" dir="rtl">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-600" />
                تفاصيل ومطابقة الوردية ({selectedShift.shift_number || selectedShift.id.slice(0, 8)})
              </h3>
              <button
                type="button"
                onClick={() => setSelectedShift(null)}
                className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                <div>
                  <span className="text-slate-400 block">اسم الكاشير:</span>
                  <span className="font-bold text-slate-900 dark:text-white text-sm">{selectedShift.cashier_name}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">الحالة:</span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {selectedShift.status === 'open' ? '🟢 مفتوحة حالياً' : '⚪ مغلقة ومؤمنة'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">تاريخ الفتح:</span>
                  <span className="font-mono text-slate-700 dark:text-slate-300">{formatDate(selectedShift.opened_at)}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">تاريخ الإغلاق:</span>
                  <span className="font-mono text-slate-700 dark:text-slate-300">{formatDate(selectedShift.closed_at)}</span>
                </div>
              </div>

              {/* Financial Breakdown */}
              <div className="space-y-2 p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <h4 className="font-black text-slate-900 dark:text-white text-xs border-b border-slate-100 dark:border-slate-800 pb-2">
                  المعادلة المحاسبية لحركة الدرج
                </h4>
                
                <div className="flex justify-between py-1 border-b border-slate-50 dark:border-slate-800/40">
                  <span className="text-slate-500 font-semibold">رصيد بداية الدرج (Opening Balance):</span>
                  <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                    +{formatCurrency(selectedShift.opening_balance || 0)}
                  </span>
                </div>

                <div className="flex justify-between py-1 border-b border-slate-50 dark:border-slate-800/40">
                  <span className="text-slate-500 font-semibold">إجمالي مبيعات الكاش النقدية:</span>
                  <span className="font-mono font-bold text-emerald-600">
                    +{formatCurrency(selectedShift.total_cash_sales || 0)}
                  </span>
                </div>

                <div className="flex justify-between py-1 border-b border-slate-50 dark:border-slate-800/40">
                  <span className="text-slate-500 font-semibold">مبيعات البطاقات (فيزا/شبكة):</span>
                  <span className="font-mono font-bold text-blue-600">
                    {formatCurrency(selectedShift.total_card_sales || 0)}
                  </span>
                </div>

                <div className="flex justify-between py-1 border-b border-slate-50 dark:border-slate-800/40">
                  <span className="text-slate-500 font-semibold">إجمالي المرتجعات النقدية:</span>
                  <span className="font-mono font-bold text-rose-500">
                    -{formatCurrency(selectedShift.total_cash_returns || 0)}
                  </span>
                </div>

                <div className="flex justify-between py-1 border-b border-slate-50 dark:border-slate-800/40">
                  <span className="text-slate-500 font-semibold">المصروفات النقدية والمسحوبات:</span>
                  <span className="font-mono font-bold text-amber-500">
                    -{formatCurrency(selectedShift.total_expenses || 0)}
                  </span>
                </div>

                <div className="flex justify-between py-2 border-t-2 border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/40 px-2 rounded-xl">
                  <span className="font-black text-slate-900 dark:text-white">النقدية المتوقعة في الدرج:</span>
                  <span className="font-mono font-black text-sm text-blue-600 dark:text-blue-400">
                    {formatCurrency(selectedShift.expected_cash || 0)}
                  </span>
                </div>

                <div className="flex justify-between py-2 bg-slate-50/60 dark:bg-slate-800/40 px-2 rounded-xl">
                  <span className="font-black text-slate-900 dark:text-white">النقدية الفعلية (عد الكاشير):</span>
                  <span className="font-mono font-black text-sm text-slate-900 dark:text-white">
                    {selectedShift.actual_cash !== undefined ? formatCurrency(selectedShift.actual_cash) : '-'}
                  </span>
                </div>

                {selectedShift.status === 'closed' && (
                  <div className={`flex justify-between py-2.5 px-3 rounded-xl font-bold ${
                    (selectedShift.cash_difference || 0) < -0.01 
                      ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 border border-rose-200 dark:border-rose-800' 
                      : (selectedShift.cash_difference || 0) > 0.01 
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 border border-emerald-200 dark:border-emerald-800'
                      : 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 border border-blue-200 dark:border-blue-800'
                  }`}>
                    <span>
                      {(selectedShift.cash_difference || 0) < -0.01 
                        ? 'عجز مالي في الدرج:' 
                        : (selectedShift.cash_difference || 0) > 0.01 
                        ? 'زيادة في الدرج:' 
                        : 'مطابقة تامة:'}
                    </span>
                    <span className="font-mono font-black text-sm">
                      {formatCurrency(Math.abs(selectedShift.cash_difference || 0))}
                    </span>
                  </div>
                )}
              </div>

              {selectedShift.notes && (
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                  <span className="text-slate-400 block text-[11px]">ملاحظات الكاشير عند الإغلاق:</span>
                  <p className="font-medium text-slate-700 dark:text-slate-300 mt-1">{selectedShift.notes}</p>
                </div>
              )}
            </div>

            <Button
              type="button"
              onClick={() => setSelectedShift(null)}
              className="w-full h-11 rounded-xl text-xs font-bold"
            >
              إغلاق النافذة
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
