// Leopard POS - Dexie.js Offline Database Schema
// Mirrors the Supabase schema for offline-first operation

import Dexie, { type EntityTable } from 'dexie'
import type {
  Store, Branch, Category, Item, ItemBarcode, ItemUnit,
  StockBalance, StockLedgerEntry, Supplier, Purchase, PurchaseLine,
  PurchaseReturn, Customer, Sale, SaleLine, SalesReturn,
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
  stock_balances!: EntityTable<StockBalance, 'store_id'>
  stock_ledger!: EntityTable<StockLedgerEntry, 'id'>

  // Suppliers & Purchases
  suppliers!: EntityTable<Supplier, 'id'>
  purchases!: EntityTable<Purchase, 'id'>
  purchase_lines!: EntityTable<PurchaseLine, 'id'>
  purchase_returns!: EntityTable<PurchaseReturn, 'id'>

  // Customers & Sales
  customers!: EntityTable<Customer, 'id'>
  sales!: EntityTable<Sale, 'id'>
  sale_lines!: EntityTable<SaleLine, 'id'>
  sales_returns!: EntityTable<SalesReturn, 'id'>

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

    this.version(1).stores({
      // Foundation
      stores: 'id, owner_id',
      branches: 'id, store_id, code, is_default',

      // Inventory - key indexes for fast search
      categories: 'id, store_id, name, parent_id',
      items: 'id, store_id, name, sku, category_id, status, search_text',
      item_barcodes: 'id, store_id, item_id, barcode',
      item_units: 'id, store_id, item_id, level',
      stock_balances: '[store_id+item_id+branch_id], store_id, item_id, branch_id',
      stock_ledger: 'id, store_id, item_id, branch_id, movement_type, created_at',

      // Suppliers & Purchases
      suppliers: 'id, store_id, name',
      purchases: 'id, store_id, purchase_number, supplier_name, status, purchase_date',
      purchase_lines: 'id, store_id, purchase_id, item_id',
      purchase_returns: 'id, store_id, return_number',

      // Customers & Sales
      customers: 'id, store_id, name, phone',
      sales: 'id, store_id, invoice_number, status, sale_date, device_id',
      sale_lines: 'id, store_id, sale_id, item_id',
      sales_returns: 'id, store_id, return_number, sale_id',

      // Operations
      cash_transactions: 'id, store_id, branch_id, transaction_type, created_at',
      cashier_shifts: 'id, store_id, branch_id, status',
      stocktaking: 'id, store_id, stocktaking_number, status',
      stocktaking_lines: 'id, store_id, stocktaking_id, item_id',
      stock_transfers: 'id, store_id, transfer_number, status',
      stock_transfer_lines: 'id, store_id, transfer_id, item_id',

      // RBAC
      employees: 'id, store_id, auth_user_id, role_id',
      roles: 'id, store_id, name',
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

export type { SyncQueueEntry, LocalCart, StocktakingLocal, StocktakingLineLocal, StockTransferLocal, StockTransferLineLocal }
