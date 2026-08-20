'use client'

import Link from 'next/link'
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
  ArrowUpRight,
  Boxes,
  ShieldCheck,
  Zap,
} from 'lucide-react'

const quickTiles = [
  {
    title: 'نقطة البيع (الكاشير)',
    subtitle: 'إصدار الفواتير الفورية ومسح الباركود والدفع النقدي/فيزا',
    icon: ShoppingCart,
    href: '/dashboard/pos',
    gradient: 'from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800',
  },
  {
    title: 'سجل المبيعات',
    subtitle: 'متابعة الفواتير المعتمدة والتحصيل وطباعة الإيصالات',
    icon: Receipt,
    href: '/dashboard/sales',
    gradient: 'from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800',
  },
  {
    title: 'مرتجع المبيعات',
    subtitle: 'استرجاع من فاتورة أو إرجاع حر وإعادة الرصيد',
    icon: RotateCcw,
    href: '/dashboard/sales-returns',
    gradient: 'from-rose-600 to-red-700 hover:from-rose-700 hover:to-red-800',
  },
]

const inventoryTiles = [
  {
    title: 'الأصناف والمخزون',
    subtitle: 'تعدد الباركود ومستويات التعبئة وتنبيهات النواقص',
    icon: Package,
    href: '/dashboard/items',
    gradient: 'from-blue-600/90 to-blue-800 hover:from-blue-700 hover:to-blue-900',
  },
  {
    title: 'فواتير المشتريات',
    subtitle: 'تسجيل بضاعة الموردين وحسابات التكلفة والكميات',
    icon: ShoppingBag,
    href: '/dashboard/purchases',
    gradient: 'from-amber-600 to-orange-700 hover:from-amber-700 hover:to-orange-800',
  },
  {
    title: 'مرتجع الشراء',
    subtitle: 'إرجاع بضاعة تالفة للمورد واسترداد النقدية',
    icon: Undo2,
    href: '/dashboard/purchase-returns',
    gradient: 'from-orange-600 to-rose-700 hover:from-orange-700 hover:to-rose-800',
  },
  {
    title: 'الجرد والتسوية',
    subtitle: 'مطابقة الفعلي بالدفتري وتسوية أرصدة العجز',
    icon: ClipboardList,
    href: '/dashboard/stocktaking',
    gradient: 'from-purple-600 to-violet-700 hover:from-purple-700 hover:to-violet-800',
  },
  {
    title: 'النقل والتحويل المخزني',
    subtitle: 'نقل البضائع بين الفروع والمستودعات',
    icon: ArrowLeftRight,
    href: '/dashboard/transfers',
    gradient: 'from-cyan-600 to-blue-700 hover:from-cyan-700 hover:to-blue-800',
  },
]

const managementTiles = [
  {
    title: 'دليل العملاء',
    subtitle: 'بيانات العملاء وسجل المشتريات والتواصل',
    icon: Users,
    href: '/dashboard/customers',
    gradient: 'from-indigo-600 to-indigo-800 hover:from-indigo-700 hover:to-indigo-900',
  },
  {
    title: 'الشركات والموردين',
    subtitle: 'بيانات الموردين والأرصدة المستحقة',
    icon: Building2,
    href: '/dashboard/suppliers',
    gradient: 'from-slate-700 to-slate-900 hover:from-slate-800 hover:to-slate-950',
  },
  {
    title: 'الموظفين والصلاحيات',
    subtitle: 'أدوار الكاشير والمشرفين ورموز PIN السريعة',
    icon: UserCog,
    href: '/dashboard/employees',
    gradient: 'from-violet-700 to-purple-900 hover:from-violet-800 hover:to-purple-950',
  },
  {
    title: 'إعدادات النظام',
    subtitle: 'بيانات المتجر والطباعة الحرارية والمزامنة',
    icon: Settings,
    href: '/dashboard/settings',
    gradient: 'from-slate-600 to-slate-800 hover:from-slate-700 hover:to-slate-900',
  },
]

export default function DashboardPage() {
  return (
    <div className="space-y-8" dir="rtl">
      
      {/* Clean Enterprise Cockpit Header */}
      <div className="bg-slate-900/90 rounded-2xl p-6 sm:p-8 text-white border border-slate-800 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 shadow-sm">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
            منظومة APR System المحاسبية
          </h1>
          <p className="text-slate-400 mt-1.5 text-xs sm:text-sm font-medium max-w-2xl">
            إدارة فورية لنقاط البيع، فواتير المشتريات والمخازن، والتقارير المالية والطباعة الحرارية.
          </p>
        </div>

        <Link href="/dashboard/pos" className="w-full sm:w-auto shrink-0">
          <button className="w-full sm:w-auto flex items-center justify-center gap-3 bg-blue-600 hover:bg-blue-500 text-white px-8 py-3.5 rounded-xl font-black text-base shadow-md shadow-blue-600/25 active:scale-95 transition-all cursor-pointer">
            <ShoppingCart className="w-5 h-5" />
            فتح الكاشير (F2)
          </button>
        </Link>
      </div>

      {/* Section 1: Quick Operations */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-slate-900 dark:text-white font-black text-base">
          <Zap className="w-4 h-4 text-amber-500" />
          <span>العمليات اليومية ونقاط البيع</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {quickTiles.map((tile) => {
            const Icon = tile.icon
            return (
              <Link
                key={tile.href}
                href={tile.href}
                className={`
                  bg-gradient-to-br ${tile.gradient}
                  rounded-2xl p-5 text-white
                  transition-all duration-200 transform hover:-translate-y-0.5 hover:shadow-lg active:scale-[0.99]
                  flex flex-col justify-between min-h-[150px] relative overflow-hidden group border border-white/10
                `}
              >
                <div className="flex items-start justify-between">
                  <div className="w-11 h-11 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform duration-200">
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <div className="w-7 h-7 rounded-full bg-white/10 group-hover:bg-white/20 flex items-center justify-center transition-colors">
                    <ArrowUpRight className="w-3.5 h-3.5 text-white" />
                  </div>
                </div>

                <div className="mt-4">
                  <h3 className="text-base font-black tracking-tight text-white mb-1">
                    {tile.title}
                  </h3>
                  <p className="text-xs font-medium text-white/80 line-clamp-1">
                    {tile.subtitle}
                  </p>
                </div>
              </Link>
            )
          })}
        </div>
      </div>

      {/* Section 2: Inventory & Supply Chain */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-slate-900 dark:text-white font-black text-base">
          <Boxes className="w-4 h-4 text-blue-500" />
          <span>المخزون والمشتريات</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {inventoryTiles.map((tile) => {
            const Icon = tile.icon
            return (
              <Link
                key={tile.href}
                href={tile.href}
                className={`
                  bg-gradient-to-br ${tile.gradient}
                  rounded-2xl p-5 text-white
                  transition-all duration-200 transform hover:-translate-y-0.5 hover:shadow-lg active:scale-[0.99]
                  flex flex-col justify-between min-h-[140px] relative overflow-hidden group border border-white/10
                `}
              >
                <div className="flex items-start justify-between">
                  <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform duration-200">
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <div className="w-7 h-7 rounded-full bg-white/10 group-hover:bg-white/20 flex items-center justify-center transition-colors">
                    <ArrowUpRight className="w-3.5 h-3.5 text-white" />
                  </div>
                </div>

                <div className="mt-3">
                  <h3 className="text-sm font-black tracking-tight text-white mb-1">
                    {tile.title}
                  </h3>
                  <p className="text-[11px] font-medium text-white/80 line-clamp-1">
                    {tile.subtitle}
                  </p>
                </div>
              </Link>
            )
          })}
        </div>
      </div>

      {/* Section 3: Management & Administration */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-slate-900 dark:text-white font-black text-base">
          <ShieldCheck className="w-4 h-4 text-purple-500" />
          <span>الإدارة والشركاء وإعدادات النظام</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {managementTiles.map((tile) => {
            const Icon = tile.icon
            return (
              <Link
                key={tile.href}
                href={tile.href}
                className={`
                  bg-gradient-to-br ${tile.gradient}
                  rounded-2xl p-5 text-white
                  transition-all duration-200 transform hover:-translate-y-0.5 hover:shadow-lg active:scale-[0.99]
                  flex flex-col justify-between min-h-[140px] relative overflow-hidden group border border-white/10
                `}
              >
                <div className="flex items-start justify-between">
                  <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform duration-200">
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <div className="w-7 h-7 rounded-full bg-white/10 group-hover:bg-white/20 flex items-center justify-center transition-colors">
                    <ArrowUpRight className="w-3.5 h-3.5 text-white" />
                  </div>
                </div>

                <div className="mt-3">
                  <h3 className="text-sm font-black tracking-tight text-white mb-1">
                    {tile.title}
                  </h3>
                  <p className="text-[11px] font-medium text-white/80 line-clamp-1">
                    {tile.subtitle}
                  </p>
                </div>
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
