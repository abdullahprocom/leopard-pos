'use client'

import React, { useState, useMemo } from 'react'
import Link from 'next/link'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/lib/db'
import { 
  Plus, Search, ShoppingCart, Receipt, Calendar, CreditCard, 
  Banknote, Eye, Printer, X, Scale, FileSpreadsheet, RotateCcw,
  SlidersHorizontal, ChevronDown, ChevronUp, ChevronLeft, ChevronRight,
  ChevronsLeft, ChevronsRight, LayoutGrid, LayoutList, Undo2,
  FileText, Users, DollarSign, BarChart3, TrendingUp, CheckCircle2,
  Clock, ArrowUpRight
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ThermalReceipt } from '../pos/receipt'
import { useStore } from '@/lib/store-context'
import { DEFAULT_STORE_UUID } from '@/lib/sync-engine'
import { toast } from 'sonner'

type SalesQuickFilter = 'all' | 'today' | 'week' | 'month' | 'cash' | 'card'
type TableDensity = 'compact' | 'comfortable'

// CSV Export utility
function exportSalesToCSV(data: any[], filename: string) {
  if (data.length === 0) { toast.error('لا توجد مبيعات للتصدير'); return }
  const headers = ['رقم الفاتورة', 'تاريخ ووقت البيع', 'اسم العميل', 'عدد الأصناف', 'طريقة الدفع', 'الإجمالي', 'المدفوع', 'المتبقي', 'الحالة']
  const rows = data.map(sale => [
    sale.invoice_number,
    new Date(sale.created_at || sale.sale_date).toLocaleString('ar-EG'),
    sale.customer_name || 'عميل نقدي',
    sale.lines?.length || 0,
    sale.payment_method === 'cash' ? 'نقدي' : sale.payment_method === 'card' ? 'بطاقة/شبكة' : 'تحويل',
    sale.total?.toFixed(2) || '0',
    sale.paid_amount?.toFixed(2) || '0',
    sale.due_amount?.toFixed(2) || '0',
    sale.status === 'invoice' ? 'مكتملة' : sale.status
  ])
  const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n')
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = `${filename}_${new Date().toISOString().slice(0,10)}.csv`
  link.click()
  toast.success('تم تصدير سجل المبيعات بنجاح')
}

export default function SalesListPage() {
  const { storeId, storeName } = useStore()
  const currentStoreId = storeId || DEFAULT_STORE_UUID

  // ─── Filter & Search State ───
  const [searchTerm, setSearchTerm] = useState('')
  const [quickFilter, setQuickFilter] = useState<SalesQuickFilter>('all')
  const [paymentFilter, setPaymentFilter] = useState<string>('all')
  const [selectedSale, setSelectedSale] = useState<any>(null)
  const [isThermalModalOpen, setIsThermalModalOpen] = useState(false)

  // ─── Table State ───
  const [currentPage, setCurrentPage] = useState(1)
  const [rowsPerPage, setRowsPerPage] = useState(25)
  const [density, setDensity] = useState<TableDensity>('comfortable')

  // Fetch sales and sale lines strictly for current store
  const salesData = useLiveQuery(async () => {
    const salesList = await db.sales.where('store_id').equals(currentStoreId).reverse().sortBy('created_at')
    const allLines = await db.sale_lines.where('store_id').equals(currentStoreId).toArray()

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
  }, [currentStoreId]) || []

  // ─── Computed Statistics ───
  const stats = useMemo(() => {
    const now = new Date()
    const todayStr = now.toISOString().slice(0, 10)
    
    let totalRevenue = 0
    let totalInvoices = salesData.length
    let totalCash = 0
    let totalCard = 0
    let todaySales = 0

    salesData.forEach(s => {
      const amt = Number(s.total) || 0
      totalRevenue += amt
      if (s.payment_method === 'cash') totalCash += amt
      if (s.payment_method === 'card') totalCard += amt
      
      const sDate = (s.created_at || s.sale_date || '').slice(0, 10)
      if (sDate === todayStr) todaySales += amt
    })

    return { totalRevenue, totalInvoices, totalCash, totalCard, todaySales }
  }, [salesData])

  // ─── Filtered Data ───
  const filteredSales = useMemo(() => {
    let list = [...salesData]
    const now = new Date()

    // Quick Filter by Date / Type
    if (quickFilter === 'today') {
      const todayStr = now.toISOString().slice(0, 10)
      list = list.filter(s => (s.created_at || s.sale_date || '').slice(0, 10) === todayStr)
    } else if (quickFilter === 'week') {
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      list = list.filter(s => new Date(s.created_at || s.sale_date) >= weekAgo)
    } else if (quickFilter === 'month') {
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      list = list.filter(s => new Date(s.created_at || s.sale_date) >= monthAgo)
    } else if (quickFilter === 'cash') {
      list = list.filter(s => s.payment_method === 'cash')
    } else if (quickFilter === 'card') {
      list = list.filter(s => s.payment_method === 'card')
    }

    // Payment Filter
    if (paymentFilter !== 'all') {
      list = list.filter(s => s.payment_method === paymentFilter)
    }

    // Search query
    if (searchTerm) {
      const q = searchTerm.toLowerCase()
      list = list.filter(s =>
        (s.invoice_number || '').toLowerCase().includes(q) ||
        (s.customer_name || '').toLowerCase().includes(q) ||
        s.lines.some((l: any) => (l.item_name || '').toLowerCase().includes(q))
      )
    }

    return list
  }, [salesData, quickFilter, paymentFilter, searchTerm])

  // ─── Pagination ───
  const totalPages = Math.max(1, Math.ceil(filteredSales.length / rowsPerPage))
  const paginatedSales = filteredSales.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage)
  const startIndex = (currentPage - 1) * rowsPerPage + 1
  const endIndex = Math.min(currentPage * rowsPerPage, filteredSales.length)

  const resetPage = () => setCurrentPage(1)

  const handlePrint = (sale: any) => {
    setSelectedSale(sale)
    setTimeout(() => {
      window.print()
    }, 200)
  }

  const handleViewThermal = (sale: any) => {
    setSelectedSale(sale)
    setIsThermalModalOpen(true)
  }

  const py = density === 'compact' ? 'py-2.5' : 'py-3.5'
  const textSize = density === 'compact' ? 'text-xs' : 'text-sm'

  // ─── Sidebar Tools ───
  const sidebarTools = [
    { label: 'نقطة البيع (الكاشير)', icon: ShoppingCart, href: '/dashboard/pos', color: 'text-blue-400', bg: 'bg-blue-500/15 border-blue-500/30' },
    { label: 'مرتجع المبيعات', icon: Undo2, href: '/dashboard/sales-returns', color: 'text-rose-400', bg: 'bg-rose-500/15 border-rose-500/30' },
    { label: 'عروض الأسعار', icon: FileText, href: '/dashboard/quotations', color: 'text-amber-400', bg: 'bg-amber-500/15 border-amber-500/30' },
    { label: 'دليل العملاء', icon: Users, href: '/dashboard/customers', color: 'text-purple-400', bg: 'bg-purple-500/15 border-purple-500/30' },
    { label: 'تقارير الأرباح والمبيعات', icon: BarChart3, href: '/dashboard/reports', color: 'text-emerald-400', bg: 'bg-emerald-500/15 border-emerald-500/30' },
  ]

  return (
    <div className="flex gap-0 h-[calc(100vh-5rem)] overflow-hidden select-none" dir="rtl">
      {/* ═══════ Main Content Area ═══════ */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">

        {/* ── Row 1: Header + Action ── */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white dark:bg-slate-900 p-4 sm:p-5 border-b border-slate-200/90 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-blue-50 dark:bg-blue-950/50 border border-blue-100 dark:border-blue-800/60 flex items-center justify-center text-blue-600 dark:text-blue-400 shadow-xs">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                سجل فواتير المبيعات
              </h1>
              <p className="text-[11px] sm:text-xs font-semibold text-slate-500 dark:text-slate-400">
                متابعة كافة فواتير المبيعات الصادرة من الكاشير، طباعة الإيصالات، وتتبع المدفوعات
              </p>
            </div>
          </div>
          <Link href="/dashboard/pos">
            <Button size="lg" className="h-11 px-5 text-xs font-black bg-blue-600 hover:bg-blue-500 text-white rounded-xl shadow-md shadow-blue-600/25 active:scale-95 transition-all">
              <ShoppingCart className="w-4 h-4 ml-1.5" />
              فتح نقطة البيع (الكاشير)
            </Button>
          </Link>
        </div>

        {/* ── Row 2: KPI Stats Cards ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 p-4 sm:p-5 bg-slate-50/50 dark:bg-slate-950/50 border-b border-slate-200/60 dark:border-slate-800/60 shrink-0">
          {/* Total Sales Revenue */}
          <button
            type="button"
            onClick={() => { setQuickFilter('all'); resetPage() }}
            className={`flex items-center gap-3 p-3.5 rounded-2xl border transition-all cursor-pointer active:scale-[0.97] ${
              quickFilter === 'all'
                ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-300 dark:border-blue-700 ring-2 ring-blue-500/20'
                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-blue-300'
            }`}
          >
            <div className="w-10 h-10 rounded-xl bg-blue-500/15 border border-blue-500/25 flex items-center justify-center text-blue-500">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div className="text-right">
              <p className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white leading-none font-mono">
                {stats.totalRevenue.toFixed(2)} <span className="text-xs font-normal">ج.م</span>
              </p>
              <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mt-0.5">إجمالي قيمة المبيعات</p>
            </div>
          </button>

          {/* Today's Sales */}
          <button
            type="button"
            onClick={() => { setQuickFilter('today'); resetPage() }}
            className={`flex items-center gap-3 p-3.5 rounded-2xl border transition-all cursor-pointer active:scale-[0.97] ${
              quickFilter === 'today'
                ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-700 ring-2 ring-emerald-500/20'
                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-emerald-300'
            }`}
          >
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center text-emerald-500">
              <Calendar className="w-5 h-5" />
            </div>
            <div className="text-right">
              <p className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white leading-none font-mono">
                {stats.todaySales.toFixed(2)} <span className="text-xs font-normal">ج.م</span>
              </p>
              <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mt-0.5">مبيعات اليوم</p>
            </div>
          </button>

          {/* Cash Sales */}
          <button
            type="button"
            onClick={() => { setQuickFilter('cash'); resetPage() }}
            className={`flex items-center gap-3 p-3.5 rounded-2xl border transition-all cursor-pointer active:scale-[0.97] ${
              quickFilter === 'cash'
                ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-700 ring-2 ring-amber-500/20'
                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-amber-300'
            }`}
          >
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/25 flex items-center justify-center text-amber-500">
              <Banknote className="w-5 h-5" />
            </div>
            <div className="text-right">
              <p className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white leading-none font-mono">
                {stats.totalCash.toFixed(2)} <span className="text-xs font-normal">ج.م</span>
              </p>
              <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mt-0.5">مدفوعات نقداً (كاش)</p>
            </div>
          </button>

          {/* Card / Electronic Sales */}
          <button
            type="button"
            onClick={() => { setQuickFilter('card'); resetPage() }}
            className={`flex items-center gap-3 p-3.5 rounded-2xl border transition-all cursor-pointer active:scale-[0.97] ${
              quickFilter === 'card'
                ? 'bg-purple-50 dark:bg-purple-950/40 border-purple-300 dark:border-purple-700 ring-2 ring-purple-500/20'
                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-purple-300'
            }`}
          >
            <div className="w-10 h-10 rounded-xl bg-purple-500/15 border border-purple-500/25 flex items-center justify-center text-purple-500">
              <CreditCard className="w-5 h-5" />
            </div>
            <div className="text-right">
              <p className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white leading-none font-mono">
                {stats.totalCard.toFixed(2)} <span className="text-xs font-normal">ج.م</span>
              </p>
              <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mt-0.5">مدفوعات بالبطاقة / شبكة</p>
            </div>
          </button>
        </div>

        {/* ── Row 3: Search + Filters ── */}
        <div className="bg-white dark:bg-slate-900 px-4 sm:px-5 py-3 border-b border-slate-200/60 dark:border-slate-800/60 flex flex-col md:flex-row gap-3 items-center shrink-0">
          <div className="relative flex-1 w-full">
            <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 w-4 h-4 pointer-events-none" />
            <Input
              type="text"
              placeholder="بحث برقم الفاتورة، اسم العميل، أو اسم الصنف المباع..."
              className="pr-10 h-10 text-xs bg-slate-50/80 dark:bg-slate-800/80 rounded-xl font-bold"
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); resetPage() }}
            />
          </div>

          <div className="w-full md:w-44 shrink-0">
            <Select value={paymentFilter} onValueChange={(v) => { setPaymentFilter(v); resetPage() }}>
              <SelectTrigger className="h-10 text-xs font-bold bg-slate-50/80 dark:bg-slate-800/80 rounded-xl">
                <SelectValue placeholder="طريقة الدفع" />
              </SelectTrigger>
              <SelectContent className="rounded-xl shadow-xl dark:bg-slate-900 dark:border-slate-800">
                <SelectItem value="all">جميع طرق الدفع</SelectItem>
                <SelectItem value="cash">💵 نقدي فقط</SelectItem>
                <SelectItem value="card">💳 بطاقة / شبكة</SelectItem>
                <SelectItem value="bank-transfer">🏦 تحويل بنكي</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* ── Row 4: Table Toolbar ── */}
        <div className="bg-white dark:bg-slate-900 px-4 sm:px-5 py-2.5 border-b border-slate-200/60 dark:border-slate-800/60 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => exportSalesToCSV(filteredSales, 'sales_invoices')}
              className="w-8 h-8 rounded-lg bg-slate-50 hover:bg-emerald-50 dark:bg-slate-800 dark:hover:bg-emerald-950/40 text-slate-500 hover:text-emerald-600 dark:text-slate-400 flex items-center justify-center transition-all cursor-pointer active:scale-95"
              title="تصدير CSV"
            >
              <FileSpreadsheet className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="w-8 h-8 rounded-lg bg-slate-50 hover:bg-blue-50 dark:bg-slate-800 dark:hover:bg-blue-950/40 text-slate-500 hover:text-blue-600 dark:text-slate-400 flex items-center justify-center transition-all cursor-pointer active:scale-95"
              title="طباعة"
            >
              <Printer className="w-4 h-4" />
            </button>
            <div className="w-px h-5 bg-slate-200 dark:bg-slate-700 mx-1" />
            <button
              type="button"
              onClick={() => setDensity(density === 'compact' ? 'comfortable' : 'compact')}
              className="w-8 h-8 rounded-lg bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 flex items-center justify-center transition-all cursor-pointer active:scale-95"
              title={density === 'compact' ? 'عرض مريح' : 'عرض مضغوط'}
            >
              {density === 'compact' ? <LayoutGrid className="w-4 h-4" /> : <LayoutList className="w-4 h-4" />}
            </button>
          </div>

          <div className="hidden sm:flex items-center gap-2 text-[11px] font-bold text-slate-500 dark:text-slate-400">
            <Receipt className="w-3.5 h-3.5" />
            {filteredSales.length > 0 ? (
              <span>عرض {startIndex} إلى {endIndex} من إجمالي <strong className="text-slate-900 dark:text-white">{filteredSales.length}</strong> فاتورة</span>
            ) : (
              <span>لا توجد فواتير</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-slate-500 hidden sm:inline">عرض</span>
            <Select value={rowsPerPage.toString()} onValueChange={(v) => { setRowsPerPage(Number(v)); resetPage() }}>
              <SelectTrigger className="h-8 w-16 text-[11px] font-bold bg-slate-50 dark:bg-slate-800 rounded-lg border-slate-200 dark:border-slate-700">
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

        {/* ── Row 5: Scrollable Table ── */}
        <div className="flex-1 overflow-auto bg-white dark:bg-slate-900">
          <table className="w-full text-right border-collapse min-w-[850px]">
            <thead className="bg-slate-50/90 dark:bg-slate-800/90 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 sticky top-0 z-10">
              <tr>
                <th className={`${py} px-4 font-black text-[11px]`}>رقم الفاتورة</th>
                <th className={`${py} px-4 font-black text-[11px]`}>تاريخ ووقت البيع</th>
                <th className={`${py} px-4 font-black text-[11px]`}>العميل</th>
                <th className={`${py} px-4 font-black text-[11px] text-center`}>الأصناف</th>
                <th className={`${py} px-4 font-black text-[11px]`}>طريقة الدفع</th>
                <th className={`${py} px-4 font-black text-[11px]`}>إجمالي الفاتورة</th>
                <th className={`${py} px-4 font-black text-[11px] text-center`}>الحالة</th>
                <th className={`${py} px-4 text-center w-28 font-black text-[11px]`}>خيارات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {paginatedSales.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center">
                    <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center mx-auto mb-3 text-slate-400">
                      <Receipt className="w-7 h-7 opacity-50" />
                    </div>
                    <p className="text-sm font-black text-slate-800 dark:text-slate-200">لا توجد فواتير مبيعات مطابقة</p>
                    <p className="text-xs text-slate-500 mt-1">ابدأ بإجراء أول عملية بيع من خلال نقطة البيع</p>
                    <div className="mt-4">
                      <Link href="/dashboard/pos">
                        <Button size="sm" className="h-9 px-4 text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white rounded-xl">
                          <ShoppingCart className="w-3.5 h-3.5 ml-1.5" />
                          فتح نقطة البيع الآن
                        </Button>
                      </Link>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedSales.map(sale => (
                  <tr
                    key={sale.id}
                    className="hover:bg-blue-50/40 dark:hover:bg-slate-800/40 transition-colors duration-100 group"
                  >
                    {/* Invoice # */}
                    <td className={`${py} px-4 font-mono font-black text-blue-600 dark:text-blue-400 text-xs`}>
                      {sale.invoice_number}
                    </td>

                    {/* Date */}
                    <td className={`${py} px-4 text-[11px] text-slate-600 dark:text-slate-400 font-medium`}>
                      {new Date(sale.created_at || sale.sale_date).toLocaleString('ar-EG', {
                        year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                      })}
                    </td>

                    {/* Customer */}
                    <td className={`${py} px-4 font-bold text-slate-800 dark:text-slate-200 text-xs`}>
                      {sale.customer_name || 'عميل نقدي'}
                    </td>

                    {/* Item count */}
                    <td className={`${py} px-4 text-center`}>
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                        {sale.lines.length} صنف
                      </span>
                    </td>

                    {/* Payment Method */}
                    <td className={`${py} px-4`}>
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-700 dark:text-slate-300">
                        {sale.payment_method === 'cash' ? (
                          <><Banknote className="w-3.5 h-3.5 text-emerald-500" /><span>نقدي</span></>
                        ) : sale.payment_method === 'card' ? (
                          <><CreditCard className="w-3.5 h-3.5 text-blue-500" /><span>بطاقة / شبكة</span></>
                        ) : (
                          <span>{sale.payment_method}</span>
                        )}
                      </span>
                    </td>

                    {/* Total Amount */}
                    <td className={`${py} px-4 font-mono font-black text-slate-900 dark:text-white ${textSize}`}>
                      {Number(sale.total).toFixed(2)} <span className="text-[9px] font-medium text-slate-400">ج.م</span>
                    </td>

                    {/* Status */}
                    <td className={`${py} px-4 text-center`}>
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                        مكتملة
                      </span>
                    </td>

                    {/* Actions */}
                    <td className={`${py} px-4 text-center`}>
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleViewThermal(sale)}
                          className="w-7 h-7 rounded-lg bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/40 dark:hover:bg-blue-900/60 text-blue-600 dark:text-blue-400 flex items-center justify-center transition-all cursor-pointer active:scale-95"
                          title="عرض وطباعة الإيصال الحراري"
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedSale(sale)}
                          className="w-7 h-7 rounded-lg bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center transition-all cursor-pointer active:scale-95"
                          title="معاينة تفاصيل الفاتورة"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* ── Row 6: Pagination Footer ── */}
        {filteredSales.length > 0 && (
          <div className="bg-white dark:bg-slate-900 px-4 sm:px-5 py-3 border-t border-slate-200/90 dark:border-slate-800 flex items-center justify-between shrink-0">
            <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
              عرض {startIndex} إلى {endIndex} من إجمالي {filteredSales.length} فاتورة
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(1)}
                className="w-8 h-8 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-700 transition-all cursor-pointer active:scale-95"
              >
                <ChevronsRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                className="w-8 h-8 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-700 transition-all cursor-pointer active:scale-95"
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
                className="w-8 h-8 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-700 transition-all cursor-pointer active:scale-95"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(totalPages)}
                className="w-8 h-8 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-700 transition-all cursor-pointer active:scale-95"
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
            <Receipt className="w-3.5 h-3.5 text-blue-500" />
            أدوات المبيعات
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

        <div className="p-3 border-t border-slate-100 dark:border-slate-800 mt-auto">
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
            <p className="text-[9px] font-bold text-slate-500 dark:text-slate-400">إجمالي اليوم</p>
            <p className="text-sm font-black text-emerald-600 dark:text-emerald-400 font-mono mt-0.5">
              {stats.todaySales.toFixed(2)} ج.م
            </p>
          </div>
        </div>
      </aside>

      {/* ─── Details Modal ─── */}
      {selectedSale && !isThermalModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-xl overflow-hidden p-6 space-y-5 animate-scaleIn">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/15 border border-blue-500/25 flex items-center justify-center text-blue-500">
                  <Receipt className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">
                    تفاصيل الفاتورة: {selectedSale.invoice_number}
                  </h3>
                  <p className="text-xs text-slate-500">
                    العميل: <strong>{selectedSale.customer_name || 'عميل نقدي'}</strong>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedSale(null)}
                className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-white flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Items List */}
            <div className="max-h-64 overflow-y-auto rounded-2xl border border-slate-100 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800">
              {selectedSale.lines.map((line: any, idx: number) => (
                <div key={idx} className="p-3 flex items-center justify-between text-xs">
                  <div>
                    <p className="font-bold text-slate-800 dark:text-slate-200">{line.item_name}</p>
                    <p className="text-[11px] text-slate-400">{line.quantity} × {Number(line.unit_price).toFixed(2)} ج.م</p>
                  </div>
                  <p className="font-mono font-black text-slate-900 dark:text-white">
                    {Number(line.net_total).toFixed(2)} ج.م
                  </p>
                </div>
              ))}
            </div>

            {/* Total Footer */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 flex items-center justify-between text-sm">
              <span className="font-bold text-slate-600 dark:text-slate-400">إجمالي الفاتورة:</span>
              <span className="text-lg font-mono font-black text-blue-600 dark:text-blue-400">
                {Number(selectedSale.total).toFixed(2)} ج.م
              </span>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => setSelectedSale(null)}
                className="h-10 rounded-xl text-xs font-bold"
              >
                إغلاق
              </Button>
              <Button
                onClick={() => {
                  setIsThermalModalOpen(true)
                }}
                className="h-10 px-5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-black gap-1.5 shadow-md shadow-blue-600/30"
              >
                <Printer className="w-3.5 h-3.5" />
                طباعة إيصال حراري
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Thermal Receipt Modal ─── */}
      {isThermalModalOpen && selectedSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full space-y-4 text-black animate-scaleIn">
            <div className="flex items-center justify-between border-b pb-3">
              <span className="font-bold text-xs">معاينة الإيصال الحراري</span>
              <button
                type="button"
                onClick={() => {
                  setIsThermalModalOpen(false)
                  setSelectedSale(null)
                }}
                className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="max-h-[60vh] overflow-y-auto">
              <ThermalReceipt
                storeName={storeName || 'المتجر'}
                invoiceNumber={selectedSale.invoice_number}
                date={new Date(selectedSale.created_at || selectedSale.sale_date).toLocaleString('ar-EG')}
                customerName={selectedSale.customer_name || 'عميل نقدي'}
                items={selectedSale.lines.map((l: any) => ({
                  name: l.item_name || 'صنف',
                  quantity: Number(l.quantity) || 1,
                  unitPrice: Number(l.unit_price) || 0,
                  total: Number(l.net_total) || 0
                }))}
                subtotal={Number(selectedSale.subtotal) || Number(selectedSale.total) || 0}
                discount={Number(selectedSale.discount_total) || 0}
                tax={Number(selectedSale.tax_total) || 0}
                total={Number(selectedSale.total) || 0}
                paid={Number(selectedSale.paid_amount) || Number(selectedSale.total) || 0}
                change={Number(selectedSale.change_amount) || 0}
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t">
              <Button
                variant="outline"
                onClick={() => {
                  setIsThermalModalOpen(false)
                  setSelectedSale(null)
                }}
                className="h-10 rounded-xl text-xs font-bold"
              >
                إلغاء
              </Button>
              <Button
                onClick={() => window.print()}
                className="h-10 px-5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-black gap-1.5 shadow-md shadow-blue-600/30"
              >
                <Printer className="w-3.5 h-3.5" />
                طباعة الآن
              </Button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
