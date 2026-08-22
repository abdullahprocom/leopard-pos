'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/lib/db'
import { useStore } from '@/lib/store-context'
import { DEFAULT_STORE_UUID } from '@/lib/sync-engine'
import { money, formatCurrency, formatNumber } from '@/lib/finance'
import {
  ShoppingCart,
  Package,
  ShoppingBag,
  Undo2,
  ClipboardList,
  ArrowLeftRight,
  Receipt,
  RotateCcw,
  Users,
  Building2,
  UserCog,
  Settings,
  Boxes,
  ShieldCheck,
  Zap,
  Truck,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  DollarSign,
  BarChart3,
  Calendar,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  Pill,
  Shirt,
  Utensils,
  Tag,
  FileSpreadsheet,
  Crown,
  CreditCard,
  Layers,
  Activity,
  Sparkles,
} from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

// ─── KPI Stat Card ───
function StatCard({ title, value, icon: Icon, color, trend, trendLabel }: {
  title: string
  value: string
  icon: any
  color: 'blue' | 'green' | 'amber' | 'rose' | 'purple' | 'cyan'
  trend?: 'up' | 'down' | 'neutral'
  trendLabel?: string
}) {
  const colorMap = {
    blue: 'from-blue-500 to-blue-600 shadow-blue-500/25',
    green: 'from-emerald-500 to-emerald-600 shadow-emerald-500/25',
    amber: 'from-amber-500 to-amber-600 shadow-amber-500/25',
    rose: 'from-rose-500 to-rose-600 shadow-rose-500/25',
    purple: 'from-purple-500 to-purple-600 shadow-purple-500/25',
    cyan: 'from-cyan-500 to-cyan-600 shadow-cyan-500/25',
  }

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-sm p-5 transition-all hover:shadow-md hover:-translate-y-0.5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-slate-500 dark:text-slate-400 mb-1.5">{title}</p>
          <p className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight leading-none" dir="ltr">
            {value}
          </p>
          {trendLabel && (
            <div className={`flex items-center gap-1 mt-2 text-xs font-bold ${trend === 'up' ? 'text-emerald-600 dark:text-emerald-400' : trend === 'down' ? 'text-rose-600 dark:text-rose-400' : 'text-slate-500 dark:text-slate-400'}`}>
              {trend === 'up' ? <ArrowUpRight className="w-3.5 h-3.5" /> : trend === 'down' ? <ArrowDownRight className="w-3.5 h-3.5" /> : null}
              {trendLabel}
            </div>
          )}
        </div>
        <div className={`shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br ${colorMap[color]} shadow-lg flex items-center justify-center`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
      </div>
    </div>
  )
}

// ─── Dashboard Quick Tiles ───
interface DashboardTile {
  title: string
  icon: any
  href: string
  gradient: string
}

interface TileGroup {
  id: string
  title: string
  icon: any
  tiles: DashboardTile[]
}

const groups: TileGroup[] = [
  {
    id: 'pos',
    title: 'نقاط البيع والعمليات',
    icon: Zap,
    tiles: [
      { title: 'نقطة البيع (الكاشير)', icon: ShoppingCart, href: '/dashboard/pos', gradient: 'from-blue-600 to-indigo-600' },
      { title: 'سجل المبيعات', icon: Receipt, href: '/dashboard/sales', gradient: 'from-emerald-600 to-teal-700' },
      { title: 'مرتجع المبيعات', icon: RotateCcw, href: '/dashboard/sales-returns', gradient: 'from-red-600 to-rose-700' },
    ],
  },
  {
    id: 'inventory',
    title: 'المخزون والأصناف',
    icon: Boxes,
    tiles: [
      { title: 'الأصناف والمخزون', icon: Package, href: '/dashboard/items', gradient: 'from-blue-600 to-blue-700' },
      { title: 'الجرد والتسوية', icon: ClipboardList, href: '/dashboard/stocktaking', gradient: 'from-purple-600 to-violet-700' },
      { title: 'النقل المخزني', icon: ArrowLeftRight, href: '/dashboard/transfers', gradient: 'from-sky-600 to-cyan-700' },
    ],
  },
  {
    id: 'purchases',
    title: 'المشتريات والموردين',
    icon: Truck,
    tiles: [
      { title: 'فواتير المشتريات', icon: ShoppingBag, href: '/dashboard/purchases', gradient: 'from-amber-600 to-orange-600' },
      { title: 'مرتجع الشراء', icon: Undo2, href: '/dashboard/purchase-returns', gradient: 'from-red-600 to-rose-700' },
      { title: 'الشركات والموردين', icon: Building2, href: '/dashboard/suppliers', gradient: 'from-slate-700 to-slate-800' },
    ],
  },
  {
    id: 'admin',
    title: 'الإدارة والنظام',
    icon: ShieldCheck,
    tiles: [
      { title: 'دليل العملاء', icon: Users, href: '/dashboard/customers', gradient: 'from-indigo-600 to-purple-600' },
      { title: 'الموظفين والصلاحيات', icon: UserCog, href: '/dashboard/employees', gradient: 'from-violet-600 to-purple-700' },
      { title: 'إعدادات النظام', icon: Settings, href: '/dashboard/settings', gradient: 'from-slate-700 to-slate-800' },
    ],
  },
]

export default function DashboardPage() {
  const { storeId, storeName, businessType } = useStore()
  const { currentUser, role } = useAuth()
  const currentStoreId = storeId || DEFAULT_STORE_UUID

  // ─── Live Queries strictly isolated by current store (Tenant Isolation) ───
  const sales = useLiveQuery(() => db.sales.where('store_id').equals(currentStoreId).toArray(), [currentStoreId]) || []
  const saleLines = useLiveQuery(() => db.sale_lines.where('store_id').equals(currentStoreId).toArray(), [currentStoreId]) || []
  const salesReturns = useLiveQuery(() => db.sales_returns.where('store_id').equals(currentStoreId).toArray(), [currentStoreId]) || []
  const purchases = useLiveQuery(() => db.purchases.where('store_id').equals(currentStoreId).toArray(), [currentStoreId]) || []
  const items = useLiveQuery(() => db.items.where('store_id').equals(currentStoreId).toArray(), [currentStoreId]) || []
  const stockBalances = useLiveQuery(() => db.stock_balances.where('store_id').equals(currentStoreId).toArray(), [currentStoreId]) || []

  // ─── Computed KPIs ───
  const kpis = useMemo(() => {
    const now = new Date()
    const todayStr = now.toISOString().split('T')[0]

    // Today's sales
    const todaySales = sales.filter(s => s.created_at?.startsWith(todayStr))
    const todaySalesTotal = money(todaySales.reduce((sum, s) => sum + (s.total || 0), 0))
    const todayInvoiceCount = todaySales.length

    // Today's returns
    const todayReturns = salesReturns.filter(r => r.created_at?.startsWith(todayStr))
    const todayReturnsTotal = money(todayReturns.reduce((sum, r) => sum + (r.total || 0), 0))

    // Net today
    const todayNet = money(todaySalesTotal - todayReturnsTotal)

    // Total sales (all time)
    const totalSalesAllTime = money(sales.reduce((sum, s) => sum + (s.total || 0), 0))

    // Total purchases (all time)
    const totalPurchasesAllTime = money(purchases.reduce((sum, p) => sum + (p.total || 0), 0))

    // Gross profit estimate (sales - purchases cost)
    const totalCost = money(saleLines.reduce((sum, l) => {
      const item = items.find(i => i.id === l.item_id)
      return sum + ((item?.buy_price || 0) * (l.quantity || 0))
    }, 0))
    const grossProfit = money(totalSalesAllTime - totalCost)

    // Item counts
    const totalItems = items.length
    const activeItems = items.filter(i => i.status === 'active').length

    // Low stock alerts
    const lowStockItems = items.filter(item => {
      if (!item.manage_inventory) return false
      const alert = item.low_stock_alert || 5
      const balance = stockBalances.find(b => b.item_id === item.id)
      const qty = balance?.quantity || 0
      return qty <= alert
    })

    // Out of stock
    const outOfStockItems = items.filter(item => {
      if (!item.manage_inventory) return false
      const balance = stockBalances.find(b => b.item_id === item.id)
      return (balance?.quantity || 0) <= 0
    })

    return {
      todaySalesTotal,
      todayInvoiceCount,
      todayReturnsTotal,
      todayNet,
      totalSalesAllTime,
      totalPurchasesAllTime,
      grossProfit,
      totalItems,
      activeItems,
      lowStockItems,
      outOfStockItems,
    }
  }, [sales, saleLines, salesReturns, purchases, items, stockBalances])

  // ─── Sales Chart Data (Last 7 Days) ───
  const chartData = useMemo(() => {
    const days: { label: string; date: string; sales: number; returns: number }[] = []
    const now = new Date()

    for (let i = 6; i >= 0; i--) {
      const d = new Date(now)
      d.setDate(d.getDate() - i)
      const dateStr = d.toISOString().split('T')[0]
      const dayName = d.toLocaleDateString('ar-EG', { weekday: 'short' })

      const daySales = money(
        sales
          .filter(s => s.created_at?.startsWith(dateStr))
          .reduce((sum, s) => sum + (s.total || 0), 0)
      )
      const dayReturns = money(
        salesReturns
          .filter(r => r.created_at?.startsWith(dateStr))
          .reduce((sum, r) => sum + (r.total || 0), 0)
      )

      days.push({ label: dayName, date: dateStr, sales: daySales, returns: dayReturns })
    }

    return days
  }, [sales, salesReturns])

  // ─── Recent Invoices (Last 5) ───
  const recentInvoices = useMemo(() => {
    return [...sales]
      .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))
      .slice(0, 5)
  }, [sales])

  // ─── Low Stock Items for Table ───
  const lowStockList = useMemo(() => {
    return kpis.lowStockItems.slice(0, 8).map(item => {
      const balance = stockBalances.find(b => b.item_id === item.id)
      return {
        id: item.id,
        name: item.name,
        stock: balance?.quantity || 0,
        alert: item.low_stock_alert || 5,
        unit: item.unit || 'قطعة',
      }
    })
  }, [kpis.lowStockItems, stockBalances])

  return (
    <div className="space-y-7 pb-12 select-none" dir="rtl">
      {/* ─── Logixa Pro Standard Welcome Banner ─── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-gradient-to-bl from-blue-700 via-indigo-700 to-slate-900 p-6 sm:p-7 rounded-3xl shadow-xl shadow-blue-600/20 text-white border border-blue-500/20">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-white/15 backdrop-blur-md flex items-center justify-center text-2xl font-black shadow-inner border border-white/20">
            {role === 'admin' ? <Crown className="w-7 h-7 text-amber-300" /> : role === 'supervisor' ? <ShieldCheck className="w-7 h-7 text-emerald-300" /> : <CreditCard className="w-7 h-7 text-blue-300" />}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-xl sm:text-2xl font-black tracking-tight" suppressHydrationWarning>
                أهلاً بك، {currentUser?.name || 'مستخدم النظام'}
              </h1>
              <span className="inline-flex items-center gap-1.5 bg-white/20 text-white text-xs font-black px-3 py-1 rounded-full border border-white/30 backdrop-blur-sm shadow-xs" suppressHydrationWarning>
                {businessType === 'clothing' ? (
                  <><Shirt className="w-3.5 h-3.5 text-pink-200" /><span>نشاط الملابس والأحذية</span></>
                ) : businessType === 'pharmacy' ? (
                  <><Pill className="w-3.5 h-3.5 text-emerald-200" /><span>نشاط الصيدلية والمستلزمات</span></>
                ) : businessType === 'supermarket' ? (
                  <><ShoppingCart className="w-3.5 h-3.5 text-amber-200" /><span>نشاط السوبر ماركت والبقالة</span></>
                ) : businessType === 'restaurant' ? (
                  <><Utensils className="w-3.5 h-3.5 text-orange-200" /><span>نشاط المطاعم والكافيهات</span></>
                ) : (
                  <><Building2 className="w-3.5 h-3.5 text-blue-200" /><span>تجارة عامة ومخازن</span></>
                )}
              </span>
            </div>
            <p className="text-blue-200 text-xs sm:text-sm font-semibold mt-1 flex flex-wrap items-center gap-3" suppressHydrationWarning>
              <span className="flex items-center gap-1 font-bold text-white">
                <Building2 className="w-3.5 h-3.5 text-blue-300" />
                {currentUser?.branchName || 'الفرع الرئيسي'}
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-blue-300" />
                {new Date().toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </span>
            </p>
          </div>
        </div>

        <Link
          href="/dashboard/pos"
          className="bg-white/20 hover:bg-white/30 backdrop-blur-md text-white font-black px-6 py-3.5 rounded-2xl flex items-center gap-2.5 transition-all border border-white/30 shadow-lg hover:scale-105 active:scale-95 cursor-pointer"
        >
          <ShoppingCart className="w-5 h-5 text-white" />
          <span>فتح الكاشير (F2)</span>
        </Link>
      </div>

      {/* ─── 2. Real-time KPI Cards Grid ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          title="مبيعات اليوم"
          value={formatCurrency(kpis.todaySalesTotal)}
          icon={TrendingUp}
          color="blue"
          trend={kpis.todaySalesTotal > 0 ? 'up' : 'neutral'}
          trendLabel={`${kpis.todayInvoiceCount} فاتورة صادرة`}
        />
        <StatCard
          title="صافي اليوم (بعد المرتجعات)"
          value={formatCurrency(kpis.todayNet)}
          icon={DollarSign}
          color="green"
          trend={kpis.todayNet > 0 ? 'up' : kpis.todayNet < 0 ? 'down' : 'neutral'}
          trendLabel={kpis.todayReturnsTotal > 0 ? `مرتجعات: ${formatCurrency(kpis.todayReturnsTotal)}` : 'لا توجد مرتجعات'}
        />
        {role === 'cashier' ? (
          <StatCard
            title="فواتيرك المسجلة اليوم"
            value={`${kpis.todayInvoiceCount} فاتورة`}
            icon={Receipt}
            color="purple"
            trend="neutral"
            trendLabel="نقطة البيع نشطة وجاهزة"
          />
        ) : (
          <StatCard
            title="إجمالي ربح تقديري"
            value={formatCurrency(kpis.grossProfit)}
            icon={BarChart3}
            color="purple"
            trend={kpis.grossProfit > 0 ? 'up' : 'neutral'}
            trendLabel={`إجمالي المبيعات: ${formatCurrency(kpis.totalSalesAllTime)}`}
          />
        )}
        <StatCard
          title="حالة المخزون"
          value={`${kpis.lowStockItems.length} صنف منخفض`}
          icon={AlertTriangle}
          color={kpis.lowStockItems.length > 0 ? 'amber' : 'cyan'}
          trend={kpis.outOfStockItems.length > 0 ? 'down' : 'neutral'}
          trendLabel={kpis.outOfStockItems.length > 0 ? `${kpis.outOfStockItems.length} نفد بالكامل` : `${kpis.activeItems} صنف متوفر`}
        />
      </div>

      {/* ─── Charts + Tables Row ─── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Sales Chart - Last 7 Days */}
        <div className="xl:col-span-2 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-sm p-5">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              حركة المبيعات — آخر 7 أيام
            </h2>
            <span className="text-xs font-bold text-slate-400 dark:text-slate-500 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              تحديث لحظي
            </span>
          </div>
          <div className="h-[280px] w-full" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="returnsGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#F43F5E" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#F43F5E" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: '#94A3B8', fontSize: 12, fontWeight: 700 }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fill: '#94A3B8', fontSize: 11 }} width={65} tickFormatter={(v) => `${v}`} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1E293B', border: 'none', borderRadius: '12px', color: '#fff', fontSize: '13px', fontWeight: 700, direction: 'rtl' }}
                  labelStyle={{ color: '#94A3B8', marginBottom: 4 }}
                  formatter={(value: any, name: any) => [
                    `${Number(value || 0).toFixed(2)} ج.م`,
                    name === 'sales' ? 'المبيعات' : 'المرتجعات'
                  ]}
                />
                <Area type="monotone" dataKey="sales" name="sales" stroke="#3B82F6" strokeWidth={3} fill="url(#salesGradient)" dot={{ r: 4, fill: '#3B82F6', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6 }} />
                <Area type="monotone" dataKey="returns" name="returns" stroke="#F43F5E" strokeWidth={2} fill="url(#returnsGradient)" dot={{ r: 3, fill: '#F43F5E', strokeWidth: 2, stroke: '#fff' }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center justify-center gap-6 mt-3 text-xs font-bold text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-blue-500 inline-block" /> المبيعات</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-rose-500 inline-block" /> المرتجعات</span>
          </div>
        </div>

        {/* Low Stock Alert Table */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-sm p-5">
          <h2 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2 mb-4">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            تنبيه نقص المخزون
          </h2>
          {lowStockList.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400 dark:text-slate-500">
              <Package className="w-12 h-12 mb-3 opacity-40" />
              <p className="text-sm font-bold">المخزون بخير — لا توجد تنبيهات</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {lowStockList.map(item => {
                const isOut = item.stock <= 0
                return (
                  <Link key={item.id} href={`/dashboard/items/${item.id}`} className="flex items-center justify-between p-3 rounded-xl border border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-slate-900 dark:text-white truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{item.name}</p>
                      <p className="text-xs text-slate-400 dark:text-slate-500 font-semibold">حد التنبيه: {item.alert} {item.unit}</p>
                    </div>
                    <span className={`text-sm font-black px-3 py-1 rounded-lg ${isOut ? 'bg-rose-100 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400' : 'bg-amber-100 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400'}`}>
                      {isOut ? 'نفد' : `${item.stock} ${item.unit}`}
                    </span>
                  </Link>
                )
              })}
            </div>
          )}
          <Link href="/dashboard/items" className="block text-center text-xs font-bold text-blue-600 dark:text-blue-400 mt-4 hover:underline">
            عرض كل الأصناف →
          </Link>
        </div>
      </div>

      {/* ─── Recent Invoices ─── */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800">
          <h2 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
            <Receipt className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            أحدث الفواتير
          </h2>
          <Link href="/dashboard/sales" className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline">عرض الكل →</Link>
        </div>
        {recentInvoices.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-slate-400 dark:text-slate-500">
            <Receipt className="w-12 h-12 mb-3 opacity-40" />
            <p className="text-sm font-bold">لم يتم إصدار فواتير بعد</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-right">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/60">
                  <th className="px-5 py-3 text-xs font-black text-slate-500 dark:text-slate-400">رقم الفاتورة</th>
                  <th className="px-5 py-3 text-xs font-black text-slate-500 dark:text-slate-400">التاريخ</th>
                  <th className="px-5 py-3 text-xs font-black text-slate-500 dark:text-slate-400">العميل</th>
                  <th className="px-5 py-3 text-xs font-black text-slate-500 dark:text-slate-400">الإجمالي</th>
                  <th className="px-5 py-3 text-xs font-black text-slate-500 dark:text-slate-400">حالة السداد</th>
                </tr>
              </thead>
              <tbody>
                {recentInvoices.map(sale => (
                  <tr key={sale.id} className="border-t border-slate-100 dark:border-slate-800 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="px-5 py-3.5 font-mono font-bold text-blue-600 dark:text-blue-400 text-xs" dir="ltr">{sale.invoice_number}</td>
                    <td className="px-5 py-3.5 text-slate-600 dark:text-slate-300 font-semibold text-xs">
                      {sale.created_at ? new Date(sale.created_at).toLocaleDateString('ar-EG', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                    </td>
                    <td className="px-5 py-3.5 text-slate-700 dark:text-slate-200 font-bold text-xs">{sale.customer_name || 'عميل نقدي'}</td>
                    <td className="px-5 py-3.5 font-black text-emerald-700 dark:text-emerald-400 text-sm" dir="ltr">{formatCurrency(sale.total || 0)}</td>
                    <td className="px-5 py-3.5">
                      <span className={`text-[11px] font-black px-2.5 py-1 rounded-lg ${sale.payment_status === 'paid' ? 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400' : sale.payment_status === 'partial' ? 'bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'}`}>
                        {sale.payment_status === 'paid' ? 'مدفوعة' : sale.payment_status === 'partial' ? 'سداد جزئي' : 'آجلة'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ─── Summary Cards Row ─── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/90 dark:border-slate-800 p-4 text-center">
          <p className="text-3xl font-black text-slate-900 dark:text-white">{kpis.activeItems}</p>
          <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-1">صنف نشط</p>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/90 dark:border-slate-800 p-4 text-center">
          <p className="text-3xl font-black text-slate-900 dark:text-white">{sales.length}</p>
          <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-1">إجمالي الفواتير</p>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/90 dark:border-slate-800 p-4 text-center" dir="ltr">
          <p className="text-3xl font-black text-blue-600 dark:text-blue-400">{formatCurrency(kpis.totalSalesAllTime)}</p>
          <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-1" dir="rtl">إجمالي المبيعات</p>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/90 dark:border-slate-800 p-4 text-center" dir="ltr">
          <p className="text-3xl font-black text-purple-600 dark:text-purple-400">{formatCurrency(kpis.totalPurchasesAllTime)}</p>
          <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-1" dir="rtl">إجمالي المشتريات</p>
        </div>
      </div>

      {/* ─── 3. Solid Category Color-Coded Panels (Role Protected & High-Impact Typography) ─── */}
      <div className="space-y-5 pt-4">
        <h2 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2.5">
          <Layers className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          {role === 'cashier' ? 'الوصول السريع لعمليات البيع (الكاشير)' : 'لوحة العمليات والأقسام الرئيسية'}
        </h2>

        <div className={`grid gap-6 items-start ${
          role === 'cashier' 
            ? 'grid-cols-1 max-w-xl' 
            : role === 'supervisor' 
              ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3' 
              : 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-4'
        }`}>
          
          {/* Panel 1: المبيعات (Magenta Pink) - All Roles */}
          <div className="bg-slate-900 border-2 border-slate-800 rounded-3xl p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3.5">
              <h3 className="text-lg font-black text-white flex items-center gap-2.5">
                <div className="w-3.5 h-3.5 rounded-full bg-pink-500 shadow-lg shadow-pink-500/60 animate-pulse" />
                المبيعات
              </h3>
              <span className="text-xs font-black text-pink-400 bg-pink-500/15 border border-pink-500/30 px-3 py-1 rounded-lg font-mono">
                POS
              </span>
            </div>

            {/* Hero Button */}
            <Link
              href="/dashboard/pos"
              className="flex flex-col items-center justify-center p-7 rounded-2xl bg-gradient-to-br from-[#d91e77] via-[#c01768] to-[#9d174d] hover:from-[#e11d7f] hover:to-[#be185d] text-white shadow-xl shadow-pink-600/40 transition-all duration-200 hover:-translate-y-1 active:scale-95 group text-center min-h-[165px] cursor-pointer"
            >
              <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center mb-3 group-hover:scale-110 transition-transform shadow-inner ring-4 ring-white/10">
                <ShoppingCart className="w-8 h-8 text-white" />
              </div>
              <span className="text-xl font-black tracking-tight">نقطة البيع (الكاشير)</span>
              <span className="text-xs font-black text-pink-100 opacity-95 mt-1 bg-black/20 px-3 py-0.5 rounded-full">فتح العملية (F2)</span>
            </Link>

            {/* Sub Grid 2x2 */}
            <div className="grid grid-cols-2 gap-3">
              <Link
                href="/dashboard/sales"
                className="p-4 min-h-[85px] bg-slate-800/90 hover:bg-slate-800 border-2 border-slate-700/60 rounded-2xl text-center flex flex-col items-center justify-center gap-2 text-white transition-all hover:border-pink-500/60 group cursor-pointer shadow-md active:scale-95"
              >
                <BarChart3 className="w-6 h-6 text-pink-400 group-hover:scale-110 transition-transform" />
                <span className="text-sm font-black">تقرير مبيعات</span>
              </Link>

              <Link
                href="/dashboard/sales-returns"
                className="p-4 min-h-[85px] bg-slate-800/90 hover:bg-slate-800 border-2 border-slate-700/60 rounded-2xl text-center flex flex-col items-center justify-center gap-2 text-white transition-all hover:border-pink-500/60 group cursor-pointer shadow-md active:scale-95"
              >
                <RotateCcw className="w-6 h-6 text-pink-400 group-hover:scale-110 transition-transform" />
                <span className="text-sm font-black">مرتجع بيع</span>
              </Link>

              <Link
                href="/dashboard/quotations"
                className="p-4 min-h-[85px] bg-slate-800/90 hover:bg-slate-800 border-2 border-slate-700/60 rounded-2xl text-center flex flex-col items-center justify-center gap-2 text-white transition-all hover:border-pink-500/60 group cursor-pointer shadow-md active:scale-95"
              >
                <FileSpreadsheet className="w-6 h-6 text-pink-400 group-hover:scale-110 transition-transform" />
                <span className="text-sm font-black">عروض أسعار</span>
              </Link>

              <Link
                href="/dashboard/customers"
                className="p-4 min-h-[85px] bg-slate-800/90 hover:bg-slate-800 border-2 border-slate-700/60 rounded-2xl text-center flex flex-col items-center justify-center gap-2 text-white transition-all hover:border-pink-500/60 group cursor-pointer shadow-md active:scale-95"
              >
                <Users className="w-6 h-6 text-pink-400 group-hover:scale-110 transition-transform" />
                <span className="text-sm font-black">العملاء</span>
              </Link>
            </div>
          </div>

          {/* Panel 2: المشتريات (Amber Orange) - Admin & Supervisor Only */}
          {(role === 'admin' || role === 'supervisor') && (
            <div className="bg-slate-900 border-2 border-slate-800 rounded-3xl p-6 shadow-2xl space-y-5">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3.5">
                <h3 className="text-lg font-black text-white flex items-center gap-2.5">
                  <div className="w-3.5 h-3.5 rounded-full bg-amber-500 shadow-lg shadow-amber-500/60 animate-pulse" />
                  المشتريات
                </h3>
                <span className="text-xs font-black text-amber-400 bg-amber-500/15 border border-amber-500/30 px-3 py-1 rounded-lg font-mono">
                  PURCHASE
                </span>
              </div>

              {/* Hero Button */}
              <Link
                href="/dashboard/purchases/new"
                className="flex flex-col items-center justify-center p-7 rounded-2xl bg-gradient-to-br from-[#d97706] via-[#b45309] to-[#92400e] hover:from-[#f59e0b] hover:to-[#d97706] text-white shadow-xl shadow-amber-600/40 transition-all duration-200 hover:-translate-y-1 active:scale-95 group text-center min-h-[165px] cursor-pointer"
              >
                <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center mb-3 group-hover:scale-110 transition-transform shadow-inner ring-4 ring-white/10">
                  <ShoppingBag className="w-8 h-8 text-white" />
                </div>
                <span className="text-xl font-black tracking-tight">إضافة مشتريات</span>
                <span className="text-xs font-black text-amber-100 opacity-95 mt-1 bg-black/20 px-3 py-0.5 rounded-full">تسجيل فاتورة شراء</span>
              </Link>

              {/* Sub Grid 2x2 */}
              <div className="grid grid-cols-2 gap-3">
                <Link
                  href="/dashboard/purchases"
                  className="p-4 min-h-[85px] bg-slate-800/90 hover:bg-slate-800 border-2 border-slate-700/60 rounded-2xl text-center flex flex-col items-center justify-center gap-2 text-white transition-all hover:border-amber-500/60 group cursor-pointer shadow-md active:scale-95"
                >
                  <Receipt className="w-6 h-6 text-amber-400 group-hover:scale-110 transition-transform" />
                  <span className="text-sm font-black">فواتير الشراء</span>
                </Link>

                <Link
                  href="/dashboard/purchase-returns"
                  className="p-4 min-h-[85px] bg-slate-800/90 hover:bg-slate-800 border-2 border-slate-700/60 rounded-2xl text-center flex flex-col items-center justify-center gap-2 text-white transition-all hover:border-amber-500/60 group cursor-pointer shadow-md active:scale-95"
                >
                  <Undo2 className="w-6 h-6 text-amber-400 group-hover:scale-110 transition-transform" />
                  <span className="text-sm font-black">مرتجع شراء</span>
                </Link>

                <Link
                  href="/dashboard/suppliers"
                  className="p-4 min-h-[85px] bg-slate-800/90 hover:bg-slate-800 border-2 border-slate-700/60 rounded-2xl text-center flex flex-col items-center justify-center gap-2 text-white transition-all hover:border-amber-500/60 group cursor-pointer shadow-md active:scale-95"
                >
                  <Building2 className="w-6 h-6 text-amber-400 group-hover:scale-110 transition-transform" />
                  <span className="text-sm font-black">الموردين</span>
                </Link>

                <Link
                  href="/dashboard/expenses"
                  className="p-4 min-h-[85px] bg-slate-800/90 hover:bg-slate-800 border-2 border-slate-700/60 rounded-2xl text-center flex flex-col items-center justify-center gap-2 text-white transition-all hover:border-amber-500/60 group cursor-pointer shadow-md active:scale-95"
                >
                  <DollarSign className="w-6 h-6 text-amber-400 group-hover:scale-110 transition-transform" />
                  <span className="text-sm font-black">المصروفات</span>
                </Link>
              </div>
            </div>
          )}

          {/* Panel 3: المخزون (Teal Emerald) - Admin & Supervisor Only */}
          {(role === 'admin' || role === 'supervisor') && (
            <div className="bg-slate-900 border-2 border-slate-800 rounded-3xl p-6 shadow-2xl space-y-5">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3.5">
                <h3 className="text-lg font-black text-white flex items-center gap-2.5">
                  <div className="w-3.5 h-3.5 rounded-full bg-teal-500 shadow-lg shadow-teal-500/60 animate-pulse" />
                  المخزون
                </h3>
                <span className="text-xs font-black text-teal-400 bg-teal-500/15 border border-teal-500/30 px-3 py-1 rounded-lg font-mono">
                  STOCK
                </span>
              </div>

              {/* Hero Button */}
              <Link
                href="/dashboard/items"
                className="flex flex-col items-center justify-center p-7 rounded-2xl bg-gradient-to-br from-[#0d9488] via-[#0f766e] to-[#115e59] hover:from-[#14b8a6] hover:to-[#0d9488] text-white shadow-xl shadow-teal-600/40 transition-all duration-200 hover:-translate-y-1 active:scale-95 group text-center min-h-[165px] cursor-pointer"
              >
                <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center mb-3 group-hover:scale-110 transition-transform shadow-inner ring-4 ring-white/10">
                  <Package className="w-8 h-8 text-white" />
                </div>
                <span className="text-xl font-black tracking-tight">
                  {businessType === 'pharmacy' ? 'الأدوية والمستلزمات' : 'الأصناف والمخزون'}
                </span>
                <span className="text-xs font-black text-teal-100 opacity-95 mt-1 bg-black/20 px-3 py-0.5 rounded-full">إدارة الكميات والأسعار</span>
              </Link>

              {/* Sub Grid 2x2 */}
              <div className="grid grid-cols-2 gap-3">
                <Link
                  href="/dashboard/items/new"
                  className="p-4 min-h-[85px] bg-slate-800/90 hover:bg-slate-800 border-2 border-slate-700/60 rounded-2xl text-center flex flex-col items-center justify-center gap-2 text-white transition-all hover:border-teal-500/60 group cursor-pointer shadow-md active:scale-95"
                >
                  <Package className="w-6 h-6 text-teal-400 group-hover:scale-110 transition-transform" />
                  <span className="text-sm font-black">إضافة صنف</span>
                </Link>

                <Link
                  href="/dashboard/stocktaking"
                  className="p-4 min-h-[85px] bg-slate-800/90 hover:bg-slate-800 border-2 border-slate-700/60 rounded-2xl text-center flex flex-col items-center justify-center gap-2 text-white transition-all hover:border-teal-500/60 group cursor-pointer shadow-md active:scale-95"
                >
                  <ClipboardList className="w-6 h-6 text-teal-400 group-hover:scale-110 transition-transform" />
                  <span className="text-sm font-black">حالة المخزون</span>
                </Link>

                <Link
                  href="/dashboard/transfers"
                  className="p-4 min-h-[85px] bg-slate-800/90 hover:bg-slate-800 border-2 border-slate-700/60 rounded-2xl text-center flex flex-col items-center justify-center gap-2 text-white transition-all hover:border-teal-500/60 group cursor-pointer shadow-md active:scale-95"
                >
                  <ArrowLeftRight className="w-6 h-6 text-teal-400 group-hover:scale-110 transition-transform" />
                  <span className="text-sm font-black">تحويل مخزون</span>
                </Link>

                <Link
                  href="/dashboard/barcode-print"
                  className="p-4 min-h-[85px] bg-slate-800/90 hover:bg-slate-800 border-2 border-slate-700/60 rounded-2xl text-center flex flex-col items-center justify-center gap-2 text-white transition-all hover:border-teal-500/60 group cursor-pointer shadow-md active:scale-95"
                >
                  <Tag className="w-6 h-6 text-teal-400 group-hover:scale-110 transition-transform" />
                  <span className="text-sm font-black">طباعة باركود</span>
                </Link>
              </div>
            </div>
          )}

          {/* Panel 4: الشؤون الإدارية والمالية (Purple Indigo) - Admin Only */}
          {role === 'admin' && (
            <div className="bg-slate-900 border-2 border-slate-800 rounded-3xl p-6 shadow-2xl space-y-5">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3.5">
                <h3 className="text-lg font-black text-white flex items-center gap-2.5">
                  <div className="w-3.5 h-3.5 rounded-full bg-purple-500 shadow-lg shadow-purple-500/60 animate-pulse" />
                  الشؤون الإدارية والمالية
                </h3>
                <span className="text-xs font-black text-purple-400 bg-purple-500/15 border border-purple-500/30 px-3 py-1 rounded-lg font-mono">
                  ADMIN
                </span>
              </div>

              {/* Hero Button */}
              <Link
                href="/dashboard/settings"
                className="flex flex-col items-center justify-center p-7 rounded-2xl bg-gradient-to-br from-[#6366f1] via-[#4f46e5] to-[#4338ca] hover:from-[#818cf8] hover:to-[#6366f1] text-white shadow-xl shadow-indigo-600/40 transition-all duration-200 hover:-translate-y-1 active:scale-95 group text-center min-h-[165px] cursor-pointer"
              >
                <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center mb-3 group-hover:scale-110 transition-transform shadow-inner ring-4 ring-white/10">
                  <Settings className="w-8 h-8 text-white" />
                </div>
                <span className="text-xl font-black tracking-tight">الإعدادات</span>
                <span className="text-xs font-black text-indigo-100 opacity-95 mt-1 bg-black/20 px-3 py-0.5 rounded-full">تخصيص النشاط والتهيئة</span>
              </Link>

              {/* Sub Grid 2x2 */}
              <div className="grid grid-cols-2 gap-3">
                <Link
                  href="/dashboard/employees"
                  className="p-4 min-h-[85px] bg-slate-800/90 hover:bg-slate-800 border-2 border-slate-700/60 rounded-2xl text-center flex flex-col items-center justify-center gap-2 text-white transition-all hover:border-purple-500/60 group cursor-pointer shadow-md active:scale-95"
                >
                  <UserCog className="w-6 h-6 text-purple-400 group-hover:scale-110 transition-transform" />
                  <span className="text-sm font-black">المستخدمين</span>
                </Link>

                <Link
                  href="/dashboard/reports"
                  className="p-4 min-h-[85px] bg-slate-800/90 hover:bg-slate-800 border-2 border-slate-700/60 rounded-2xl text-center flex flex-col items-center justify-center gap-2 text-white transition-all hover:border-purple-500/60 group cursor-pointer shadow-md active:scale-95"
                >
                  <BarChart3 className="w-6 h-6 text-purple-400 group-hover:scale-110 transition-transform" />
                  <span className="text-sm font-black">الأرباح والخسائر</span>
                </Link>

                <Link
                  href="/login"
                  className="p-4 min-h-[85px] bg-slate-800/90 hover:bg-slate-800 border-2 border-slate-700/60 rounded-2xl text-center flex flex-col items-center justify-center gap-2 text-white transition-all hover:border-purple-500/60 group cursor-pointer shadow-md active:scale-95"
                >
                  <Crown className="w-6 h-6 text-purple-400 group-hover:scale-110 transition-transform" />
                  <span className="text-sm font-black">تبديل الحساب</span>
                </Link>

                <Link
                  href="/dashboard/settings"
                  className="p-4 min-h-[85px] bg-slate-800/90 hover:bg-slate-800 border-2 border-slate-700/60 rounded-2xl text-center flex flex-col items-center justify-center gap-2 text-white transition-all hover:border-purple-500/60 group cursor-pointer shadow-md active:scale-95"
                >
                  <Activity className="w-6 h-6 text-purple-400 group-hover:scale-110 transition-transform" />
                  <span className="text-sm font-black">سجل النشاط</span>
                </Link>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
