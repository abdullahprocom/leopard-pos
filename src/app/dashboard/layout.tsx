'use client'

import { ReactNode, useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
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
  Menu,
  X,
  ShieldCheck,
  BarChart3,
  Calculator,
  Printer,
  Headphones,
  Bell,
  LogOut,
  User,
  Crown,
  CreditCard,
  Lock,
  Tag,
  FileSpreadsheet,
  DollarSign,
} from 'lucide-react'
import { OnlineStatus } from '@/components/OnlineStatus'
import { ThemeToggle } from '@/components/theme-toggle'
import { useStore } from '@/lib/store-context'
import { useAuth, canAccessRoute } from '@/lib/auth-context'
import { CalculatorModal } from '@/components/calculator-modal'
import { Button } from '@/components/ui/button'

// Complete navigation links with modern Lucide icons
const navLinks = [
  { label: 'الرئيسية', href: '/dashboard', icon: Home, roles: ['admin', 'supervisor', 'cashier'] },
  { label: 'نقطة البيع (الكاشير)', href: '/dashboard/pos', icon: ShoppingCart, highlight: true, roles: ['admin', 'supervisor', 'cashier'] },
  { label: 'الأصناف والمخزون', href: '/dashboard/items', icon: Package, roles: ['admin', 'supervisor'] },
  { label: 'المشتريات والفواتير', href: '/dashboard/purchases', icon: ShoppingBag, roles: ['admin', 'supervisor'] },
  { label: 'مرتجع الشراء', href: '/dashboard/purchase-returns', icon: Undo2, roles: ['admin', 'supervisor'] },
  { label: 'المصروفات اليومية', href: '/dashboard/expenses', icon: DollarSign, roles: ['admin', 'supervisor'] },
  { label: 'طباعة الباركود', href: '/dashboard/barcode-print', icon: Tag, roles: ['admin', 'supervisor'] },
  { label: 'الجرد والتسوية', href: '/dashboard/stocktaking', icon: ClipboardList, roles: ['admin', 'supervisor'] },
  { label: 'النقل المخزني', href: '/dashboard/transfers', icon: ArrowLeftRight, roles: ['admin', 'supervisor'] },
  { label: 'سجل المبيعات', href: '/dashboard/sales', icon: Receipt, roles: ['admin', 'supervisor', 'cashier'] },
  { label: 'مرتجع المبيعات', href: '/dashboard/sales-returns', icon: RotateCcw, roles: ['admin', 'supervisor', 'cashier'] },
  { label: 'عروض الأسعار', href: '/dashboard/quotations', icon: FileSpreadsheet, roles: ['admin', 'supervisor', 'cashier'] },
  { label: 'العملاء', href: '/dashboard/customers', icon: Users, roles: ['admin', 'supervisor', 'cashier'] },
  { label: 'الموردين', href: '/dashboard/suppliers', icon: Building2, roles: ['admin', 'supervisor'] },
  { label: 'التقارير والأرباح', href: '/dashboard/reports', icon: BarChart3, roles: ['admin', 'supervisor'] },
  { label: 'الموظفين والصلاحيات', href: '/dashboard/employees', icon: UserCog, roles: ['admin'] },
  { label: 'إعدادات النظام', href: '/dashboard/settings', icon: Settings, roles: ['admin'] },
]

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [isMobileOpen, setIsMobileOpen] = useState(false)
  const [isDesktopCollapsed, setIsDesktopCollapsed] = useState(false)
  const [isCalcOpen, setIsCalcOpen] = useState(false)
  const { storeName, businessType, isActivated } = useStore()
  const { currentUser, role, roleLabel, logout, isAdmin, isCashier, isSupervisor } = useAuth()

  // Auto-close mobile drawer on route change
  useEffect(() => {
    setIsMobileOpen(false)
  }, [pathname])

  // Global F4 shortcut for Calculator
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'F4') {
        e.preventDefault()
        setIsCalcOpen(prev => !prev)
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [])

  const businessTypeLabels: Record<string, string> = {
    supermarket: 'سوبر ماركت',
    general: 'تجارة عامة',
    pharmacy: 'صيدلية',
    clothing: 'ملابس',
    restaurant: 'مطاعم',
  }

  // Filter links for current role
  const visibleNavLinks = navLinks.filter(item => !item.roles || item.roles.includes(role))

  // Permission Check Guard for current page
  const hasAccess = canAccessRoute(role, pathname)

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
            <img 
              src="/icon.png" 
              alt="ERP System" 
              className="w-10 h-10 rounded-xl object-cover shadow-lg shadow-blue-600/30 border border-blue-500/30 shrink-0" 
            />
            {!isDesktopCollapsed && (
              <div className="transition-opacity duration-200">
                <span className="text-xl font-black text-white tracking-tight">
                  ERP <span className="text-blue-500">System</span>
                </span>
                <p className="text-[11px] font-bold text-slate-400 truncate max-w-[150px]" suppressHydrationWarning>
                  {storeName} ({businessTypeLabels[businessType] || 'سوبر ماركت'})
                </p>
              </div>
            )}
          </div>

          {/* Close button on mobile */}
          <button 
            type="button"
            className="lg:hidden p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            onClick={() => setIsMobileOpen(false)}
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Sidebar Nav Links */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1.5 custom-scrollbar">
          {visibleNavLinks.map((item) => {
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
                        F2
                      </span>
                    )}
                  </>
                )}
              </Link>
            )
          })}
        </nav>

        {/* Sidebar Footer & Offline License Status */}
        <div className="p-3 border-t border-slate-800/60 bg-slate-950/40 shrink-0 flex items-center justify-between">
          {!isDesktopCollapsed ? (
            <div className="flex items-center justify-between w-full text-xs">
              <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
                <ShieldCheck className="w-4 h-4" />
                <span>{isActivated ? 'مرخص محلياً' : 'تجريبي'}</span>
              </div>
              <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded-md font-mono">
                ERP v2.0
              </span>
            </div>
          ) : (
            <span className="mx-auto text-[10px] bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded font-mono">
              v2.0
            </span>
          )}
        </div>
      </aside>

      {/* 3. Main Content Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden relative">
        
        {/* Top Navbar Header */}
        <header className="h-20 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200/90 dark:border-slate-800 flex items-center justify-between px-4 sm:px-8 z-10 shadow-xs shrink-0 transition-colors">
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

            <div>
              <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-tight">
                {visibleNavLinks.find(item => item.href === '/dashboard' ? pathname === '/dashboard' : (pathname === item.href || pathname.startsWith(item.href + '/')))?.label || 'لوحة التحكم'}
              </h2>
            </div>
          </div>
          
          {/* Header Quick Tools Bar */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Calculator Quick Action Button */}
            <button
              type="button"
              onClick={() => setIsCalcOpen(true)}
              className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-950/40 text-slate-700 dark:text-slate-200 hover:text-blue-600 dark:hover:text-blue-400 border border-slate-200 dark:border-slate-700 transition-all cursor-pointer flex items-center gap-1.5 text-xs font-bold shadow-2xs"
              title="فتح الآلة الحاسبة (F4)"
            >
              <Calculator className="w-4 h-4 text-blue-500" />
              <span className="hidden sm:inline">آلة حاسبة</span>
            </button>

            {/* Active User Profile & Role Switcher */}
            <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 px-3 py-1.5 rounded-xl">
              <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-xs">
                {role === 'admin' ? <Crown className="w-4 h-4" /> : role === 'supervisor' ? <ShieldCheck className="w-4 h-4" /> : <CreditCard className="w-4 h-4" />}
              </div>
              <div className="hidden md:block text-right">
                <p className="text-xs font-black text-slate-900 dark:text-white leading-tight">
                  {currentUser.name}
                </p>
                <p className="text-[10px] font-bold text-blue-600 dark:text-blue-400 leading-tight">
                  {role === 'admin' ? 'مدير النظام' : role === 'supervisor' ? 'المشرف' : 'الكاشير'}
                </p>
              </div>

              <Link
                href="/login"
                className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
                title="تبديل المستخدم / تسجيل الخروج"
              >
                <LogOut className="w-3.5 h-3.5" />
              </Link>
            </div>

            <OnlineStatus />
            <ThemeToggle />
          </div>
        </header>

        {/* Scrollable Content Container */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 relative bg-slate-50 dark:bg-slate-950 transition-colors">
          <div className="max-w-7xl mx-auto w-full pb-28">
            {hasAccess ? (
              children
            ) : (
              <div className="bg-rose-500/10 border-2 border-rose-500/30 rounded-3xl p-8 text-center space-y-4 max-w-xl mx-auto my-12">
                <div className="w-16 h-16 rounded-3xl bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto border border-rose-500/30">
                  <Lock className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-black text-rose-500">
                  غير مصرح لك بالوصول إلى هذه الصفحة
                </h3>
                <p className="text-sm font-semibold text-slate-400 leading-relaxed">
                  حسابك الحالي مسجل بصفة ({roleLabel})، وهذه الشاشة مخصصة لإدارة النظام فقط.
                </p>
                <Button
                  onClick={() => router.push(isCashier ? '/dashboard/pos' : '/dashboard')}
                  className="bg-blue-600 hover:bg-blue-500 text-white font-black rounded-xl h-11 px-6 shadow-lg shadow-blue-600/30 cursor-pointer"
                >
                  العودة للشاشة المسموحة
                </Button>
              </div>
            )}
          </div>
        </main>
        
      </div>

      {/* Global Interactive Calculator Modal */}
      <CalculatorModal isOpen={isCalcOpen} onClose={() => setIsCalcOpen(false)} />
    </div>
  )
}
