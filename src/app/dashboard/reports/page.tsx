'use client'

import React, { useState, useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/lib/db'
import { money, formatCurrency, formatNumber } from '@/lib/finance'
import {
  BarChart3,
  TrendingUp,
  DollarSign,
  Package,
  Calendar,
  Printer,
  ShoppingBag,
  RotateCcw,
  Boxes,
  PieChart as PieIcon,
  Layers,
  ArrowUpRight,
  Sparkles,
  CreditCard,
  Banknote
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts'

export default function ReportsPage() {
  const [period, setPeriod] = useState<'today' | 'week' | 'month' | 'all'>('today')

  // Live queries
  const sales = useLiveQuery(() => db.sales.toArray()) || []
  const saleLines = useLiveQuery(() => db.sale_lines.toArray()) || []
  const salesReturns = useLiveQuery(() => db.sales_returns.toArray()) || []
  const returnLines = useLiveQuery(() => db.sales_return_lines.toArray()) || []
  const purchases = useLiveQuery(() => db.purchases.toArray()) || []
  const items = useLiveQuery(() => db.items.toArray()) || []
  const categories = useLiveQuery(() => db.categories.toArray()) || []
  const stockBalances = useLiveQuery(() => db.stock_balances.toArray()) || []

  // Filter date predicate
  const filteredSales = useMemo(() => {
    if (period === 'all') return sales

    const now = new Date()
    let cutoff: Date

    if (period === 'today') {
      const todayStr = now.toISOString().split('T')[0]
      return sales.filter(s => s.created_at?.startsWith(todayStr))
    } else if (period === 'week') {
      cutoff = new Date(now)
      cutoff.setDate(cutoff.getDate() - 7)
    } else {
      // month
      cutoff = new Date(now.getFullYear(), now.getMonth(), 1)
    }

    const cutoffStr = cutoff.toISOString()
    return sales.filter(s => (s.created_at || '') >= cutoffStr)
  }, [sales, period])

  const filteredReturns = useMemo(() => {
    if (period === 'all') return salesReturns

    const now = new Date()
    let cutoff: Date

    if (period === 'today') {
      const todayStr = now.toISOString().split('T')[0]
      return salesReturns.filter(r => r.created_at?.startsWith(todayStr))
    } else if (period === 'week') {
      cutoff = new Date(now)
      cutoff.setDate(cutoff.getDate() - 7)
    } else {
      cutoff = new Date(now.getFullYear(), now.getMonth(), 1)
    }

    const cutoffStr = cutoff.toISOString()
    return salesReturns.filter(r => (r.created_at || '') >= cutoffStr)
  }, [salesReturns, period])

  // Filtered sale lines
  const filteredSaleIds = useMemo(() => new Set(filteredSales.map(s => s.id)), [filteredSales])
  const activeSaleLines = useMemo(() => saleLines.filter(l => filteredSaleIds.has(l.sale_id)), [saleLines, filteredSaleIds])

  // Financial Metrics
  const metrics = useMemo(() => {
    const grossSales = money(filteredSales.reduce((sum, s) => sum + (s.total || 0), 0))
    const totalReturns = money(filteredReturns.reduce((sum, r) => sum + (r.total || 0), 0))
    const netSales = money(grossSales - totalReturns)

    // Cost of goods sold (COGS)
    const cogs = money(activeSaleLines.reduce((sum, l) => {
      const item = items.find(i => i.id === l.item_id)
      const cost = l.cost_price || item?.buy_price || 0
      return sum + (cost * (l.quantity || 0))
    }, 0))

    const grossProfit = money(netSales - cogs)
    const profitMargin = netSales > 0 ? ((grossProfit / netSales) * 100).toFixed(1) : '0'

    // Payment methods
    const cashSales = money(filteredSales.filter(s => s.payment_method === 'cash' || !s.payment_method).reduce((sum, s) => sum + (s.total || 0), 0))
    const cardSales = money(filteredSales.filter(s => s.payment_method === 'card' || s.payment_method === 'bank-transfer').reduce((sum, s) => sum + (s.total || 0), 0))

    return {
      grossSales,
      totalReturns,
      netSales,
      cogs,
      grossProfit,
      profitMargin,
      invoiceCount: filteredSales.length,
      returnCount: filteredReturns.length,
      cashSales,
      cardSales
    }
  }, [filteredSales, filteredReturns, activeSaleLines, items])

  // Inventory Valuation
  const inventoryValuation = useMemo(() => {
    let totalQty = 0
    let totalCostVal = 0
    let totalRetailVal = 0

    stockBalances.forEach(sb => {
      const item = items.find(i => i.id === sb.item_id)
      if (item && sb.quantity > 0) {
        totalQty += sb.quantity
        totalCostVal += (item.buy_price || 0) * sb.quantity
        totalRetailVal += (item.sell_price || 0) * sb.quantity
      }
    })

    return {
      totalQty: Math.round(totalQty * 100) / 100,
      totalCostVal: money(totalCostVal),
      totalRetailVal: money(totalRetailVal),
      potentialProfit: money(totalRetailVal - totalCostVal),
    }
  }, [stockBalances, items])

  // Top Selling Items
  const topSellingItems = useMemo(() => {
    const map: Record<string, { name: string; qty: number; revenue: number; unit: string }> = {}

    activeSaleLines.forEach(l => {
      const item = items.find(i => i.id === l.item_id)
      const name = l.item_name || item?.name || 'صنف غير محدد'
      const unit = item?.unit || 'قطعة'

      if (!map[l.item_id]) {
        map[l.item_id] = { name, qty: 0, revenue: 0, unit }
      }
      map[l.item_id].qty += (l.quantity || 0)
      map[l.item_id].revenue += (l.net_total || (l.quantity * l.unit_price) || 0)
    })

    return Object.values(map)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 7)
  }, [activeSaleLines, items])

  // Sales by Category
  const categorySales = useMemo(() => {
    const map: Record<string, number> = {}

    activeSaleLines.forEach(l => {
      const item = items.find(i => i.id === l.item_id)
      const cat = categories.find(c => c.id === item?.category_id)
      const catName = cat?.name || 'عام / بدون تصنيف'

      const amount = l.net_total || ((l.quantity || 1) * (l.unit_price || 0))
      map[catName] = (map[catName] || 0) + amount
    })

    const COLORS = ['#3B82F6', '#10B981', '#8B5CF6', '#F59E0B', '#EC4899', '#06B6D4', '#64748B']

    return Object.entries(map).map(([name, value], idx) => ({
      name,
      value: money(value),
      color: COLORS[idx % COLORS.length]
    }))
  }, [activeSaleLines, items, categories])

  const handlePrint = () => {
    window.print()
  }

  const periodLabels = {
    today: 'اليوم',
    week: 'آخر 7 أيام',
    month: 'هذا الشهر',
    all: 'جميع الفترات'
  }

  return (
    <div className="space-y-6 pb-12 select-none" dir="rtl">
      {/* ─── Header ─── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-sm print:hidden">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
            <BarChart3 className="w-8 h-8 text-blue-600 dark:text-blue-400" />
            التقارير المالية والأرباح
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-semibold mt-1">
            تحليل حركة المبيعات، تكلفة البضاعة، الأرباح، وتقييم المخزون
          </p>
        </div>

        {/* Period Filter Buttons & Print */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
            {(['today', 'week', 'month', 'all'] as const).map(p => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${period === p ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'}`}
              >
                {periodLabels[p]}
              </button>
            ))}
          </div>

          <Button onClick={handlePrint} variant="outline" size="sm" className="h-9 px-4 font-bold border-slate-300 dark:border-slate-700 cursor-pointer">
            <Printer className="w-4 h-4 ml-1.5" />
            طباعة التقرير
          </Button>
        </div>
      </div>

      {/* ─── Print Header (Only visible when printing) ─── */}
      <div className="hidden print:block text-center border-b pb-4 mb-4">
        <h1 className="text-2xl font-black">تقرير المبيعات والأرباح — ERP System</h1>
        <p className="text-sm text-slate-600">الفترة: {periodLabels[period]} | تاريخ الطباعة: {new Date().toLocaleString('ar-EG')}</p>
      </div>

      {/* ─── Key Financial KPIs Row ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Gross Sales */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-xs font-bold">إجمالي المبيعات ({periodLabels[period]})</span>
            <TrendingUp className="w-4 h-4 text-blue-500" />
          </div>
          <p className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white" dir="ltr">
            {formatCurrency(metrics.grossSales)}
          </p>
          <p className="text-xs text-slate-400 font-semibold mt-1">{metrics.invoiceCount} فاتورة صادرة</p>
        </div>

        {/* Sales Returns */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-xs font-bold">إجمالي المرتجعات</span>
            <RotateCcw className="w-4 h-4 text-rose-500" />
          </div>
          <p className="text-2xl sm:text-3xl font-black text-rose-600 dark:text-rose-400" dir="ltr">
            {formatCurrency(metrics.totalReturns)}
          </p>
          <p className="text-xs text-slate-400 font-semibold mt-1">{metrics.returnCount} عملية إرجاع</p>
        </div>

        {/* Net Sales */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-xs font-bold">صافي المبيعات (الفعلي)</span>
            <DollarSign className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400" dir="ltr">
            {formatCurrency(metrics.netSales)}
          </p>
          <p className="text-xs text-slate-400 font-semibold mt-1">بعد خصم المرتجعات</p>
        </div>

        {/* Gross Profit & Margin */}
        <div className="bg-gradient-to-br from-blue-600 to-indigo-700 text-white p-5 rounded-2xl shadow-lg shadow-blue-600/20">
          <div className="flex items-center justify-between text-blue-100 mb-2">
            <span className="text-xs font-bold">مجمل الربح التقديري</span>
            <Sparkles className="w-4 h-4" />
          </div>
          <p className="text-2xl sm:text-3xl font-black" dir="ltr">
            {formatCurrency(metrics.grossProfit)}
          </p>
          <p className="text-xs text-blue-100 font-bold mt-1">هامش ربح: {metrics.profitMargin}%</p>
        </div>
      </div>

      {/* ─── Inventory Valuation Card ─── */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-sm p-6">
        <h2 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2 mb-4">
          <Boxes className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          تقييم رأس مال المخزون الحالي (Inventory Valuation)
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/60">
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">إجمالي الكميات بالمخزن</p>
            <p className="text-xl font-black text-slate-900 dark:text-white" dir="ltr">{formatNumber(inventoryValuation.totalQty)}</p>
          </div>
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/60">
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">قيمة المخزون بسعر الشراء (التكلفة)</p>
            <p className="text-xl font-black text-blue-600 dark:text-blue-400" dir="ltr">{formatCurrency(inventoryValuation.totalCostVal)}</p>
          </div>
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/60">
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">قيمة المخزون بسعر البيع المتوقع</p>
            <p className="text-xl font-black text-emerald-600 dark:text-emerald-400" dir="ltr">{formatCurrency(inventoryValuation.totalRetailVal)}</p>
          </div>
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/60">
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">الربح المتوقع عند بيع المخزون</p>
            <p className="text-xl font-black text-purple-600 dark:text-purple-400" dir="ltr">{formatCurrency(inventoryValuation.potentialProfit)}</p>
          </div>
        </div>
      </div>

      {/* ─── Charts & Top Selling Grid ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Selling Items */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-sm p-6">
          <h2 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            الأصناف الأكثر مبيعاً وتحقيقاً للإيراد
          </h2>
          {topSellingItems.length === 0 ? (
            <div className="text-center py-10 text-slate-400 font-bold">لا توجد مبيعات في هذه الفترة</div>
          ) : (
            <div className="space-y-3">
              {topSellingItems.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 rounded-xl border border-slate-100 dark:border-slate-800/70 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-black text-xs flex items-center justify-center">
                      {idx + 1}
                    </span>
                    <div>
                      <p className="text-sm font-bold text-slate-900 dark:text-white">{item.name}</p>
                      <p className="text-xs text-slate-400 font-semibold">{item.qty} {item.unit}</p>
                    </div>
                  </div>
                  <span className="font-black text-emerald-600 dark:text-emerald-400 text-sm" dir="ltr">
                    {formatCurrency(item.revenue)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Sales by Category Chart */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-sm p-6">
          <h2 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2 mb-4">
            <PieIcon className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            توزيع المبيعات حسب التصنيف
          </h2>
          {categorySales.length === 0 ? (
            <div className="text-center py-10 text-slate-400 font-bold">لا توجد مبيعات في هذه الفترة</div>
          ) : (
            <div className="h-[280px] w-full" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categorySales}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    innerRadius={50}
                    paddingAngle={3}
                  >
                    {categorySales.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1E293B', border: 'none', borderRadius: '12px', color: '#fff', fontSize: '13px', fontWeight: 700, direction: 'rtl' }}
                    formatter={(val: any) => [`${Number(val || 0).toFixed(2)} ج.م`, 'المبيعات']}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* ─── Payment Methods Summary ─── */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-sm p-6">
        <h2 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2 mb-4">
          <CreditCard className="w-5 h-5 text-sky-600 dark:text-sky-400" />
          طرق السداد وتحصيل النقدية
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex items-center justify-between p-4 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center">
                <Banknote className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900 dark:text-white">المتحصلات النقدية (كاش في الخزينة)</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold">مدفوعات نقدية بالدرج</p>
              </div>
            </div>
            <p className="text-xl font-black text-emerald-700 dark:text-emerald-400" dir="ltr">{formatCurrency(metrics.cashSales)}</p>
          </div>

          <div className="flex items-center justify-between p-4 rounded-xl bg-sky-50/50 dark:bg-sky-950/20 border border-sky-200 dark:border-sky-800/40">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-sky-600 text-white flex items-center justify-center">
                <CreditCard className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900 dark:text-white">المدفوعات الإلكترونية / فيزا</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold">بطاقات دفع وتحويلات</p>
              </div>
            </div>
            <p className="text-xl font-black text-sky-700 dark:text-sky-400" dir="ltr">{formatCurrency(metrics.cardSales)}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
