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
  Boxes,
  ShieldCheck,
  Zap,
  Truck,
} from 'lucide-react'

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
      {
        title: 'نقطة البيع (الكاشير)',
        icon: ShoppingCart,
        href: '/dashboard/pos',
        gradient: 'from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800',
      },
      {
        title: 'سجل المبيعات',
        icon: Receipt,
        href: '/dashboard/sales',
        gradient: 'from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800',
      },
      {
        title: 'مرتجع المبيعات',
        icon: RotateCcw,
        href: '/dashboard/sales-returns',
        gradient: 'from-rose-600 to-red-700 hover:from-rose-700 hover:to-red-800',
      },
    ],
  },
  {
    id: 'inventory',
    title: 'المخزون والأصناف',
    icon: Boxes,
    tiles: [
      {
        title: 'الأصناف والمخزون',
        icon: Package,
        href: '/dashboard/items',
        gradient: 'from-blue-600/90 to-blue-800 hover:from-blue-700 hover:to-blue-900',
      },
      {
        title: 'الجرد والتسوية',
        icon: ClipboardList,
        href: '/dashboard/stocktaking',
        gradient: 'from-purple-600 to-violet-700 hover:from-purple-700 hover:to-violet-800',
      },
      {
        title: 'النقل المخزني',
        icon: ArrowLeftRight,
        href: '/dashboard/transfers',
        gradient: 'from-cyan-600 to-blue-700 hover:from-cyan-700 hover:to-blue-800',
      },
    ],
  },
  {
    id: 'purchases',
    title: 'المشتريات والموردين',
    icon: Truck,
    tiles: [
      {
        title: 'فواتير المشتريات',
        icon: ShoppingBag,
        href: '/dashboard/purchases',
        gradient: 'from-amber-600 to-orange-700 hover:from-amber-700 hover:to-orange-800',
      },
      {
        title: 'مرتجع الشراء',
        icon: Undo2,
        href: '/dashboard/purchase-returns',
        gradient: 'from-orange-600 to-rose-700 hover:from-orange-700 hover:to-rose-800',
      },
      {
        title: 'الشركات والموردين',
        icon: Building2,
        href: '/dashboard/suppliers',
        gradient: 'from-slate-700 to-slate-900 hover:from-slate-800 hover:to-slate-950',
      },
    ],
  },
  {
    id: 'management',
    title: 'الإدارة والعملاء',
    icon: ShieldCheck,
    tiles: [
      {
        title: 'دليل العملاء',
        icon: Users,
        href: '/dashboard/customers',
        gradient: 'from-indigo-600 to-indigo-800 hover:from-indigo-700 hover:to-indigo-900',
      },
      {
        title: 'الموظفين والصلاحيات',
        icon: UserCog,
        href: '/dashboard/employees',
        gradient: 'from-violet-700 to-purple-900 hover:from-violet-800 hover:to-purple-950',
      },
      {
        title: 'إعدادات النظام',
        icon: Settings,
        href: '/dashboard/settings',
        gradient: 'from-slate-600 to-slate-800 hover:from-slate-700 hover:to-slate-900',
      },
    ],
  },
]

export default function DashboardPage() {
  return (
    <div className="space-y-6 select-none" dir="rtl">
      
      {/* Cockpit Executive Header */}
      <div className="bg-white dark:bg-slate-900/90 rounded-2xl p-5 sm:p-6 text-slate-900 dark:text-white border border-slate-200/90 dark:border-slate-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shadow-sm transition-colors">
        <div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white">
            منظومة APR System المحاسبية
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1 text-xs font-semibold">
            لوحة العمليات السريعة وإدارة الكاشير والمخازن
          </p>
        </div>

        <Link href="/dashboard/pos" className="w-full sm:w-auto shrink-0">
          <button className="w-full sm:w-auto flex items-center justify-center gap-2.5 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white px-7 py-3 rounded-xl font-black text-sm shadow-md shadow-blue-600/25 active:scale-95 transition-all cursor-pointer">
            <ShoppingCart className="w-4 h-4" />
            فتح الكاشير (F2)
          </button>
        </Link>
      </div>

      {/* 4 Functional Columns Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {groups.map((group) => {
          const GroupIcon = group.icon
          return (
            <div key={group.id} className="flex flex-col space-y-3">
              
              {/* Group Column Header */}
              <div className="flex items-center gap-2 px-1 text-slate-700 dark:text-slate-200 font-extrabold text-sm border-b border-slate-200/80 dark:border-slate-800 pb-2">
                <GroupIcon className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                <span>{group.title}</span>
              </div>

              {/* Tiles List in Column */}
              <div className="flex flex-col gap-3">
                {group.tiles.map((tile) => {
                  const TileIcon = tile.icon
                  return (
                    <Link
                      key={tile.href}
                      href={tile.href}
                      className={`
                        bg-gradient-to-br ${tile.gradient}
                        rounded-2xl p-5 text-white
                        transition-transform duration-150 ease-out hover:-translate-y-0.5 active:scale-95
                        flex flex-col items-center justify-center text-center
                        min-h-[125px] sm:min-h-[135px] border border-white/10 shadow-sm hover:shadow-md cursor-pointer group
                      `}
                    >
                      {/* Centered Large Icon */}
                      <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-xs flex items-center justify-center shadow-xs group-hover:scale-110 transition-transform duration-150">
                        <TileIcon className="w-6 h-6 text-white" />
                      </div>

                      {/* Centered Bold Title */}
                      <h3 className="text-sm sm:text-base font-black tracking-tight text-white mt-3 text-center leading-snug">
                        {tile.title}
                      </h3>
                    </Link>
                  )
                })}
              </div>

            </div>
          )
        })}
      </div>

    </div>
  )
}
