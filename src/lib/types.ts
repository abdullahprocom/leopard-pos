// Leopard POS - TypeScript type definitions
// All database entity types

export type StoreStatus = 'active' | 'inactive'
export type ItemStatus = 'active' | 'inactive' | 'archived'
export type ItemType = 'stocked' | 'service' | 'non-stocked'
export type SaleStatus = 'invoice' | 'draft' | 'cancelled' | 'void'
export type PurchaseStatus = 'draft' | 'received' | 'cancelled' | 'void'
export type PaymentStatus = 'paid' | 'partial' | 'unpaid'
export type PaymentMethod = 'cash' | 'card' | 'bank-transfer'
export type TransactionDirection = 'in' | 'out'
export type MovementType = 'purchase' | 'sale' | 'return' | 'adjustment' | 'transfer' | 'opening'
export type SyncStatus = 'pending' | 'synced' | 'failed'
export type ShiftStatus = 'open' | 'closed'
export type ReturnType = 'invoice' | 'free'
export type ResourceType = 'page' | 'operation' | 'ui_element'
export type StocktakingStatus = 'draft' | 'in_progress' | 'completed' | 'cancelled'
export type TransferStatus = 'pending' | 'completed' | 'cancelled'

// ============================================================
// Foundation
// ============================================================

export interface Store {
  id: string
  owner_id: string
  name: string
  business_type: string
  status: StoreStatus
  currency: string
  tax_rate: number
  created_at: string
  updated_at: string
}

export interface Branch {
  id: string
  store_id: string
  code: string
  name: string
  address?: string
  phone?: string
  is_default: boolean
  status: StoreStatus
  created_at: string
  updated_at: string
}

// ============================================================
// Inventory
// ============================================================

export interface Category {
  id: string
  store_id: string
  name: string
  parent_id?: string
  sort_order: number
  created_at: string
}

export interface Item {
  id: string
  store_id: string
  name: string
  name_en?: string
  sku?: string
  category_id?: string
  manufacturer?: string
  unit: string
  item_type: ItemType
  buy_price: number
  sell_price: number
  min_sell_price: number
  manage_inventory: boolean
  not_for_sale: boolean
  low_stock_alert: number
  image_url?: string
  search_text: string
  status: ItemStatus
  created_at: string
  updated_at: string
}

export interface ItemBarcode {
  id: string
  store_id: string
  item_id: string
  barcode: string
  is_primary: boolean
  created_at: string
}

export interface ItemUnit {
  id: string
  store_id: string
  item_id: string
  level: number
  unit_name: string
  qty_in_parent: number
  parent_unit?: string
  barcode?: string
  sell_price?: number
  buy_price?: number
}

export interface StockBalance {
  store_id: string
  item_id: string
  branch_id: string
  quantity: number
  updated_at: string
}

export interface StockLedgerEntry {
  id: string
  store_id: string
  item_id: string
  branch_id: string
  movement_type: MovementType
  direction: TransactionDirection
  quantity: number
  unit_price: number
  total: number
  source_table?: string
  source_id?: string
  notes?: string
  created_by?: string
  created_at: string
}

// ============================================================
// Suppliers & Purchases
// ============================================================

export interface Supplier {
  id: string
  store_id: string
  name: string
  phone?: string
  email?: string
  address?: string
  balance: number
  status: string
  created_at: string
  updated_at: string
}

export interface Purchase {
  id: string
  store_id: string
  branch_id: string
  supplier_id?: string
  purchase_number: string
  supplier_name: string
  status: PurchaseStatus
  payment_status: PaymentStatus
  payment_method: PaymentMethod
  subtotal: number
  discount_total: number
  tax_total: number
  total: number
  paid_amount: number
  due_amount: number
  purchase_date: string
  notes?: string
  created_by?: string
  created_at: string
  updated_at: string
}

export interface PurchaseLine {
  id: string
  store_id: string
  purchase_id: string
  item_id: string
  quantity: number
  buy_price: number
  sell_price: number
  discount: number
  net_total: number
}

export interface PurchaseReturn {
  id: string
  store_id: string
  branch_id: string
  purchase_id?: string
  return_number: string
  purchase_number?: string
  supplier_name: string
  total: number
  refund_amount: number
  reason?: string
  return_date: string
  created_by?: string
  created_at: string
  updated_at: string
}

// ============================================================
// Customers & Sales
// ============================================================

export interface Customer {
  id: string
  store_id: string
  name: string
  phone?: string
  email?: string
  address?: string
  balance: number
  status: string
  created_at: string
  updated_at: string
}

export interface Sale {
  id: string
  store_id: string
  branch_id: string
  customer_id?: string
  invoice_number: string
  customer_name: string
  status: SaleStatus
  payment_status: PaymentStatus
  payment_method: PaymentMethod
  subtotal: number
  discount_total: number
  tax_total: number
  total: number
  paid_amount: number
  due_amount: number
  sale_date: string
  device_id?: string
  notes?: string
  created_by?: string
  created_at: string
  updated_at: string
}

export interface SaleLine {
  id: string
  store_id: string
  sale_id: string
  item_id: string
  item_name: string
  quantity: number
  unit_price: number
  discount: number
  net_total: number
}

export interface SalesReturn {
  id: string
  store_id: string
  branch_id: string
  sale_id?: string
  return_number: string
  invoice_number?: string
  customer_name: string
  return_type: ReturnType
  total: number
  refund_amount: number
  reason?: string
  return_date: string
  created_by?: string
  created_at: string
  updated_at: string
}

// ============================================================
// Operations
// ============================================================

export interface CashTransaction {
  id: string
  store_id: string
  branch_id?: string
  transaction_type: string
  direction: TransactionDirection
  amount: number
  payment_method: PaymentMethod
  account_name: string
  source_table?: string
  source_id?: string
  notes?: string
  created_by?: string
  created_at: string
}

export interface CashierShift {
  id: string
  store_id: string
  branch_id: string
  employee_name?: string
  device_id?: string
  status: ShiftStatus
  opening_cash: number
  expected_cash: number
  closing_cash?: number
  difference?: number
  opened_at: string
  closed_at?: string
  opened_by?: string
  closed_by?: string
  notes?: string
}

export interface Employee {
  id: string
  store_id: string
  auth_user_id?: string
  name: string
  email?: string
  phone?: string
  role_id?: string
  pin_code?: string
  status: string
  created_at: string
  updated_at: string
}

export interface Role {
  id: string
  store_id: string
  name: string
  description?: string
  is_system: boolean
  created_at: string
}

export interface RolePermission {
  id: string
  store_id: string
  role_id: string
  resource_type: ResourceType
  resource_key: string
  allowed: boolean
}

export interface SyncOperation {
  id: string
  store_id: string
  device_id: string
  operation_id: string
  table_name: string
  action: 'insert' | 'update' | 'delete'
  payload: Record<string, unknown>
  status: SyncStatus
  error_message?: string
  created_at: string
  synced_at?: string
}

// ============================================================
// UI / Cart types (client-side only)
// ============================================================

export interface CartItem {
  item_id: string
  item_name: string
  barcode?: string
  quantity: number
  unit_price: number
  discount: number
  net_total: number
  unit: string
  available_stock: number
}

export interface CartState {
  device_id: string
  items: CartItem[]
  customer_name: string
  customer_id?: string
  payment_method: PaymentMethod
  discount_total: number
  subtotal: number
  tax_total: number
  total: number
  paid_amount: number
  due_amount: number
}
