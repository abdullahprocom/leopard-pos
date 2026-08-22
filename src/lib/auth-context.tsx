'use client'

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'

export type UserRole = 'admin' | 'supervisor' | 'cashier'

export interface AuthUser {
  id: string
  username: string
  name: string
  role: UserRole
  avatar?: string
  branchName?: string
}

export const PRESET_USERS: AuthUser[] = [
  {
    id: '00000000-0000-0000-0001-000000000001',
    username: 'admin',
    name: 'المدير العام (أحمد)',
    role: 'admin',
    avatar: 'A',
    branchName: 'الإدارة المركزية / كافة الفروع',
  },
  {
    id: '00000000-0000-0000-0001-000000000002',
    username: 'supervisor',
    name: 'المشرف (عوض)',
    role: 'supervisor',
    avatar: 'S',
    branchName: 'الفرع الرئيسي - صالة العرض',
  },
  {
    id: '00000000-0000-0000-0001-000000000003',
    username: 'cashier',
    name: 'الكاشير (محمد)',
    role: 'cashier',
    avatar: 'C',
    branchName: 'الفرع الرئيسي - كاشير 1',
  },
]

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
  currentUser: AuthUser
  role: UserRole
  roleLabel: string
  loginAs: (user: AuthUser) => void
  logout: () => void
  canAccess: (pathname: string) => boolean
  isAdmin: boolean
  isSupervisor: boolean
  isCashier: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<AuthUser>(PRESET_USERS[0])
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedUserStr = localStorage.getItem('erp_auth_user')
      if (savedUserStr) {
        try {
          const parsed = JSON.parse(savedUserStr)
          setCurrentUser(parsed)
        } catch {
          setCurrentUser(PRESET_USERS[0])
        }
      }
      setIsLoaded(true)
    }
  }, [])

  const loginAs = (user: AuthUser) => {
    setCurrentUser(user)
    if (typeof window !== 'undefined') {
      localStorage.setItem('erp_auth_user', JSON.stringify(user))
    }
  }

  const logout = () => {
    const defaultAdmin = PRESET_USERS[0]
    setCurrentUser(defaultAdmin)
    if (typeof window !== 'undefined') {
      localStorage.removeItem('erp_auth_user')
    }
  }

  const canAccess = (pathname: string) => {
    return canAccessRoute(currentUser.role, pathname)
  }

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        role: currentUser.role,
        roleLabel: ROLE_PERMISSIONS[currentUser.role]?.label || 'مستخدم',
        loginAs,
        logout,
        canAccess,
        isAdmin: currentUser.role === 'admin',
        isSupervisor: currentUser.role === 'supervisor',
        isCashier: currentUser.role === 'cashier',
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
