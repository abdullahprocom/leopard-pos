// Leopard POS - RBAC (Role-Based Access Control) Service
// 3-level permission system: pages, operations, UI elements

import { db } from '@/lib/db'
import type { RolePermission, ResourceType } from '@/lib/types'

// Default system roles with their permissions
export const DEFAULT_ROLES = {
  owner: {
    name: 'مالك النظام',
    description: 'صلاحيات كاملة على جميع العمليات',
  },
  admin: {
    name: 'مدير',
    description: 'صلاحيات كاملة ما عدا إعدادات النظام المتقدمة',
  },
  manager: {
    name: 'مشرف',
    description: 'إدارة المخزون والمبيعات والمشتريات',
  },
  accountant: {
    name: 'محاسب',
    description: 'صلاحيات الحسابات والتقارير',
  },
  cashier: {
    name: 'كاشير',
    description: 'صلاحيات نقطة البيع فقط',
  },
} as const

// Page paths accessible by each role
const ROLE_PAGE_ACCESS: Record<string, string[]> = {
  owner: ['*'], // All pages
  admin: ['*'],
  manager: [
    '/dashboard',
    '/dashboard/items',
    '/dashboard/purchases',
    '/dashboard/purchase-returns',
    '/dashboard/stocktaking',
    '/dashboard/transfers',
    '/dashboard/pos',
    '/dashboard/sales',
    '/dashboard/sales-returns',
    '/dashboard/customers',
    '/dashboard/suppliers',
    '/dashboard/employees',
  ],
  accountant: [
    '/dashboard',
    '/dashboard/items',
    '/dashboard/purchases',
    '/dashboard/sales',
    '/dashboard/sales-returns',
    '/dashboard/customers',
    '/dashboard/suppliers',
  ],
  cashier: [
    '/dashboard',
    '/dashboard/pos',
    '/dashboard/sales',
  ],
}

// Operations accessible by each role
const ROLE_OPERATIONS: Record<string, string[]> = {
  owner: ['*'],
  admin: ['*'],
  manager: [
    'create_item', 'edit_item', 'delete_item',
    'create_purchase', 'edit_purchase', 'void_purchase',
    'create_sale', 'void_sale',
    'create_return', 'process_return',
    'stocktaking', 'stock_transfer',
    'view_reports',
  ],
  accountant: [
    'view_items',
    'view_purchases', 'create_purchase',
    'view_sales',
    'view_returns',
    'view_reports',
  ],
  cashier: [
    'create_sale',
    'create_return',
    'view_own_sales',
  ],
}

// UI elements hidden from certain roles
const ROLE_HIDDEN_UI: Record<string, string[]> = {
  owner: [],
  admin: [],
  manager: ['btn_system_settings', 'btn_delete_store'],
  accountant: ['btn_edit_price', 'btn_delete_item', 'btn_void_invoice', 'btn_system_settings'],
  cashier: ['btn_edit_price', 'btn_delete_item', 'btn_void_invoice', 'btn_system_settings', 'btn_manage_employees', 'section_cost_price'],
}

/** Check if a role can access a specific page */
export function canAccessPage(roleName: string, path: string): boolean {
  const pages = ROLE_PAGE_ACCESS[roleName]
  if (!pages) return false
  if (pages.includes('*')) return true
  return pages.some(p => path === p || path.startsWith(p + '/'))
}

/** Check if a role can perform a specific operation */
export function canPerformOperation(roleName: string, operation: string): boolean {
  const ops = ROLE_OPERATIONS[roleName]
  if (!ops) return false
  if (ops.includes('*')) return true
  return ops.includes(operation)
}

/** Check if a UI element should be visible for a role */
export function isUIElementVisible(roleName: string, elementKey: string): boolean {
  const hidden = ROLE_HIDDEN_UI[roleName]
  if (!hidden) return true
  return !hidden.includes(elementKey)
}

/** Get current user's role from local DB */
export async function getCurrentRole(storeId: string, userId: string): Promise<string> {
  try {
    const employee = await db.employees
      .where({ store_id: storeId, auth_user_id: userId })
      .first()

    if (!employee?.role_id) {
      // Check if user is store owner
      const store = await db.stores.get(storeId)
      if (store?.owner_id === userId) return 'owner'
      return 'cashier' // Default to most restricted
    }

    const role = await db.roles.get(employee.role_id)
    return role?.name || 'cashier'
  } catch {
    return 'owner' // Fallback for development
  }
}

/** Initialize default roles for a new store */
export async function initializeDefaultRoles(storeId: string): Promise<void> {
  const existingRoles = await db.roles.where({ store_id: storeId }).count()
  if (existingRoles > 0) return

  const rolesToCreate = Object.entries(DEFAULT_ROLES).map(([key, value]) => ({
    id: crypto.randomUUID(),
    store_id: storeId,
    name: key,
    description: value.description,
    is_system: true,
    created_at: new Date().toISOString(),
  }))

  await db.roles.bulkAdd(rolesToCreate)
}
