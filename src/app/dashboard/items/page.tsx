'use client'

import React, { useState, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/lib/db'
import { useStore } from '@/lib/store-context'
import { DEFAULT_STORE_UUID } from '@/lib/sync-engine'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import {
  Plus, Search, Package, PackageSearch, Tag, ArrowUpRight,
  AlertTriangle, PackageX, Clock, TrendingUp,
  Filter, RotateCcw, ChevronDown, ChevronUp,
  Download, Printer, Columns3, LayoutGrid, LayoutList,
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
  Barcode, ClipboardList, PackageCheck, Factory, Layers, FolderTree,
  Bell, Trash2, Edit3, MoreHorizontal, Eye, EyeOff,
  FileSpreadsheet, FileText, SlidersHorizontal,
  Box, Star, ShieldAlert
} from 'lucide-react'
import { toast } from 'sonner'

type QuickFilter = 'all' | 'low_stock' | 'near_expiry' | 'out_of_stock' | 'favorites'
type TableDensity = 'compact' | 'comfortable'

// CSV Export utility
function exportToCSV(data: any[], filename: string) {
  if (data.length === 0) { toast.error('لا توجد بيانات للتصدير'); return }
  const headers = ['اسم المنتج', 'English Name', 'الباركود/SKU', 'التصنيف', 'سعر الشراء', 'سعر البيع', 'المخزون الحالي', 'الوحدة', 'الحالة']
  const rows = data.map(item => [
    item.name, item.name_en || '', item.sku || (item.barcodes?.[0] || ''), item.categoryName || '',
    item.buy_price?.toFixed(2) || '0', item.sell_price?.toFixed(2) || '0',
    item.current_stock?.toString() || '0', item.unit || '', item.status === 'active' ? 'نشط' : 'غير نشط'
  ])
  const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n')
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = `${filename}_${new Date().toISOString().slice(0,10)}.csv`
  link.click()
  toast.success('تم تصدير البيانات بنجاح')
}

export default function ItemsPage() {
  const router = useRouter()
  const { storeId, isPharma, businessType } = useStore()
  const currentStoreId = storeId || DEFAULT_STORE_UUID

  // ─── Search & Filter State ───
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [quickFilter, setQuickFilter] = useState<QuickFilter>('all')
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false)
  const [filterUnit, setFilterUnit] = useState<string>('all')
  const [filterManufacturer, setFilterManufacturer] = useState<string>('all')
  const [filterItemType, setFilterItemType] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [filterAvailableOnly, setFilterAvailableOnly] = useState(false)

  // ─── Table State ───
  const [currentPage, setCurrentPage] = useState(1)
  const [rowsPerPage, setRowsPerPage] = useState(25)
  const [density, setDensity] = useState<TableDensity>('comfortable')
  const [showSidebarTools, setShowSidebarTools] = useState(true)

  // ─── Column Visibility ───
  const [visibleColumns, setVisibleColumns] = useState({
    name: true,
    nameEn: true,
    barcode: true,
    category: true,
    buyPrice: true,
    sellPrice: true,
    stock: true,
    unit: true,
    status: true,
    actions: true,
  })

  // ─── Data Fetching ───
  const categories = useLiveQuery(
    () => db.categories.where('store_id').equals(currentStoreId).sortBy('sort_order'),
    [currentStoreId]
  ) || []

  const rawItemsData = useLiveQuery(async () => {
    const items = await db.items.where('store_id').equals(currentStoreId).sortBy('created_at')
    const stockBalances = await db.stock_balances.where('store_id').equals(currentStoreId).toArray()
    const stockMap = new Map<string, number>()
    stockBalances.forEach(sb => { stockMap.set(sb.item_id, (stockMap.get(sb.item_id) || 0) + sb.quantity) })

    const allBarcodes = await db.item_barcodes.where('store_id').equals(currentStoreId).toArray()
    const barcodeMap = new Map<string, string[]>()
    allBarcodes.forEach(b => {
      if (!barcodeMap.has(b.item_id)) barcodeMap.set(b.item_id, [])
      barcodeMap.get(b.item_id)!.push(b.barcode)
    })

    return items.map(item => ({
      ...item,
      current_stock: stockMap.get(item.id) || 0,
      barcodes: barcodeMap.get(item.id) || [],
      categoryName: categories.find(c => c.id === item.category_id)?.name || '',
    })).reverse()
  }, [currentStoreId, categories]) || []

  // ─── Computed Stats ───
  const stats = useMemo(() => {
    const total = rawItemsData.length
    const lowStock = rawItemsData.filter(i => i.manage_inventory && i.current_stock > 0 && i.current_stock <= (i.low_stock_alert || 0)).length
    const outOfStock = rawItemsData.filter(i => i.manage_inventory !== false && i.current_stock === 0).length
    const now = new Date()
    const nearExpiry = rawItemsData.filter(i => {
      if (!i.expiry_date) return false
      const exp = new Date(i.expiry_date)
      const diffDays = (exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      return diffDays > 0 && diffDays <= 90
    }).length
    return { total, lowStock, outOfStock, nearExpiry }
  }, [rawItemsData])

  // ─── Extract unique values for filters ───
  const uniqueUnits = useMemo(() => [...new Set(rawItemsData.map(i => i.unit).filter(Boolean))], [rawItemsData])
  const uniqueManufacturers = useMemo(() => [...new Set(rawItemsData.map(i => i.manufacturer).filter(Boolean) as string[])], [rawItemsData])

  // ─── Apply all filters ───
  const filteredItems = useMemo(() => {
    let items = [...rawItemsData]

    // Quick Filter
    if (quickFilter === 'low_stock') {
      items = items.filter(i => i.manage_inventory && i.current_stock > 0 && i.current_stock <= (i.low_stock_alert || 0))
    } else if (quickFilter === 'out_of_stock') {
      items = items.filter(i => i.manage_inventory !== false && i.current_stock === 0)
    } else if (quickFilter === 'near_expiry') {
      const now = new Date()
      items = items.filter(i => {
        if (!i.expiry_date) return false
        const diffDays = (new Date(i.expiry_date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
        return diffDays > 0 && diffDays <= 90
      })
    }

    // Search
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      items = items.filter(i =>
        (i.search_text || i.name || '').toLowerCase().includes(q) ||
        (i.name_en || '').toLowerCase().includes(q) ||
        (i.sku || '').toLowerCase().includes(q) ||
        i.barcodes.some(b => b.includes(q))
      )
    }

    // Category
    if (selectedCategory !== 'all') items = items.filter(i => i.category_id === selectedCategory)

    // Advanced Filters
    if (filterUnit !== 'all') items = items.filter(i => i.unit === filterUnit)
    if (filterManufacturer !== 'all') items = items.filter(i => i.manufacturer === filterManufacturer)
    if (filterItemType !== 'all') items = items.filter(i => i.item_type === filterItemType)
    if (filterStatus !== 'all') items = items.filter(i => i.status === filterStatus)
    if (filterAvailableOnly) items = items.filter(i => i.current_stock > 0)

    return items
  }, [rawItemsData, quickFilter, searchQuery, selectedCategory, filterUnit, filterManufacturer, filterItemType, filterStatus, filterAvailableOnly])

  // ─── Pagination ───
  const totalPages = Math.max(1, Math.ceil(filteredItems.length / rowsPerPage))
  const paginatedItems = filteredItems.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage)
  const startIndex = (currentPage - 1) * rowsPerPage + 1
  const endIndex = Math.min(currentPage * rowsPerPage, filteredItems.length)

  // Reset page when filters change
  const resetPage = () => setCurrentPage(1)

  const resetAllFilters = () => {
    setSearchQuery('')
    setSelectedCategory('all')
    setQuickFilter('all')
    setFilterUnit('all')
    setFilterManufacturer('all')
    setFilterItemType('all')
    setFilterStatus('all')
    setFilterAvailableOnly(false)
    resetPage()
  }

  const py = density === 'compact' ? 'py-2.5' : 'py-4'
  const textSize = density === 'compact' ? 'text-xs' : 'text-sm'

  // ─── Sidebar Tools ───
  const sidebarTools = [
    { label: 'إضافة صنف جديد', icon: Plus, href: '/dashboard/items/new', color: 'text-blue-400', bg: 'bg-blue-500/15 border-blue-500/30' },
    { label: 'طباعة الملصقات', icon: Barcode, href: '/dashboard/barcode-print', color: 'text-emerald-400', bg: 'bg-emerald-500/15 border-emerald-500/30' },
    { label: 'تدوين مخزون', icon: ClipboardList, href: '/dashboard/stocktaking/new', color: 'text-amber-400', bg: 'bg-amber-500/15 border-amber-500/30' },
    { label: 'الجرد الفعلي', icon: PackageCheck, href: '/dashboard/stocktaking', color: 'text-purple-400', bg: 'bg-purple-500/15 border-purple-500/30' },
    { label: 'النقل المخزني', icon: Layers, href: '/dashboard/transfers', color: 'text-cyan-400', bg: 'bg-cyan-500/15 border-cyan-500/30' },
    { label: 'تنبيهات الصلاحية', icon: Bell, href: '#', color: 'text-rose-400', bg: 'bg-rose-500/15 border-rose-500/30', onClick: () => { setQuickFilter('near_expiry'); resetPage() } },
    { label: 'التصنيفات والمجموعات', icon: FolderTree, href: '#', color: 'text-indigo-400', bg: 'bg-indigo-500/15 border-indigo-500/30', onClick: () => setShowAdvancedFilters(true) },
    { label: 'أنواع المنتجات', icon: Box, href: '#', color: 'text-teal-400', bg: 'bg-teal-500/15 border-teal-500/30', onClick: () => { setFilterItemType('stocked'); resetPage() } },
  ]

  return (
    <div className="flex gap-0 h-[calc(100vh-5rem)] overflow-hidden select-none" dir="rtl">
      {/* ═══════ Main Content Area ═══════ */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">

        {/* ── Row 1: Header + Add Button ── */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white dark:bg-slate-900 p-4 sm:p-5 border-b border-slate-200/90 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-blue-50 dark:bg-blue-950/50 border border-blue-100 dark:border-blue-800/60 flex items-center justify-center text-blue-600 dark:text-blue-400 shadow-xs">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                قائمة الأصناف والمخزون
              </h1>
              <p className="text-[11px] sm:text-xs font-semibold text-slate-500 dark:text-slate-400">
                إدارة مخزون الأصناف، تنظيم الفئات، والرقابة على أسعار البيع والشراء
              </p>
            </div>
          </div>
          <Link href="/dashboard/items/new">
            <Button size="lg" className="h-11 px-5 text-xs font-black bg-blue-600 hover:bg-blue-500 text-white rounded-xl shadow-md shadow-blue-600/25 active:scale-95 transition-all">
              <Plus className="w-4 h-4 ml-1.5" />
              إضافة صنف جديد
            </Button>
          </Link>
        </div>

        {/* ── Row 2: Stats Cards ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 p-4 sm:p-5 bg-slate-50/50 dark:bg-slate-950/50 border-b border-slate-200/60 dark:border-slate-800/60 shrink-0">
          {/* Total Items */}
          <button
            type="button"
            onClick={() => { setQuickFilter('all'); resetPage() }}
            className={`flex items-center gap-3 p-3.5 rounded-2xl border transition-all cursor-pointer active:scale-[0.97] ${
              quickFilter === 'all'
                ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-300 dark:border-blue-700 ring-2 ring-blue-500/20'
                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-blue-300 dark:hover:border-blue-700'
            }`}
          >
            <div className="w-10 h-10 rounded-xl bg-blue-500/15 border border-blue-500/25 flex items-center justify-center text-blue-500">
              <Package className="w-5 h-5" />
            </div>
            <div className="text-right">
              <p className="text-2xl font-black text-slate-900 dark:text-white leading-none">{stats.total}</p>
              <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mt-0.5">إجمالي الأصناف</p>
            </div>
          </button>

          {/* Low Stock */}
          <button
            type="button"
            onClick={() => { setQuickFilter('low_stock'); resetPage() }}
            className={`flex items-center gap-3 p-3.5 rounded-2xl border transition-all cursor-pointer active:scale-[0.97] ${
              quickFilter === 'low_stock'
                ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-700 ring-2 ring-amber-500/20'
                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-amber-300 dark:hover:border-amber-700'
            }`}
          >
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/25 flex items-center justify-center text-amber-500">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="text-right">
              <p className="text-2xl font-black text-slate-900 dark:text-white leading-none">{stats.lowStock}</p>
              <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mt-0.5">نواقص المخزون</p>
            </div>
          </button>

          {/* Near Expiry */}
          <button
            type="button"
            onClick={() => { setQuickFilter('near_expiry'); resetPage() }}
            className={`flex items-center gap-3 p-3.5 rounded-2xl border transition-all cursor-pointer active:scale-[0.97] ${
              quickFilter === 'near_expiry'
                ? 'bg-orange-50 dark:bg-orange-950/40 border-orange-300 dark:border-orange-700 ring-2 ring-orange-500/20'
                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-orange-300 dark:hover:border-orange-700'
            }`}
          >
            <div className="w-10 h-10 rounded-xl bg-orange-500/15 border border-orange-500/25 flex items-center justify-center text-orange-500">
              <Clock className="w-5 h-5" />
            </div>
            <div className="text-right">
              <p className="text-2xl font-black text-slate-900 dark:text-white leading-none">{stats.nearExpiry}</p>
              <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mt-0.5">قاربت على الانتهاء</p>
            </div>
          </button>

          {/* Out of Stock */}
          <button
            type="button"
            onClick={() => { setQuickFilter('out_of_stock'); resetPage() }}
            className={`flex items-center gap-3 p-3.5 rounded-2xl border transition-all cursor-pointer active:scale-[0.97] ${
              quickFilter === 'out_of_stock'
                ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-700 ring-2 ring-rose-500/20'
                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-rose-300 dark:hover:border-rose-700'
            }`}
          >
            <div className="w-10 h-10 rounded-xl bg-rose-500/15 border border-rose-500/25 flex items-center justify-center text-rose-500">
              <PackageX className="w-5 h-5" />
            </div>
            <div className="text-right">
              <p className="text-2xl font-black text-slate-900 dark:text-white leading-none">{stats.outOfStock}</p>
              <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mt-0.5">خارج المخزون</p>
            </div>
          </button>
        </div>

        {/* ── Row 3: Search + Category Filter + Advanced Toggle ── */}
        <div className="bg-white dark:bg-slate-900 px-4 sm:px-5 py-3 border-b border-slate-200/60 dark:border-slate-800/60 flex flex-col md:flex-row gap-3 items-center shrink-0">
          <div className="relative flex-1 w-full">
            <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 w-4 h-4 pointer-events-none" />
            <Input
              type="text"
              placeholder="ابحث بالاسم، الباركود، أو كود الصنف SKU..."
              className="pr-10 h-10 text-xs bg-slate-50/80 dark:bg-slate-800/80 rounded-xl font-bold"
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); resetPage() }}
            />
          </div>

          <div className="w-full md:w-48 shrink-0">
            <Select value={selectedCategory} onValueChange={(v) => { setSelectedCategory(v); resetPage() }}>
              <SelectTrigger className="h-10 text-xs font-bold bg-slate-50/80 dark:bg-slate-800/80 rounded-xl">
                <SelectValue placeholder="التصنيف" />
              </SelectTrigger>
              <SelectContent className="rounded-xl shadow-xl dark:bg-slate-900 dark:border-slate-800">
                <SelectItem value="all">جميع التصنيفات</SelectItem>
                {categories.map(cat => (
                  <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <button
            type="button"
            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
            className={`flex items-center gap-1.5 h-10 px-4 rounded-xl text-xs font-black border transition-all cursor-pointer active:scale-95 shrink-0 ${
              showAdvancedFilters
                ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border-blue-300 dark:border-blue-700'
                : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-blue-300'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            تصفية متقدمة
            {showAdvancedFilters ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* ── Row 3.5: Advanced Filters (Collapsible) ── */}
        {showAdvancedFilters && (
          <div className="bg-slate-50/80 dark:bg-slate-900/80 px-4 sm:px-5 py-4 border-b border-slate-200/60 dark:border-slate-800/60 shrink-0 animate-in slide-in-from-top-2 duration-200">
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {/* Unit Filter */}
              <div className="space-y-1">
                <Label className="text-[10px] font-bold text-slate-500">الوحدة</Label>
                <Select value={filterUnit} onValueChange={(v) => { setFilterUnit(v); resetPage() }}>
                  <SelectTrigger className="h-9 text-xs font-bold bg-white dark:bg-slate-800 rounded-lg">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl dark:bg-slate-900">
                    <SelectItem value="all">الكل</SelectItem>
                    {uniqueUnits.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {/* Manufacturer */}
              <div className="space-y-1">
                <Label className="text-[10px] font-bold text-slate-500">الماركة / الشركة</Label>
                <Select value={filterManufacturer} onValueChange={(v) => { setFilterManufacturer(v); resetPage() }}>
                  <SelectTrigger className="h-9 text-xs font-bold bg-white dark:bg-slate-800 rounded-lg">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl dark:bg-slate-900">
                    <SelectItem value="all">الكل</SelectItem>
                    {uniqueManufacturers.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {/* Item Type */}
              <div className="space-y-1">
                <Label className="text-[10px] font-bold text-slate-500">نوع الصنف</Label>
                <Select value={filterItemType} onValueChange={(v) => { setFilterItemType(v); resetPage() }}>
                  <SelectTrigger className="h-9 text-xs font-bold bg-white dark:bg-slate-800 rounded-lg">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl dark:bg-slate-900">
                    <SelectItem value="all">الكل</SelectItem>
                    <SelectItem value="stocked">مخزني</SelectItem>
                    <SelectItem value="service">خدمة</SelectItem>
                    <SelectItem value="non-stocked">غير مخزني</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Status */}
              <div className="space-y-1">
                <Label className="text-[10px] font-bold text-slate-500">الحالة</Label>
                <Select value={filterStatus} onValueChange={(v) => { setFilterStatus(v); resetPage() }}>
                  <SelectTrigger className="h-9 text-xs font-bold bg-white dark:bg-slate-800 rounded-lg">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl dark:bg-slate-900">
                    <SelectItem value="all">الكل</SelectItem>
                    <SelectItem value="active">نشط</SelectItem>
                    <SelectItem value="inactive">غير نشط</SelectItem>
                    <SelectItem value="archived">مؤرشف</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Available Only + Reset */}
              <div className="space-y-1">
                <Label className="text-[10px] font-bold text-slate-500">خيارات إضافية</Label>
                <div className="flex items-center gap-2 h-9">
                  <label className="flex items-center gap-1.5 text-[10px] font-bold text-slate-600 dark:text-slate-400 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={filterAvailableOnly}
                      onChange={e => { setFilterAvailableOnly(e.target.checked); resetPage() }}
                      className="rounded border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500"
                    />
                    المتوفرة فقط
                  </label>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 mt-3">
              <Button
                variant="outline"
                size="sm"
                onClick={resetAllFilters}
                className="h-8 text-[10px] font-bold rounded-lg gap-1"
              >
                <RotateCcw className="w-3 h-3" />
                إعادة تعيين
              </Button>
            </div>
          </div>
        )}

        {/* ── Row 4: Table Toolbar ── */}
        <div className="bg-white dark:bg-slate-900 px-4 sm:px-5 py-2.5 border-b border-slate-200/60 dark:border-slate-800/60 flex items-center justify-between shrink-0">
          {/* Left: Export + Print */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => exportToCSV(filteredItems, 'items_export')}
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

          {/* Center: Results Counter */}
          <div className="hidden sm:flex items-center gap-2 text-[11px] font-bold text-slate-500 dark:text-slate-400">
            <Search className="w-3.5 h-3.5" />
            {filteredItems.length > 0 ? (
              <span>عرض {startIndex} إلى {endIndex} من إجمالي <strong className="text-slate-900 dark:text-white">{filteredItems.length}</strong> صنف</span>
            ) : (
              <span>لا توجد نتائج</span>
            )}
          </div>

          {/* Right: Rows Per Page */}
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
          <table className="w-full text-right border-collapse min-w-[900px]">
            <thead className="bg-slate-50/90 dark:bg-slate-800/90 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 sticky top-0 z-10">
              <tr>
                {visibleColumns.name && <th className={`${py} px-4 font-black text-[11px] tracking-wide`}>الصنف</th>}
                {visibleColumns.nameEn && <th className={`${py} px-4 font-black text-[11px] tracking-wide`}>English Name</th>}
                {visibleColumns.barcode && <th className={`${py} px-4 font-black text-[11px] tracking-wide`}>الباركود / SKU</th>}
                {visibleColumns.category && <th className={`${py} px-4 font-black text-[11px] tracking-wide`}>المجموعة</th>}
                {visibleColumns.buyPrice && <th className={`${py} px-4 font-black text-[11px] tracking-wide`}>سعر الشراء</th>}
                {visibleColumns.sellPrice && <th className={`${py} px-4 font-black text-[11px] tracking-wide`}>سعر البيع</th>}
                {visibleColumns.stock && <th className={`${py} px-4 font-black text-[11px] tracking-wide text-center`}>المخزون الحالي</th>}
                {visibleColumns.unit && <th className={`${py} px-4 font-black text-[11px] tracking-wide`}>الوحدة</th>}
                {visibleColumns.actions && <th className={`${py} px-4 text-center w-24 font-black text-[11px]`}>الخيارات</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {paginatedItems.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-16 text-center">
                    <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center mx-auto mb-3 text-slate-400 dark:text-slate-500">
                      <PackageSearch className="w-7 h-7 opacity-60" />
                    </div>
                    <p className="text-sm font-black text-slate-800 dark:text-slate-200">لا توجد منتجات مطابقة للبحث</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">ابدأ بإضافة أول صنف لمخزنك</p>
                    <div className="mt-4">
                      <Link href="/dashboard/items/new">
                        <Button size="sm" className="h-9 px-4 text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white rounded-xl">
                          <Plus className="w-3.5 h-3.5 ml-1.5" />
                          إضافة أول منتج الآن
                        </Button>
                      </Link>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedItems.map(item => {
                  const isLowStock = item.manage_inventory && item.current_stock > 0 && item.current_stock <= (item.low_stock_alert || 0)
                  const isOutOfStock = item.manage_inventory !== false && item.current_stock === 0

                  return (
                    <tr
                      key={item.id}
                      className="hover:bg-blue-50/40 dark:hover:bg-slate-800/40 cursor-pointer transition-colors duration-100 group"
                      onClick={() => router.push(`/dashboard/items/${item.id}`)}
                    >
                      {/* Name */}
                      {visibleColumns.name && (
                        <td className={`${py} px-4`}>
                          <div className={`font-extrabold ${textSize} text-slate-900 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors flex items-center gap-1.5 flex-wrap`}>
                            <span>{item.name}</span>
                            {item.allow_decimal && (
                              <span className="text-[9px] bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800/80 px-1.5 py-0.5 rounded font-bold whitespace-nowrap">ميزان</span>
                            )}
                          </div>
                          {item.active_ingredient && (
                            <div className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">{item.active_ingredient}</div>
                          )}
                        </td>
                      )}

                      {/* English Name */}
                      {visibleColumns.nameEn && (
                        <td className={`${py} px-4 text-[11px] font-medium text-slate-400 dark:text-slate-500`} dir="ltr">
                          {item.name_en || '—'}
                        </td>
                      )}

                      {/* Barcode / SKU */}
                      {visibleColumns.barcode && (
                        <td className={`${py} px-4`}>
                          <div className="text-[11px] font-mono font-bold text-slate-700 dark:text-slate-300">{item.sku || '—'}</div>
                          {item.barcodes.length > 0 && (
                            <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 font-mono">
                              {item.barcodes[0]}
                              {item.barcodes.length > 1 && (
                                <span className="mr-1 text-blue-600 dark:text-blue-400 font-black">(+{item.barcodes.length - 1})</span>
                              )}
                            </div>
                          )}
                        </td>
                      )}

                      {/* Category */}
                      {visibleColumns.category && (
                        <td className={`${py} px-4`}>
                          {item.categoryName ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 px-2 py-0.5 rounded-md">
                              <Tag className="w-2.5 h-2.5 text-slate-400 dark:text-slate-500" />
                              {item.categoryName}
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-400">—</span>
                          )}
                        </td>
                      )}

                      {/* Buy Price */}
                      {visibleColumns.buyPrice && (
                        <td className={`${py} px-4 font-bold text-slate-600 dark:text-slate-400 font-mono ${textSize}`}>
                          {item.buy_price.toFixed(2)} <span className="text-[9px] font-medium text-slate-400">ج.م</span>
                        </td>
                      )}

                      {/* Sell Price */}
                      {visibleColumns.sellPrice && (
                        <td className={`${py} px-4 font-black text-blue-600 dark:text-blue-400 font-mono ${textSize}`}>
                          {item.sell_price.toFixed(2)} <span className="text-[9px] font-bold text-slate-400">{item.allow_decimal ? 'ج.م/كجم' : 'ج.م'}</span>
                        </td>
                      )}

                      {/* Stock */}
                      {visibleColumns.stock && (
                        <td className={`${py} px-4 text-center`}>
                          {item.manage_inventory !== false ? (
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-black border ${
                              isOutOfStock
                                ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800'
                                : isLowStock
                                  ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                                  : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                            }`}>
                              {item.current_stock} {item.allow_decimal ? 'كجم' : (item.unit || 'قطعة')}
                            </span>
                          ) : (
                            <span className="text-slate-400 text-[10px]">غير متتبع</span>
                          )}
                        </td>
                      )}

                      {/* Unit */}
                      {visibleColumns.unit && (
                        <td className={`${py} px-4 text-[11px] font-bold text-slate-500 dark:text-slate-400`}>
                          {item.unit || '—'}
                        </td>
                      )}

                      {/* Actions */}
                      {visibleColumns.actions && (
                        <td className={`${py} px-4 text-center`} onClick={e => e.stopPropagation()}>
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => router.push(`/dashboard/items/${item.id}`)}
                              className="w-7 h-7 rounded-lg bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/40 dark:hover:bg-blue-900/60 text-blue-600 dark:text-blue-400 flex items-center justify-center transition-all cursor-pointer active:scale-95"
                              title="تعديل الصنف"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <Link href="/dashboard/barcode-print" onClick={e => e.stopPropagation()}>
                              <button
                                type="button"
                                className="w-7 h-7 rounded-lg bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center transition-all cursor-pointer active:scale-95"
                                title="طباعة الباركود"
                              >
                                <Barcode className="w-3.5 h-3.5" />
                              </button>
                            </Link>
                          </div>
                        </td>
                      )}
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* ── Row 6: Pagination Footer ── */}
        {filteredItems.length > 0 && (
          <div className="bg-white dark:bg-slate-900 px-4 sm:px-5 py-3 border-t border-slate-200/90 dark:border-slate-800 flex items-center justify-between shrink-0">
            {/* Results info (mobile) */}
            <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 sm:hidden">
              {startIndex}-{endIndex} من {filteredItems.length}
            </div>
            <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 hidden sm:block">
              عرض {startIndex} إلى {endIndex} من إجمالي {filteredItems.length} صنف
            </div>

            {/* Pagination Controls */}
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

              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 mr-2 hidden sm:inline">
                عدد الأسطر {rowsPerPage}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* ═══════ Sidebar Tools Panel ═══════ */}
      <aside className="hidden xl:flex flex-col w-56 bg-white dark:bg-slate-900 border-r border-slate-200/90 dark:border-slate-800 shrink-0 overflow-y-auto">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800">
          <h3 className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-1.5">
            <SlidersHorizontal className="w-3.5 h-3.5 text-blue-500" />
            أدوات سريعة
          </h3>
        </div>

        <nav className="flex-1 p-3 space-y-1.5">
          {sidebarTools.map((tool, i) => {
            const Icon = tool.icon
            return tool.href === '#' ? (
              <button
                key={i}
                type="button"
                onClick={tool.onClick}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-right hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors cursor-pointer group active:scale-[0.97]"
              >
                <div className={`w-8 h-8 rounded-lg ${tool.bg} border flex items-center justify-center ${tool.color} shrink-0`}>
                  <Icon className="w-4 h-4" />
                </div>
                <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">
                  {tool.label}
                </span>
              </button>
            ) : (
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

        {/* Branch Info */}
        <div className="p-3 border-t border-slate-100 dark:border-slate-800 mt-auto">
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
            <p className="text-[9px] font-bold text-slate-500 dark:text-slate-400">الفرع الحالي</p>
            <p className="text-xs font-black text-slate-900 dark:text-white mt-0.5">الفرع الرئيسي</p>
          </div>
        </div>
      </aside>
    </div>
  )
}
