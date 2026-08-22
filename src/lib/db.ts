// Leopard POS - Dexie.js Offline Database Schema
// Mirrors the Supabase schema for offline-first operation

import Dexie, { type EntityTable } from 'dexie'
import type {
  Store, Branch, Category, Item, ItemBarcode, ItemUnit, ItemPriceHistory, BusinessType,
  StockBalance, StockLedgerEntry, Supplier, Purchase, PurchaseLine,
  PurchaseReturn, PurchaseReturnLine, Customer, Sale, SaleLine, SalesReturn, SalesReturnLine,
  CashTransaction, CashierShift, Employee, Role, RolePermission,
  SyncOperation, Stocktaking, StockTransfer
} from '@/lib/types'

// Extended types for stocktaking and transfers (local only)
interface StocktakingLocal {
  id: string
  store_id: string
  branch_id: string
  stocktaking_number: string
  status: string
  notes?: string
  created_by?: string
  created_at: string
  completed_at?: string
}

interface StocktakingLineLocal {
  id: string
  store_id: string
  stocktaking_id: string
  item_id: string
  system_qty: number
  actual_qty: number
  difference: number
}

interface StockTransferLocal {
  id: string
  store_id: string
  from_branch_id: string
  to_branch_id: string
  transfer_number: string
  status: string
  notes?: string
  created_by?: string
  created_at: string
  completed_at?: string
}

interface StockTransferLineLocal {
  id: string
  store_id: string
  transfer_id: string
  item_id: string
  quantity: number
}

// Sync queue entry for offline operations
interface SyncQueueEntry {
  id?: number // auto-increment for local ordering
  operation_id: string
  table_name: string
  action: 'insert' | 'update' | 'delete'
  payload: Record<string, unknown>
  status: 'pending' | 'synced' | 'failed'
  error_message?: string
  created_at: string
  retry_count: number
}

// Cart stored per device
interface LocalCart {
  device_id: string
  data: string // JSON stringified CartState
  updated_at: string
}

class LeopardDatabase extends Dexie {
  // Foundation
  stores!: EntityTable<Store, 'id'>
  branches!: EntityTable<Branch, 'id'>

  // Inventory
  categories!: EntityTable<Category, 'id'>
  items!: EntityTable<Item, 'id'>
  item_barcodes!: EntityTable<ItemBarcode, 'id'>
  item_units!: EntityTable<ItemUnit, 'id'>
  item_price_history!: EntityTable<ItemPriceHistory, 'id'>
  stock_balances!: EntityTable<StockBalance, 'store_id'>
  stock_ledger!: EntityTable<StockLedgerEntry, 'id'>

  // Suppliers & Purchases
  suppliers!: EntityTable<Supplier, 'id'>
  purchases!: EntityTable<Purchase, 'id'>
  purchase_lines!: EntityTable<PurchaseLine, 'id'>
  purchase_returns!: EntityTable<PurchaseReturn, 'id'>
  purchase_return_lines!: EntityTable<PurchaseReturnLine, 'id'>

  // Customers & Sales
  customers!: EntityTable<Customer, 'id'>
  sales!: EntityTable<Sale, 'id'>
  sale_lines!: EntityTable<SaleLine, 'id'>
  sales_returns!: EntityTable<SalesReturn, 'id'>
  sales_return_lines!: EntityTable<SalesReturnLine, 'id'>

  // Operations
  cash_transactions!: EntityTable<CashTransaction, 'id'>
  cashier_shifts!: EntityTable<CashierShift, 'id'>
  stocktaking!: EntityTable<StocktakingLocal, 'id'>
  stocktaking_lines!: EntityTable<StocktakingLineLocal, 'id'>
  stock_transfers!: EntityTable<StockTransferLocal, 'id'>
  stock_transfer_lines!: EntityTable<StockTransferLineLocal, 'id'>

  // RBAC
  employees!: EntityTable<Employee, 'id'>
  roles!: EntityTable<Role, 'id'>
  role_permissions!: EntityTable<RolePermission, 'id'>

  // Sync & Local
  sync_queue!: EntityTable<SyncQueueEntry, 'id'>
  local_cart!: EntityTable<LocalCart, 'device_id'>

  constructor() {
    super('LeopardPOS')

    this.version(4).stores({
      // Foundation
      stores: 'id, owner_id, created_at',
      branches: 'id, store_id, code, is_default, created_at',

      // Inventory - key indexes for fast search & hierarchy
      categories: 'id, store_id, name, parent_id, created_at',
      items: 'id, store_id, name, sku, category_id, status, search_text, created_at',
      item_barcodes: 'id, store_id, item_id, barcode, unit_name, created_at',
      item_units: 'id, store_id, item_id, level, unit_name',
      item_price_history: 'id, store_id, item_id, created_at',
      stock_balances: '[store_id+item_id+branch_id], store_id, item_id, branch_id',
      stock_ledger: 'id, store_id, item_id, branch_id, movement_type, created_at',

      // Suppliers & Purchases
      suppliers: 'id, store_id, name, created_at',
      purchases: 'id, store_id, purchase_number, supplier_name, status, purchase_date, created_at',
      purchase_lines: 'id, store_id, purchase_id, item_id',
      purchase_returns: 'id, store_id, return_number, created_at',
      purchase_return_lines: 'id, store_id, return_id, item_id',

      // Customers & Sales
      customers: 'id, store_id, name, phone, created_at',
      sales: 'id, store_id, invoice_number, status, sale_date, device_id, created_at',
      sale_lines: 'id, store_id, sale_id, item_id',
      sales_returns: 'id, store_id, return_number, sale_id, created_at',
      sales_return_lines: 'id, store_id, return_id, item_id',

      // Operations
      cash_transactions: 'id, store_id, branch_id, transaction_type, created_at',
      cashier_shifts: 'id, store_id, branch_id, status',
      stocktaking: 'id, store_id, stocktaking_number, status, created_at',
      stocktaking_lines: 'id, store_id, stocktaking_id, item_id',
      stock_transfers: 'id, store_id, transfer_number, status, created_at',
      stock_transfer_lines: 'id, store_id, transfer_id, item_id',

      // RBAC
      employees: 'id, store_id, auth_user_id, role_id, created_at',
      roles: 'id, store_id, name, created_at',
      role_permissions: 'id, role_id, [resource_type+resource_key]',

      // Sync queue - auto-increment id for ordering
      sync_queue: '++id, operation_id, table_name, status, created_at',

      // Local cart per device
      local_cart: 'device_id',
    })
  }
}

// Singleton instance
export const db = new LeopardDatabase()

// Helper: get or create device ID
export function getDeviceId(): string {
  if (typeof window === 'undefined') return 'server'
  let deviceId = localStorage.getItem('leopard_device_id')
  if (!deviceId) {
    deviceId = crypto.randomUUID()
    localStorage.setItem('leopard_device_id', deviceId)
  }
  return deviceId
}

// Default categories mapped strictly per business profile
export const DEFAULT_BUSINESS_CATEGORIES: Record<BusinessType, string[]> = {
  pharmacy: [
    'أدوية ومسكنات',
    'مضادات حيوية',
    'فيتامينات ومكملات غذائية',
    'مستحضرات تجميل وعناية بالبشرة',
    'عناية شخصية وصحة عامة',
    'مستلزمات طبية وإسعافات أولية',
    'أدوية أطفال ورضع',
    'عناية بالفم والأسنان'
  ],
  supermarket: [
    'أجبان ومنتجات ألبان',
    'بقوليات وحبوب (أرز، سكر، دقيق)',
    'مكرونات وصلصات',
    'زيوت وسمن',
    'معلبات وتونة',
    'لحوم ومجمدات',
    'خضروات وفواكه',
    'عطارة وتوابل ومكسرات',
    'مشروبات وعصائر ومياه',
    'شيبسي وبسكويت وحلويات',
    'منظفات ومستلزمات منزلية'
  ],
  clothing: [
    'ملابس رجالي',
    'ملابس حريمي',
    'ملابس أطفال',
    'أحذية رياضية وكلاسيك',
    'إكسسوارات وحقائب',
    'شنط ومحافظ',
    'لانجري وملابس نوم'
  ],
  restaurant: [
    'وجبات رئيسية',
    'ساندوتشات ووجبات سريعة',
    'مقبلات وسلطات',
    'مشروبات وعصائر باردة',
    'مشروبات ساخنة',
    'حلويات وديزرت'
  ],
  general: [
    'أصناف عامة',
    'أدوات ومستلزمات',
    'أجهزة ومعدات',
    'قطع غيار',
    'مواد خام ومهمات'
  ]
}

// Dynamic Contextual Seeding per Business Type & Tenant Isolation
export async function ensureDefaultCategories(
  storeId: string = '00000000-0000-0000-0000-000000000001',
  businessType: BusinessType = 'supermarket',
  forceReset: boolean = false
) {
  try {
    const existing = await db.categories.where('store_id').equals(storeId).toArray()

    // Check if existing categories mismatch the current business activity
    // (e.g. store is pharmacy but categories are supermarket cheeses/groceries)
    const isPharmaMismatch = businessType === 'pharmacy' && existing.some(c => c.name.includes('أجبان') || c.name.includes('خضروات') || c.name.includes('معلبات'))
    const isClothingMismatch = businessType === 'clothing' && existing.some(c => c.name.includes('أجبان') || c.name.includes('أدوية'))
    const isSupermarketMismatch = businessType === 'supermarket' && existing.some(c => c.name.includes('أدوية') || c.name.includes('ملابس رجالي'))

    const shouldPurgeAndReSeed = forceReset || existing.length === 0 || isPharmaMismatch || isClothingMismatch || isSupermarketMismatch

    if (shouldPurgeAndReSeed) {
      // Purge old mismatched categories for this store
      await db.categories.where('store_id').equals(storeId).delete()

      const defaultCategories = DEFAULT_BUSINESS_CATEGORIES[businessType] || DEFAULT_BUSINESS_CATEGORIES.supermarket
      const now = new Date().toISOString()

      for (let i = 0; i < defaultCategories.length; i++) {
        await db.categories.add({
          id: crypto.randomUUID(),
          store_id: storeId,
          name: defaultCategories[i],
          sort_order: i + 1,
          created_at: now
        })
      }
    }
  } catch (err) {
    console.warn('Error ensuring default categories:', err)
  }
}

export type { SyncQueueEntry, LocalCart, StocktakingLocal, StocktakingLineLocal, StockTransferLocal, StockTransferLineLocal }
