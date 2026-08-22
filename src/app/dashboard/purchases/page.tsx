'use client'

import React, { useState, useMemo } from 'react'
import Link from 'next/link'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/lib/db'
import { 
  Plus, Search, ShoppingBag, ArrowUpRight, Building2, Calendar,
  CreditCard, Banknote, Eye, Printer, X, FileSpreadsheet,
  SlidersHorizontal, ChevronDown, ChevronUp, ChevronLeft, ChevronRight,
  ChevronsLeft, ChevronsRight, LayoutGrid, LayoutList, Undo2,
  TrendingDown, CheckCircle2, Clock, AlertCircle
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useStore } from '@/lib/store-context'
import { DEFAULT_STORE_UUID } from '@/lib/sync-engine'
import { toast } from 'sonner'

type TableDensity = 'compact' | 'comfortable'

// CSV Export utility
function exportPurchasesToCSV(data: any[], filename: string) {
  if (data.length === 0) { toast.error('لا توجد مشتريات للتصدير'); return }
  const headers = ['رقم الفاتورة', 'تاريخ الشراء', 'المورد', 'الإجمالي', 'المدفوع', 'المستحق', 'حالة الاستلام', 'حالة السداد']
  const rows = data.map(p => [
    p.purchase_number,
    new Date(p.purchase_date || p.created_at).toLocaleDateString('ar-EG'),
    p.supplier_name || 'مورد عام',
    p.total?.toFixed(2) || '0',
    p.paid_amount?.toFixed(2) || '0',
    p.due_amount?.toFixed(2) || '0',
    p.status === 'received' ? 'مستلمة' : p.status,
    p.payment_status === 'paid' ? 'مدفوعة' : p.payment_status === 'partial' ? 'جزئي' : 'غير مدفوعة'
  ])
  const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n')
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = `${filename}_${new Date().toISOString().slice(0,10)}.csv`
  link.click()
  toast.success('تم تصدير سجل المشتريات بنجاح')
}

export default function PurchasesPage() {
  const { storeId } = useStore()
  const currentStoreId = storeId || DEFAULT_STORE_UUID

  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [paymentFilter, setPaymentFilter] = useState<string>('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [rowsPerPage, setRowsPerPage] = useState(25)
  const [density, setDensity] = useState<TableDensity>('comfortable')

  const purchases = useLiveQuery(
    () => db.purchases.where('store_id').equals(currentStoreId).reverse().sortBy('created_at'),
    [currentStoreId]
  ) || []

  // Computed Stats
  const stats = useMemo(() => {
    let totalPurchases = 0
    let paidTotal = 0
    let dueTotal = 0
    let receivedCount = 0

    purchases.forEach(p => {
      totalPurchases += Number(p.total) || 0
      paidTotal += Number(p.paid_amount) || 0
      dueTotal += Number(p.due_amount) || 0
      if (p.status === 'received') receivedCount++
    })

    return { totalPurchases, paidTotal, dueTotal, count: purchases.length, receivedCount }
  }, [purchases])

  const filteredPurchases = useMemo(() => {
    let list = [...purchases]
    if (searchTerm) {
      const q = searchTerm.toLowerCase()
      list = list.filter(p =>
        p.purchase_number.toLowerCase().includes(q) ||
        (p.supplier_name && p.supplier_name.toLowerCase().includes(q))
      )
    }
    if (statusFilter !== 'all') {
      list = list.filter(p => p.status === statusFilter)
    }
    if (paymentFilter !== 'all') {
      list = list.filter(p => p.payment_status === paymentFilter)
    }
    return list
  }, [purchases, searchTerm, statusFilter, paymentFilter])

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredPurchases.length / rowsPerPage))
  const paginatedPurchases = filteredPurchases.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage)
  const startIndex = (currentPage - 1) * rowsPerPage + 1
  const endIndex = Math.min(currentPage * rowsPerPage, filteredPurchases.length)

  const resetPage = () => setCurrentPage(1)

  const py = density === 'compact' ? 'py-2.5' : 'py-3.5'
  const textSize = density === 'compact' ? 'text-xs' : 'text-sm'

  // Sidebar tools
  const sidebarTools = [
    { label: 'فاتورة شراء جديدة', icon: Plus, href: '/dashboard/purchases/new', color: 'text-blue-400', bg: 'bg-blue-500/15 border-blue-500/30' },
    { label: 'مرتجع المشتريات', icon: Undo2, href: '/dashboard/purchase-returns', color: 'text-rose-400', bg: 'bg-rose-500/15 border-rose-500/30' },
    { label: 'دليل الموردين', icon: Building2, href: '/dashboard/suppliers', color: 'text-emerald-400', bg: 'bg-emerald-500/15 border-emerald-500/30' },
    { label: 'المصروفات اليومية', icon: Banknote, href: '/dashboard/expenses', color: 'text-amber-400', bg: 'bg-amber-500/15 border-amber-500/30' },
  ]

  return (
    <div className="flex gap-0 h-[calc(100vh-5rem)] overflow-hidden select-none" dir="rtl">
      {/* ═══════ Main Content Area ═══════ */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">

        {/* ── Row 1: Header + Action ── */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white dark:bg-slate-900 p-4 sm:p-5 border-b border-slate-200/90 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-blue-50 dark:bg-blue-950/50 border border-blue-100 dark:border-blue-800/60 flex items-center justify-center text-blue-600 dark:text-blue-400 shadow-xs">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                المشتريات وفواتير الموردين
              </h1>
              <p className="text-[11px] sm:text-xs font-semibold text-slate-500 dark:text-slate-400">
                إدارة أوامر الشراء، استلام البضائع من الشركات والموردين، وتتبع الذمم الدائنة
              </p>
            </div>
          </div>
          <Link href="/dashboard/purchases/new">
            <Button size="lg" className="h-11 px-5 text-xs font-black bg-blue-600 hover:bg-blue-500 text-white rounded-xl shadow-md shadow-blue-600/25 active:scale-95 transition-all">
              <Plus className="w-4 h-4 ml-1.5" />
              فاتورة شراء جديدة
            </Button>
          </Link>
        </div>

        {/* ── Row 2: KPI Stats Cards ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 p-4 sm:p-5 bg-slate-50/50 dark:bg-slate-950/50 border-b border-slate-200/60 dark:border-slate-800/60 shrink-0">
          {/* Total Purchases */}
          <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <div className="w-10 h-10 rounded-xl bg-blue-500/15 border border-blue-500/25 flex items-center justify-center text-blue-500">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div className="text-right">
              <p className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white leading-none font-mono">
                {stats.totalPurchases.toFixed(2)} <span className="text-xs font-normal">ج.م</span>
              </p>
              <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mt-0.5">إجمالي المشتريات</p>
            </div>
          </div>

          {/* Invoices Count */}
          <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/15 border border-indigo-500/25 flex items-center justify-center text-indigo-500">
              <Calendar className="w-5 h-5" />
            </div>
            <div className="text-right">
              <p className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white leading-none font-mono">
                {stats.count} <span className="text-xs font-normal">فاتورة</span>
              </p>
              <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mt-0.5">عدد الفواتير</p>
            </div>
          </div>

          {/* Paid Total */}
          <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center text-emerald-500">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div className="text-right">
              <p className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white leading-none font-mono">
                {stats.paidTotal.toFixed(2)} <span className="text-xs font-normal">ج.م</span>
              </p>
              <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mt-0.5">المدفوع للموردين</p>
            </div>
          </div>

          {/* Due Total */}
          <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <div className="w-10 h-10 rounded-xl bg-rose-500/15 border border-rose-500/25 flex items-center justify-center text-rose-500">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div className="text-right">
              <p className="text-xl sm:text-2xl font-black text-rose-600 dark:text-rose-400 leading-none font-mono">
                {stats.dueTotal.toFixed(2)} <span className="text-xs font-normal">ج.م</span>
              </p>
              <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mt-0.5">مستحقات آجلة للموردين</p>
            </div>
          </div>
        </div>

        {/* ── Row 3: Search + Filters ── */}
        <div className="bg-white dark:bg-slate-900 px-4 sm:px-5 py-3 border-b border-slate-200/60 dark:border-slate-800/60 flex flex-col md:flex-row gap-3 items-center shrink-0">
          <div className="relative flex-1 w-full">
            <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 w-4 h-4 pointer-events-none" />
            <Input
              type="text"
              placeholder="بحث برقم الفاتورة، أو اسم المورد..."
              className="pr-10 h-10 text-xs bg-slate-50/80 dark:bg-slate-800/80 rounded-xl font-bold"
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); resetPage() }}
            />
          </div>

          <div className="w-full md:w-40 shrink-0">
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); resetPage() }}>
              <SelectTrigger className="h-10 text-xs font-bold bg-slate-50/80 dark:bg-slate-800/80 rounded-xl">
                <SelectValue placeholder="حالة الاستلام" />
              </SelectTrigger>
              <SelectContent className="rounded-xl dark:bg-slate-900">
                <SelectItem value="all">جميع الحالات</SelectItem>
                <SelectItem value="received">مستلمة</SelectItem>
                <SelectItem value="draft">مسودة</SelectItem>
                <SelectItem value="cancelled">ملغاة</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="w-full md:w-40 shrink-0">
            <Select value={paymentFilter} onValueChange={(v) => { setPaymentFilter(v); resetPage() }}>
              <SelectTrigger className="h-10 text-xs font-bold bg-slate-50/80 dark:bg-slate-800/80 rounded-xl">
                <SelectValue placeholder="حالة السداد" />
              </SelectTrigger>
              <SelectContent className="rounded-xl dark:bg-slate-900">
                <SelectItem value="all">جميع حالات السداد</SelectItem>
                <SelectItem value="paid">مدفوعة</SelectItem>
                <SelectItem value="partial">مدفوعة جزئياً</SelectItem>
                <SelectItem value="unpaid">غير مدفوعة</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* ── Row 4: Table Toolbar ── */}
        <div className="bg-white dark:bg-slate-900 px-4 sm:px-5 py-2.5 border-b border-slate-200/60 dark:border-slate-800/60 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => exportPurchasesToCSV(filteredPurchases, 'purchases_report')}
              className="w-8 h-8 rounded-lg bg-slate-50 hover:bg-emerald-50 dark:bg-slate-800 dark:hover:bg-emerald-950/40 text-slate-500 hover:text-emerald-600 flex items-center justify-center transition-all cursor-pointer active:scale-95"
              title="تصدير CSV"
            >
              <FileSpreadsheet className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="w-8 h-8 rounded-lg bg-slate-50 hover:bg-blue-50 dark:bg-slate-800 dark:hover:bg-blue-950/40 text-slate-500 hover:text-blue-600 flex items-center justify-center transition-all cursor-pointer active:scale-95"
              title="طباعة"
            >
              <Printer className="w-4 h-4" />
            </button>
            <div className="w-px h-5 bg-slate-200 dark:bg-slate-700 mx-1" />
            <button
              type="button"
              onClick={() => setDensity(density === 'compact' ? 'comfortable' : 'compact')}
              className="w-8 h-8 rounded-lg bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 flex items-center justify-center transition-all cursor-pointer active:scale-95"
              title={density === 'compact' ? 'عرض مريح' : 'عرض مضغوط'}
            >
              {density === 'compact' ? <LayoutGrid className="w-4 h-4" /> : <LayoutList className="w-4 h-4" />}
            </button>
          </div>

          <div className="hidden sm:flex items-center gap-2 text-[11px] font-bold text-slate-500 dark:text-slate-400">
            <ShoppingBag className="w-3.5 h-3.5" />
            {filteredPurchases.length > 0 ? (
              <span>عرض {startIndex} إلى {endIndex} من إجمالي <strong className="text-slate-900 dark:text-white">{filteredPurchases.length}</strong> فاتورة</span>
            ) : (
              <span>لا توجد فواتير</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-slate-500 hidden sm:inline">عرض</span>
            <Select value={rowsPerPage.toString()} onValueChange={(v) => { setRowsPerPage(Number(v)); resetPage() }}>
              <SelectTrigger className="h-8 w-16 text-[11px] font-bold bg-slate-50 dark:bg-slate-800 rounded-lg">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-lg dark:bg-slate-900 min-w-[60px]">
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="25">25</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-[10px] font-bold text-slate-500 hidden sm:inline">إدخالات</span>
          </div>
        </div>

        {/* ── Row 5: Table ── */}
        <div className="flex-1 overflow-auto bg-white dark:bg-slate-900">
          <table className="w-full text-right border-collapse min-w-[850px]">
            <thead className="bg-slate-50/90 dark:bg-slate-800/90 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 sticky top-0 z-10">
              <tr>
                <th className={`${py} px-4 font-black text-[11px]`}>رقم الفاتورة</th>
                <th className={`${py} px-4 font-black text-[11px]`}>تاريخ الشراء</th>
                <th className={`${py} px-4 font-black text-[11px]`}>المورد</th>
                <th className={`${py} px-4 font-black text-[11px]`}>إجمالي الفاتورة</th>
                <th className={`${py} px-4 font-black text-[11px]`}>المدفوع</th>
                <th className={`${py} px-4 font-black text-[11px]`}>المستحق (الآجل)</th>
                <th className={`${py} px-4 font-black text-[11px] text-center`}>حالة الاستلام</th>
                <th className={`${py} px-4 font-black text-[11px] text-center`}>حالة السداد</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {paginatedPurchases.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center">
                    <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center mx-auto mb-3 text-slate-400">
                      <ShoppingBag className="w-7 h-7 opacity-50" />
                    </div>
                    <p className="text-sm font-black text-slate-800 dark:text-slate-200">لا توجد فواتير مشتريات مطابقة</p>
                    <div className="mt-4">
                      <Link href="/dashboard/purchases/new">
                        <Button size="sm" className="h-9 px-4 text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white rounded-xl">
                          <Plus className="w-3.5 h-3.5 ml-1.5" />
                          إضافة أول فاتورة شراء
                        </Button>
                      </Link>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedPurchases.map(p => (
                  <tr key={p.id} className="hover:bg-blue-50/40 dark:hover:bg-slate-800/40 transition-colors duration-100">
                    <td className={`${py} px-4 font-mono font-black text-blue-600 dark:text-blue-400 text-xs`}>
                      {p.purchase_number}
                    </td>
                    <td className={`${py} px-4 text-[11px] text-slate-600 dark:text-slate-400 font-medium`}>
                      {new Date(p.purchase_date || p.created_at).toLocaleDateString('ar-EG')}
                    </td>
                    <td className={`${py} px-4 font-bold text-slate-800 dark:text-slate-200 text-xs`}>
                      {p.supplier_name || 'مورد عام'}
                    </td>
                    <td className={`${py} px-4 font-mono font-black text-slate-900 dark:text-white ${textSize}`}>
                      {Number(p.total).toFixed(2)} <span className="text-[9px] font-medium text-slate-400">ج.م</span>
                    </td>
                    <td className={`${py} px-4 font-mono font-bold text-emerald-600 dark:text-emerald-400 text-xs`}>
                      {Number(p.paid_amount || 0).toFixed(2)} <span className="text-[9px] font-medium text-slate-400">ج.م</span>
                    </td>
                    <td className={`${py} px-4 font-mono font-bold text-rose-600 dark:text-rose-400 text-xs`}>
                      {Number(p.due_amount || 0).toFixed(2)} <span className="text-[9px] font-medium text-slate-400">ج.م</span>
                    </td>
                    <td className={`${py} px-4 text-center`}>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                        p.status === 'received'
                          ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-300 border-emerald-500/30'
                          : 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-300 border-amber-500/30'
                      }`}>
                        {p.status === 'received' ? 'مستلمة' : p.status === 'draft' ? 'مسودة' : p.status}
                      </span>
                    </td>
                    <td className={`${py} px-4 text-center`}>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                        p.payment_status === 'paid'
                          ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                          : p.payment_status === 'partial'
                            ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30'
                            : 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30'
                      }`}>
                        {p.payment_status === 'paid' ? 'مدفوعة' : p.payment_status === 'partial' ? 'جزئي' : 'غير مدفوعة'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* ── Row 6: Pagination ── */}
        {filteredPurchases.length > 0 && (
          <div className="bg-white dark:bg-slate-900 px-4 sm:px-5 py-3 border-t border-slate-200/90 dark:border-slate-800 flex items-center justify-between shrink-0">
            <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
              عرض {startIndex} إلى {endIndex} من إجمالي {filteredPurchases.length} فاتورة
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(1)}
                className="w-8 h-8 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-500 flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-700 transition-all cursor-pointer active:scale-95"
              >
                <ChevronsRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                className="w-8 h-8 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-500 flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-700 transition-all cursor-pointer active:scale-95"
              >
                <ChevronRight className="w-4 h-4" />
              </button>

              <span className="px-3 h-8 rounded-lg bg-blue-600 text-white text-xs font-black flex items-center justify-center min-w-[32px]">
                {currentPage}
              </span>

              <button
                type="button"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                className="w-8 h-8 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-500 flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-700 transition-all cursor-pointer active:scale-95"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(totalPages)}
                className="w-8 h-8 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-500 flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-700 transition-all cursor-pointer active:scale-95"
              >
                <ChevronsLeft className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ═══════ Sidebar Tools Panel ═══════ */}
      <aside className="hidden xl:flex flex-col w-56 bg-white dark:bg-slate-900 border-r border-slate-200/90 dark:border-slate-800 shrink-0 overflow-y-auto">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800">
          <h3 className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-1.5">
            <ShoppingBag className="w-3.5 h-3.5 text-blue-500" />
            أدوات المشتريات
          </h3>
        </div>

        <nav className="flex-1 p-3 space-y-1.5">
          {sidebarTools.map((tool, i) => {
            const Icon = tool.icon
            return (
              <Link key={i} href={tool.href}>
                <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors cursor-pointer group active:scale-[0.97]">
                  <div className={`w-8 h-8 rounded-lg ${tool.bg} border flex items-center justify-center ${tool.color} shrink-0`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">
                    {tool.label}
                  </span>
                </div>
              </Link>
            )
          })}
        </nav>
      </aside>
    </div>
  )
}
