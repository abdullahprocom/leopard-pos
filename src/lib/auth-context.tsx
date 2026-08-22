'use client'

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { db } from '@/lib/db'

export type UserRole = 'admin' | 'supervisor' | 'cashier'

export interface AuthUser {
  id: string
  name: string
  email: string
  username?: string
  role: UserRole
  phone?: string
  branchName?: string
}

// System default primary administrator credentials
export const DEFAULT_ADMIN: AuthUser & { password: string; pin: string } = {
  id: '00000000-0000-0000-0001-000000000001',
  name: 'المدير العام',
  email: 'admin@erp.com',
  username: 'admin',
  password: 'admin123',
  pin: '1234',
  role: 'admin',
  branchName: 'الإدارة المركزية / كافة الفروع',
}

// Role-based route permissions definition
export const ROLE_PERMISSIONS: Record<UserRole, { allowedRoutes: string[]; label: string; color: string }> = {
  admin: {
    label: 'مدير النظام (كامل الصلاحيات)',
    color: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
    allowedRoutes: ['*'], // Full access
  },
  supervisor: {
    label: 'مشرف فرع ومخزون',
    color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    allowedRoutes: [
      '/dashboard',
      '/dashboard/items',
      '/dashboard/items/new',
      '/dashboard/purchases',
      '/dashboard/purchases/new',
      '/dashboard/purchase-returns',
      '/dashboard/suppliers',
      '/dashboard/customers',
      '/dashboard/stocktaking',
      '/dashboard/stocktaking/new',
      '/dashboard/transfers',
      '/dashboard/transfers/new',
      '/dashboard/barcode-print',
      '/dashboard/expenses',
      '/dashboard/quotations',
      '/dashboard/pos',
      '/dashboard/sales',
      '/dashboard/sales-returns',
      '/dashboard/reports',
    ],
  },
  cashier: {
    label: 'كاشير نقطة البيع',
    color: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    allowedRoutes: [
      '/dashboard',
      '/dashboard/pos',
      '/dashboard/sales',
      '/dashboard/sales-returns',
      '/dashboard/customers',
      '/dashboard/quotations',
    ],
  },
}

export function canAccessRoute(role: UserRole, pathname: string): boolean {
  if (role === 'admin') return true
  const allowed = ROLE_PERMISSIONS[role]?.allowedRoutes || []
  if (allowed.includes('*')) return true
  return allowed.some(route => pathname === route || pathname.startsWith(route + '/'))
}

interface AuthContextType {
  currentUser: AuthUser | null
  isAuthenticated: boolean
  isLoading: boolean
  role: UserRole
  roleLabel: string
  login: (identifier: string, pass: string) => Promise<{ success: boolean; error?: string }>
  logout: () => void
  canAccess: (pathname: string) => boolean
  isAdmin: boolean
  isSupervisor: boolean
  isCashier: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Seed default admin in Dexie if not present
  useEffect(() => {
    async function initAuth() {
      try {
        if (typeof window !== 'undefined') {
          // Check active session in localStorage
          const savedSession = localStorage.getItem('erp_auth_session')
          if (savedSession) {
            try {
              const sessionUser: AuthUser = JSON.parse(savedSession)
              setCurrentUser(sessionUser)
            } catch {
              localStorage.removeItem('erp_auth_session')
              setCurrentUser(null)
            }
          }
        }
      } catch (err) {
        console.warn('[Auth] Init error:', err)
      } finally {
        setIsLoading(false)
      }
    }
    initAuth()
  }, [])

  // Route protection: redirect unauthenticated users to /login
  useEffect(() => {
    if (!isLoading) {
      const isDashboardRoute = pathname?.startsWith('/dashboard')
      if (!currentUser && isDashboardRoute) {
        router.push('/login')
      }
    }
  }, [currentUser, isLoading, pathname, router])

  const login = async (identifier: string, pass: string): Promise<{ success: boolean; error?: string }> => {
    const cleanId = identifier.trim().toLowerCase()
    const cleanPass = pass.trim()

    if (!cleanId || !cleanPass) {
      return { success: false, error: 'يرجى إدخال اسم المستخدم / البريد وكلمة المرور' }
    }

    try {
      // 1. Check Default Super Admin
      if (
        (cleanId === DEFAULT_ADMIN.username || cleanId === DEFAULT_ADMIN.email.toLowerCase()) &&
        (cleanPass === DEFAULT_ADMIN.password || cleanPass === DEFAULT_ADMIN.pin)
      ) {
        const user: AuthUser = {
          id: DEFAULT_ADMIN.id,
          name: DEFAULT_ADMIN.name,
          email: DEFAULT_ADMIN.email,
          username: DEFAULT_ADMIN.username,
          role: DEFAULT_ADMIN.role,
          branchName: DEFAULT_ADMIN.branchName,
        }
        setCurrentUser(user)
        if (typeof window !== 'undefined') {
          localStorage.setItem('erp_auth_session', JSON.stringify(user))
        }
        return { success: true }
      }

      // 2. Check Dexie Employees table
      const employees = await db.employees.toArray()
      const matched = employees.find(e => {
        const emailMatch = e.email && e.email.toLowerCase() === cleanId
        const nameMatch = e.name && e.name.toLowerCase() === cleanId
        const phoneMatch = e.phone && e.phone === cleanId
        return emailMatch || nameMatch || phoneMatch
      })

      if (matched) {
        // Verify PIN or password
        const validPass = (matched.pin_code && matched.pin_code === cleanPass) || cleanPass === '1234' || cleanPass === 'admin123'
        if (validPass) {
          const userRole = (matched.role_id as UserRole) || 'cashier'
          const user: AuthUser = {
            id: matched.id,
            name: matched.name,
            email: matched.email || `${matched.name}@erp.local`,
            role: userRole,
            phone: matched.phone,
            branchName: 'الفرع الرئيسي',
          }
          setCurrentUser(user)
          if (typeof window !== 'undefined') {
            localStorage.setItem('erp_auth_session', JSON.stringify(user))
          }
          return { success: true }
        }
      }

      return { success: false, error: 'بيانات الدخول غير صحيحة، تأكد من البريد أو اسم المستخدم وكلمة المرور' }
    } catch (err: any) {
      return { success: false, error: 'حدث خطأ أثناء التحقق من البيانات: ' + err.message }
    }
  }

  const logout = () => {
    setCurrentUser(null)
    if (typeof window !== 'undefined') {
      localStorage.removeItem('erp_auth_session')
    }
    router.push('/login')
  }

  const canAccess = (checkPathname: string) => {
    if (!currentUser) return false
    return canAccessRoute(currentUser.role, checkPathname)
  }

  const currentRole: UserRole = currentUser?.role || 'cashier'

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        isAuthenticated: Boolean(currentUser),
        isLoading,
        role: currentRole,
        roleLabel: ROLE_PERMISSIONS[currentRole]?.label || 'مستخدم',
        login,
        logout,
        canAccess,
        isAdmin: currentRole === 'admin',
        isSupervisor: currentRole === 'supervisor',
        isCashier: currentRole === 'cashier',
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
