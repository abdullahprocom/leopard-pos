'use client'

import { ReactNode, useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Home,
  Package,
  ShoppingBag,
  Undo2,
  ClipboardList,
  ArrowLeftRight,
  ShoppingCart,
  Receipt,
  RotateCcw,
  Users,
  Building2,
  UserCog,
  Settings,
  Sparkles,
  Menu,
  X,
  ChevronRight,
  ChevronLeft,
} from 'lucide-react'
import { OnlineStatus } from '@/components/OnlineStatus'
import { ThemeToggle } from '@/components/theme-toggle'

// Complete navigation links with modern Lucide icons
const navLinks = [
  { label: 'الرئيسية', href: '/dashboard', icon: Home },
  { label: 'نقطة البيع (الكاشير)', href: '/dashboard/pos', icon: ShoppingCart, highlight: true },
  { label: 'الأصناف والمخزون', href: '/dashboard/items', icon: Package },
  { label: 'المشتريات', href: '/dashboard/purchases', icon: ShoppingBag },
  { label: 'مرتجع الشراء', href: '/dashboard/purchase-returns', icon: Undo2 },
  { label: 'الجرد والتسوية', href: '/dashboard/stocktaking', icon: ClipboardList },
  { label: 'النقل المخزني', href: '/dashboard/transfers', icon: ArrowLeftRight },
  { label: 'سجل المبيعات', href: '/dashboard/sales', icon: Receipt },
  { label: 'مرتجع المبيعات', href: '/dashboard/sales-returns', icon: RotateCcw },
  { label: 'العملاء', href: '/dashboard/customers', icon: Users },
  { label: 'الموردين', href: '/dashboard/suppliers', icon: Building2 },
  { label: 'الموظفين والصلاحيات', href: '/dashboard/employees', icon: UserCog },
  { label: 'إعدادات النظام', href: '/dashboard/settings', icon: Settings },
]

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const [isMobileOpen, setIsMobileOpen] = useState(false)
  const [isDesktopCollapsed, setIsDesktopCollapsed] = useState(false)

  // Auto-close mobile drawer on route change
  useEffect(() => {
    setIsMobileOpen(false)
  }, [pathname])

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 overflow-hidden font-sans antialiased" dir="rtl">
      
      {/* 1. Mobile Backdrop Overlay */}
      {isMobileOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 lg:hidden transition-opacity duration-300"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* 2. Sidebar (Mobile Drawer + Desktop Collapsible) */}
      <aside className={`
        fixed lg:static inset-y-0 right-0 z-50
        bg-slate-900 dark:bg-slate-950 text-slate-300 flex flex-col h-full 
        shadow-[4px_0_24px_rgba(0,0,0,0.25)] border-l border-slate-800/80
        transition-all duration-300 ease-in-out shrink-0
        ${isMobileOpen ? 'translate-x-0 w-72' : 'translate-x-full lg:translate-x-0'}
        ${isDesktopCollapsed ? 'lg:w-20' : 'lg:w-72'}
      `}>
        
        {/* Logo & Close Button */}
        <div className="h-20 flex items-center justify-between px-5 border-b border-slate-800/60 shrink-0">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/25 border border-white/10 shrink-0">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            {!isDesktopCollapsed && (
              <div className="transition-opacity duration-200">
                <span className="text-xl font-black text-white tracking-tight">
                  Leopard <span className="text-blue-500">POS</span>
                </span>
                <p className="text-[11px] font-semibold text-slate-400">إدارة الكاشير والمخازن</p>
              </div>
            )}
          </div>

          {/* Close button on mobile */}
          <button 
            type="button"
            className="lg:hidden p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            onClick={() => setIsMobileOpen(false)}
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Sidebar Nav Links */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1.5 custom-scrollbar">
          {navLinks.map((item) => {
            const Icon = item.icon
            const isActive = item.href === '/dashboard'
              ? pathname === '/dashboard'
              : pathname === item.href || pathname.startsWith(item.href + '/')

            return (
              <Link
                key={item.href}
                href={item.href}
                title={isDesktopCollapsed ? item.label : undefined}
                className={`
                  flex items-center gap-3.5 px-3.5 py-3 rounded-xl transition-all duration-200 ease-in-out font-bold text-sm group
                  ${isDesktopCollapsed ? 'justify-center' : ''}
                  ${isActive
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-600/30'
                    : item.highlight
                      ? 'bg-blue-950/40 text-blue-400 border border-blue-800/40 hover:bg-blue-900/40 hover:text-white'
                      : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                  }
                `}
              >
                <Icon
                  className={`w-5 h-5 shrink-0 transition-transform duration-200 group-hover:scale-110 ${
                    isActive ? 'text-white' : item.highlight ? 'text-blue-400' : 'text-slate-400 group-hover:text-blue-400'
                  }`}
                />
                {!isDesktopCollapsed && (
                  <>
                    <span className="truncate">{item.label}</span>
                    {item.highlight && !isActive && (
                      <span className="mr-auto text-[10px] bg-blue-500/20 text-blue-300 border border-blue-400/20 px-2 py-0.5 rounded-md font-bold">
                        سريع
                      </span>
                    )}
                  </>
                )}
              </Link>
            )
          })}
        </nav>

        {/* Sidebar Footer & Collapse Toggle */}
        <div className="p-3 border-t border-slate-800/60 bg-slate-950/40 shrink-0 flex items-center justify-between">
          {!isDesktopCollapsed ? (
            <div className="flex items-center justify-between w-full text-xs">
              <span className="font-bold text-slate-300">نسخة v1.0</span>
              <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded-md font-mono">
                Offline
              </span>
            </div>
          ) : (
            <span className="mx-auto text-[10px] bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded font-mono">
              v1.0
            </span>
          )}
        </div>
      </aside>

      {/* 3. Main Content Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden relative">
        
        {/* Top Navbar Header */}
        <header className="h-20 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200/90 dark:border-slate-800 flex items-center justify-between px-4 sm:px-8 z-10 shadow-xs shrink-0 transition-colors">
          <div className="flex items-center gap-3">
            {/* Burger Menu Button (Mobile & Desktop Toggle) */}
            <button
              type="button"
              className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 active:scale-95 transition-all cursor-pointer shadow-2xs"
              onClick={() => {
                if (window.innerWidth < 1024) {
                  setIsMobileOpen(!isMobileOpen)
                } else {
                  setIsDesktopCollapsed(!isDesktopCollapsed)
                }
              }}
              title="إظهار / إخفاء القائمة الجانبية"
            >
              <Menu className="w-5 h-5" />
            </button>

            <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-tight">
              {navLinks.find(item => item.href === '/dashboard' ? pathname === '/dashboard' : (pathname === item.href || pathname.startsWith(item.href + '/')))?.label || 'لوحة القيادة'}
            </h2>
          </div>
          
          <div className="flex items-center gap-3 sm:gap-4">
            <OnlineStatus />
            <ThemeToggle />
          </div>
        </header>

        {/* Scrollable Content Container */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 relative bg-slate-50 dark:bg-slate-950 transition-colors">
          <div className="max-w-7xl mx-auto w-full pb-28">
            {children}
          </div>
        </main>
        
      </div>
    </div>
  )
}
