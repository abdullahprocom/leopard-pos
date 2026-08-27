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
import {
  Plus, Search, Package, PackageSearch, Tag, ArrowUpRight,
  AlertTriangle, PackageX, Clock,
  RotateCcw, ChevronDown, ChevronUp,
  Printer, LayoutGrid, LayoutList,
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
  Barcode, Edit3, FileSpreadsheet, SlidersHorizontal
} from 'lucide-react'
import { toast } from 'sonner'

type QuickFilter = 'all' | 'low_stock' | 'near_expiry' | 'out_of_stock'
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
  const { storeId } = useStore()
  const currentStoreId = storeId || DEFAULT_STORE_UUID

  // Search and filter parameters
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [quickFilter, setQuickFilter] = useState<QuickFilter>('all')
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false)
  const [filterUnit, setFilterUnit] = useState<string>('all')
  const [filterManufacturer, setFilterManufacturer] = useState<string>('all')
  const [filterItemType, setFilterItemType] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [filterAvailableOnly, setFilterAvailableOnly] = useState(false)

  // Table pagination & density
  const [currentPage, setCurrentPage] = useState(1)
  const [rowsPerPage, setRowsPerPage] = useState(25)
  const [density, setDensity] = useState<TableDensity>('comfortable')

  // Live Queries (Tenant Isolated)
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

  // Computed summary metrics
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

  const uniqueUnits = useMemo(() => [...new Set(rawItemsData.map(i => i.unit).filter(Boolean))], [rawItemsData])
  const uniqueManufacturers = useMemo(() => [...new Set(rawItemsData.map(i => i.manufacturer).filter(Boolean) as string[])], [rawItemsData])

  // Filter evaluation logic
  const filteredItems = useMemo(() => {
    let items = [...rawItemsData]

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

    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      items = items.filter(i =>
        (i.search_text || i.name || '').toLowerCase().includes(q) ||
        (i.name_en || '').toLowerCase().includes(q) ||
        (i.sku || '').toLowerCase().includes(q) ||
        i.barcodes.some(b => b.includes(q))
      )
    }

    if (selectedCategory !== 'all') items = items.filter(i => i.category_id === selectedCategory)
    if (filterUnit !== 'all') items = items.filter(i => i.unit === filterUnit)
    if (filterManufacturer !== 'all') items = items.filter(i => i.manufacturer === filterManufacturer)
    if (filterItemType !== 'all') items = items.filter(i => i.item_type === filterItemType)
    if (filterStatus !== 'all') items = items.filter(i => i.status === filterStatus)
    if (filterAvailableOnly) items = items.filter(i => i.current_stock > 0)

    return items
  }, [rawItemsData, quickFilter, searchQuery, selectedCategory, filterUnit, filterManufacturer, filterItemType, filterStatus, filterAvailableOnly])

  // Pagination calculation
  const totalPages = Math.max(1, Math.ceil(filteredItems.length / rowsPerPage))
  const paginatedItems = filteredItems.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage)
  const startIndex = (currentPage - 1) * rowsPerPage + 1
  const endIndex = Math.min(currentPage * rowsPerPage, filteredItems.length)

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

  const py = density === 'compact' ? 'py-2.5' : 'py-3.5'
  const textSize = density === 'compact' ? 'text-xs' : 'text-sm'

  return (
    <div className="space-y-4 pb-12 select-none w-full" dir="rtl">
      {/* ── Row 1: Header Banner ── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-sm transition-colors">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/50 border border-blue-100 dark:border-blue-800/60 flex items-center justify-center text-blue-600 dark:text-blue-400 shadow-xs">
            <Package className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              الأصناف والمخزون
            </h1>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-0.5">
              إدارة كتالوج المنتجات، الباركودات، ومتابعة الأرصدة والتسعير
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Link href="/dashboard/barcode-print">
            <Button variant="outline" className="h-11 px-4 text-xs font-bold rounded-xl border-slate-200 dark:border-slate-700">
              <Barcode className="w-4 h-4 ml-1.5 text-emerald-500" />
              طباعة الباركود
            </Button>
          </Link>
          <Link href="/dashboard/items/new">
            <Button className="h-11 px-5 text-xs font-black bg-blue-600 hover:bg-blue-500 text-white rounded-xl shadow-md shadow-blue-600/25 active:scale-95 transition-all">
              <Plus className="w-4 h-4 ml-1.5" />
              إضافة صنف جديد
            </Button>
          </Link>
        </div>
      </div>

      {/* ── Row 2: Stats Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Total Items */}
        <button
          type="button"
          onClick={() => { setQuickFilter('all'); resetPage() }}
          className={`flex items-center gap-3.5 p-4 rounded-2xl border transition-all cursor-pointer active:scale-[0.97] ${
            quickFilter === 'all'
              ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-300 dark:border-blue-700 ring-2 ring-blue-500/20'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-blue-300'
          }`}
        >
          <div className="w-10 h-10 rounded-xl bg-blue-500/15 border border-blue-500/25 flex items-center justify-center text-blue-500">
            <Package className="w-5 h-5" />
          </div>
          <div className="text-right">
            <p className="text-2xl font-black text-slate-900 dark:text-white leading-none font-mono">{stats.total}</p>
            <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mt-1">إجمالي الأصناف</p>
          </div>
        </button>

        {/* Low Stock */}
        <button
          type="button"
          onClick={() => { setQuickFilter('low_stock'); resetPage() }}
          className={`flex items-center gap-3.5 p-4 rounded-2xl border transition-all cursor-pointer active:scale-[0.97] ${
            quickFilter === 'low_stock'
              ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-700 ring-2 ring-amber-500/20'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-amber-300'
          }`}
        >
          <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/25 flex items-center justify-center text-amber-500">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="text-right">
            <p className="text-2xl font-black text-amber-600 dark:text-amber-400 leading-none font-mono">{stats.lowStock}</p>
            <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mt-1">نواقص المخزون</p>
          </div>
        </button>

        {/* Near Expiry */}
        <button
          type="button"
          onClick={() => { setQuickFilter('near_expiry'); resetPage() }}
          className={`flex items-center gap-3.5 p-4 rounded-2xl border transition-all cursor-pointer active:scale-[0.97] ${
            quickFilter === 'near_expiry'
              ? 'bg-orange-50 dark:bg-orange-950/40 border-orange-300 dark:border-orange-700 ring-2 ring-orange-500/20'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-orange-300'
          }`}
        >
          <div className="w-10 h-10 rounded-xl bg-orange-500/15 border border-orange-500/25 flex items-center justify-center text-orange-500">
            <Clock className="w-5 h-5" />
          </div>
          <div className="text-right">
            <p className="text-2xl font-black text-orange-600 dark:text-orange-400 leading-none font-mono">{stats.nearExpiry}</p>
            <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mt-1">قاربت على الانتهاء</p>
          </div>
        </button>

        {/* Out of Stock */}
        <button
          type="button"
          onClick={() => { setQuickFilter('out_of_stock'); resetPage() }}
          className={`flex items-center gap-3.5 p-4 rounded-2xl border transition-all cursor-pointer active:scale-[0.97] ${
            quickFilter === 'out_of_stock'
              ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-700 ring-2 ring-rose-500/20'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-rose-300'
          }`}
        >
          <div className="w-10 h-10 rounded-xl bg-rose-500/15 border border-rose-500/25 flex items-center justify-center text-rose-500">
            <PackageX className="w-5 h-5" />
          </div>
          <div className="text-right">
            <p className="text-2xl font-black text-rose-600 dark:text-rose-400 leading-none font-mono">{stats.outOfStock}</p>
            <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mt-1">خارج المخزون (0 رصيد)</p>
          </div>
        </button>
      </div>

      {/* ── Row 3: Search Bar & Filters ── */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-xs flex flex-col md:flex-row gap-3 items-center">
        <div className="relative flex-1 w-full">
          <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 pointer-events-none" />
          <Input
            type="text"
            placeholder="ابحث بالاسم، الباركود، أو كود الصنف SKU..."
            className="pr-10 h-11 text-xs bg-slate-50/80 dark:bg-slate-800/80 rounded-xl font-bold"
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); resetPage() }}
          />
        </div>

        <div className="w-full md:w-52 shrink-0">
          <Select value={selectedCategory} onValueChange={(v) => { setSelectedCategory(v); resetPage() }}>
            <SelectTrigger className="h-11 text-xs font-bold bg-slate-50/80 dark:bg-slate-800/80 rounded-xl">
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
          className={`flex items-center gap-1.5 h-11 px-4 rounded-xl text-xs font-black border transition-all cursor-pointer active:scale-95 shrink-0 ${
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
        <div className="bg-slate-50/80 dark:bg-slate-900/80 p-4 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 animate-in slide-in-from-top-2 duration-200">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
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

            <div className="space-y-1">
              <Label className="text-[10px] font-bold text-slate-500">خيارات إضافية</Label>
              <div className="flex items-center gap-2 h-9">
                <label className="flex items-center gap-1.5 text-[10px] font-bold text-slate-600 dark:text-slate-400 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={filterAvailableOnly}
                    onChange={e => { setFilterAvailableOnly(e.target.checked); resetPage() }}
                    className="rounded border-slate-300 text-blue-600"
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
              إعادة تعيين الفلاتر
            </Button>
          </div>
        </div>
      )}

      {/* ── Row 4: Table Toolbar + Data Table ── */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-xs overflow-hidden">
        
        {/* Table Toolbar Header */}
        <div className="p-3.5 border-b border-slate-200/60 dark:border-slate-800/60 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => exportToCSV(filteredItems, 'items_export')}
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
            <div className="w-px h-4 bg-slate-200 dark:bg-slate-700 mx-0.5" />
            <button
              type="button"
              onClick={() => setDensity(density === 'compact' ? 'comfortable' : 'compact')}
              className="w-8 h-8 rounded-lg bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 text-slate-500 flex items-center justify-center transition-all cursor-pointer active:scale-95"
              title={density === 'compact' ? 'عرض مريح' : 'عرض مضغوط'}
            >
              {density === 'compact' ? <LayoutGrid className="w-4 h-4" /> : <LayoutList className="w-4 h-4" />}
            </button>
          </div>

          <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
            {filteredItems.length > 0 ? (
              <span>عرض {startIndex} إلى {endIndex} من إجمالي <strong className="text-slate-900 dark:text-white">{filteredItems.length}</strong> صنف</span>
            ) : (
              <span>لا توجد نتائج</span>
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
          </div>
        </div>

        {/* Table Body */}
        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse min-w-[850px]">
            <thead className="bg-slate-50/90 dark:bg-slate-800/90 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-extrabold text-xs">
              <tr>
                <th className={`${py} px-4 font-black`}>الصنف</th>
                <th className={`${py} px-4 font-black`}>English Name</th>
                <th className={`${py} px-4 font-black`}>الباركود / SKU</th>
                <th className={`${py} px-4 font-black`}>المجموعة</th>
                <th className={`${py} px-4 font-black`}>سعر الشراء</th>
                <th className={`${py} px-4 font-black`}>سعر البيع</th>
                <th className={`${py} px-4 font-black text-center`}>المخزون الحالي</th>
                <th className={`${py} px-4 font-black`}>الوحدة</th>
                <th className={`${py} px-4 text-center w-24 font-black`}>الخيارات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {paginatedItems.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-16 text-center">
                    <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center mx-auto mb-3 text-slate-400">
                      <PackageSearch className="w-7 h-7 opacity-60" />
                    </div>
                    <p className="text-sm font-black text-slate-800 dark:text-slate-200">لا توجد منتجات مطابقة للبحث</p>
                    <p className="text-xs text-slate-500 mt-1">ابدأ بإضافة أول صنف لمخزنك</p>
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
                      <td className={`${py} px-4`}>
                        <div className={`font-extrabold ${textSize} text-slate-900 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors flex items-center gap-1.5 flex-wrap`}>
                          <span>{item.name}</span>
                          {item.allow_decimal && (
                            <span className="text-[9px] bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800/80 px-1.5 py-0.5 rounded font-bold">ميزان</span>
                          )}
                        </div>
                        {item.active_ingredient && (
                          <div className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">{item.active_ingredient}</div>
                        )}
                      </td>

                      <td className={`${py} px-4 text-[11px] font-medium text-slate-400`} dir="ltr">
                        {item.name_en || '—'}
                      </td>

                      <td className={`${py} px-4`}>
                        <div className="text-[11px] font-mono font-bold text-slate-700 dark:text-slate-300">{item.sku || '—'}</div>
                        {item.barcodes.length > 0 && (
                          <div className="text-[10px] text-slate-500 mt-0.5 font-mono">
                            {item.barcodes[0]}
                            {item.barcodes.length > 1 && (
                              <span className="mr-1 text-blue-600 dark:text-blue-400 font-black">(+{item.barcodes.length - 1})</span>
                            )}
                          </div>
                        )}
                      </td>

                      <td className={`${py} px-4`}>
                        {item.categoryName ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 px-2 py-0.5 rounded-md">
                            <Tag className="w-2.5 h-2.5 text-slate-400" />
                            {item.categoryName}
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400">—</span>
                        )}
                      </td>

                      <td className={`${py} px-4 font-bold text-slate-600 dark:text-slate-400 font-mono ${textSize}`}>
                        {item.buy_price.toFixed(2)} <span className="text-[9px] font-medium text-slate-400">ج.م</span>
                      </td>

                      <td className={`${py} px-4 font-black text-blue-600 dark:text-blue-400 font-mono ${textSize}`}>
                        {item.sell_price.toFixed(2)} <span className="text-[9px] font-bold text-slate-400">{item.allow_decimal ? 'ج.م/كجم' : 'ج.م'}</span>
                      </td>

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

                      <td className={`${py} px-4 text-[11px] font-bold text-slate-500`}>
                        {item.unit || '—'}
                      </td>

                      <td className={`${py} px-4 text-center`} onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => router.push(`/dashboard/items/${item.id}`)}
                            className="w-7 h-7 rounded-lg bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center transition-all cursor-pointer active:scale-95"
                            title="تعديل الصنف"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <Link href="/dashboard/barcode-print" onClick={e => e.stopPropagation()}>
                            <button
                              type="button"
                              className="w-7 h-7 rounded-lg bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center transition-all cursor-pointer active:scale-95"
                              title="طباعة الباركود"
                            >
                              <Barcode className="w-3.5 h-3.5" />
                            </button>
                          </Link>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {filteredItems.length > 0 && (
          <div className="bg-white dark:bg-slate-900 px-4 py-3 border-t border-slate-200/90 dark:border-slate-800 flex items-center justify-between text-xs">
            <div className="text-[11px] font-bold text-slate-500">
              عرض {startIndex} إلى {endIndex} من إجمالي {filteredItems.length} صنف
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(1)}
                className="w-7 h-7 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-500 flex items-center justify-center disabled:opacity-30 hover:bg-slate-100 cursor-pointer"
              >
                <ChevronsRight className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                className="w-7 h-7 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-500 flex items-center justify-center disabled:opacity-30 hover:bg-slate-100 cursor-pointer"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>

              <span className="px-2.5 h-7 rounded-md bg-blue-600 text-white text-xs font-black flex items-center justify-center min-w-[28px]">
                {currentPage}
              </span>

              <button
                type="button"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                className="w-7 h-7 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-500 flex items-center justify-center disabled:opacity-30 hover:bg-slate-100 cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(totalPages)}
                className="w-7 h-7 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-500 flex items-center justify-center disabled:opacity-30 hover:bg-slate-100 cursor-pointer"
              >
                <ChevronsLeft className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
