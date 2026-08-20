-- ============================================================
-- Leopard POS - Core Database Schema
-- نظام كاشير ومخازن سوبر ماركت (General / Multi-tenant SaaS)
-- ============================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 1. FOUNDATION TABLES (المتجر والفروع)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.stores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  business_type TEXT NOT NULL DEFAULT 'supermarket',
  status TEXT NOT NULL DEFAULT 'active',
  currency TEXT NOT NULL DEFAULT 'EGP',
  tax_rate NUMERIC(5,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(owner_id)
);

CREATE TABLE IF NOT EXISTS public.branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  address TEXT,
  phone TEXT,
  is_default BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(store_id, code)
);

-- ============================================================
-- 2. INVENTORY TABLES (المخزون - الأساس)
-- ============================================================

-- تصنيفات الأصناف
CREATE TABLE IF NOT EXISTS public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  parent_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(store_id, name)
);

-- الأصناف (ديناميك - لأي نشاط)
CREATE TABLE IF NOT EXISTS public.items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  name_en TEXT,
  sku TEXT,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  manufacturer TEXT,
  unit TEXT NOT NULL DEFAULT 'قطعة',
  item_type TEXT NOT NULL DEFAULT 'stocked' CHECK (item_type IN ('stocked', 'service', 'non-stocked')),
  buy_price NUMERIC(14,2) NOT NULL DEFAULT 0,
  sell_price NUMERIC(14,2) NOT NULL DEFAULT 0,
  min_sell_price NUMERIC(14,2) NOT NULL DEFAULT 0,
  manage_inventory BOOLEAN NOT NULL DEFAULT true,
  not_for_sale BOOLEAN NOT NULL DEFAULT false,
  low_stock_alert INT NOT NULL DEFAULT 0,
  image_url TEXT,
  search_text TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(store_id, sku)
);

-- تعدد الباركود للصنف الواحد (unique globally per store)
CREATE TABLE IF NOT EXISTS public.item_barcodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
  barcode TEXT NOT NULL,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(store_id, barcode) -- الباركود ما يتكررش بين أصناف مختلفة
);

-- مستويات التعبئة ومعامل التفكيك
CREATE TABLE IF NOT EXISTS public.item_units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
  level INT NOT NULL DEFAULT 1,
  unit_name TEXT NOT NULL,
  qty_in_parent NUMERIC(14,3) NOT NULL DEFAULT 1,
  parent_unit TEXT,
  barcode TEXT,
  sell_price NUMERIC(14,2),
  buy_price NUMERIC(14,2),
  UNIQUE(store_id, item_id, level)
);

-- رصيد كل صنف في كل فرع
CREATE TABLE IF NOT EXISTS public.stock_balances (
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  quantity NUMERIC(14,3) NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (store_id, item_id, branch_id)
);

-- دفتر حركات المخزون (كل حركة in/out)
CREATE TABLE IF NOT EXISTS public.stock_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES public.items(id) ON DELETE RESTRICT,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
  movement_type TEXT NOT NULL, -- 'purchase', 'sale', 'return', 'adjustment', 'transfer', 'opening'
  direction TEXT NOT NULL CHECK (direction IN ('in', 'out')),
  quantity NUMERIC(14,3) NOT NULL,
  unit_price NUMERIC(14,2) NOT NULL DEFAULT 0,
  total NUMERIC(14,2) NOT NULL DEFAULT 0,
  source_table TEXT,
  source_id UUID,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 3. SUPPLIER & PURCHASE TABLES (الموردين والمشتريات)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  address TEXT,
  balance NUMERIC(14,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
  supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
  purchase_number TEXT NOT NULL,
  supplier_name TEXT NOT NULL DEFAULT 'مورد نقدي',
  status TEXT NOT NULL DEFAULT 'received' CHECK (status IN ('draft', 'received', 'cancelled', 'void')),
  payment_status TEXT NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('paid', 'partial', 'unpaid')),
  payment_method TEXT NOT NULL DEFAULT 'cash',
  subtotal NUMERIC(14,2) NOT NULL DEFAULT 0,
  discount_total NUMERIC(14,2) NOT NULL DEFAULT 0,
  tax_total NUMERIC(14,2) NOT NULL DEFAULT 0,
  total NUMERIC(14,2) NOT NULL DEFAULT 0,
  paid_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  due_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  purchase_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(store_id, purchase_number)
);

CREATE TABLE IF NOT EXISTS public.purchase_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  purchase_id UUID NOT NULL REFERENCES public.purchases(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES public.items(id) ON DELETE RESTRICT,
  quantity NUMERIC(14,3) NOT NULL,
  buy_price NUMERIC(14,2) NOT NULL,
  sell_price NUMERIC(14,2) NOT NULL DEFAULT 0,
  discount NUMERIC(14,2) NOT NULL DEFAULT 0,
  net_total NUMERIC(14,2) NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.purchase_returns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
  purchase_id UUID REFERENCES public.purchases(id) ON DELETE SET NULL,
  return_number TEXT NOT NULL,
  purchase_number TEXT,
  supplier_name TEXT NOT NULL DEFAULT 'مورد نقدي',
  total NUMERIC(14,2) NOT NULL DEFAULT 0,
  refund_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  reason TEXT,
  return_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(store_id, return_number)
);

CREATE TABLE IF NOT EXISTS public.purchase_return_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  return_id UUID NOT NULL REFERENCES public.purchase_returns(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES public.items(id) ON DELETE RESTRICT,
  quantity NUMERIC(14,3) NOT NULL,
  buy_price NUMERIC(14,2) NOT NULL,
  total NUMERIC(14,2) NOT NULL DEFAULT 0
);

-- ============================================================
-- 4. CUSTOMER & SALES TABLES (العملاء والمبيعات)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  address TEXT,
  balance NUMERIC(14,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  invoice_number TEXT NOT NULL,
  customer_name TEXT NOT NULL DEFAULT 'عميل نقدي',
  status TEXT NOT NULL DEFAULT 'invoice' CHECK (status IN ('invoice', 'draft', 'cancelled', 'void')),
  payment_status TEXT NOT NULL DEFAULT 'paid' CHECK (payment_status IN ('paid', 'partial', 'unpaid')),
  payment_method TEXT NOT NULL DEFAULT 'cash',
  subtotal NUMERIC(14,2) NOT NULL DEFAULT 0,
  discount_total NUMERIC(14,2) NOT NULL DEFAULT 0,
  tax_total NUMERIC(14,2) NOT NULL DEFAULT 0,
  total NUMERIC(14,2) NOT NULL DEFAULT 0,
  paid_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  due_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  sale_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  device_id TEXT, -- لعزل السلة (Cart Isolation)
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(store_id, invoice_number)
);

CREATE TABLE IF NOT EXISTS public.sale_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES public.items(id) ON DELETE RESTRICT,
  item_name TEXT NOT NULL DEFAULT '',
  quantity NUMERIC(14,3) NOT NULL,
  unit_price NUMERIC(14,2) NOT NULL,
  discount NUMERIC(14,2) NOT NULL DEFAULT 0,
  net_total NUMERIC(14,2) NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.sales_returns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
  sale_id UUID REFERENCES public.sales(id) ON DELETE SET NULL, -- NULL = مرتجع حر
  return_number TEXT NOT NULL,
  invoice_number TEXT,
  customer_name TEXT NOT NULL DEFAULT 'عميل نقدي',
  return_type TEXT NOT NULL DEFAULT 'invoice' CHECK (return_type IN ('invoice', 'free')),
  total NUMERIC(14,2) NOT NULL DEFAULT 0,
  refund_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  reason TEXT,
  return_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(store_id, return_number)
);

CREATE TABLE IF NOT EXISTS public.sales_return_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  return_id UUID NOT NULL REFERENCES public.sales_returns(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES public.items(id) ON DELETE RESTRICT,
  quantity NUMERIC(14,3) NOT NULL,
  unit_price NUMERIC(14,2) NOT NULL,
  total NUMERIC(14,2) NOT NULL DEFAULT 0
);

-- ============================================================
-- 5. OPERATIONS TABLES (العمليات التشغيلية)
-- ============================================================

-- حركات الصندوق (دخول/خروج)
CREATE TABLE IF NOT EXISTS public.cash_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  transaction_type TEXT NOT NULL, -- 'sale-payment', 'purchase-payment', 'return-refund', 'expense', 'deposit', 'withdrawal'
  direction TEXT NOT NULL CHECK (direction IN ('in', 'out')),
  amount NUMERIC(14,2) NOT NULL,
  payment_method TEXT NOT NULL DEFAULT 'cash',
  account_name TEXT NOT NULL DEFAULT 'الصندوق الرئيسي',
  source_table TEXT,
  source_id UUID,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ورديات الكاشير
CREATE TABLE IF NOT EXISTS public.cashier_shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
  employee_name TEXT,
  device_id TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  opening_cash NUMERIC(14,2) NOT NULL DEFAULT 0,
  expected_cash NUMERIC(14,2) NOT NULL DEFAULT 0,
  closing_cash NUMERIC(14,2),
  difference NUMERIC(14,2),
  opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at TIMESTAMPTZ,
  opened_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  closed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  notes TEXT
);

-- الجرد
CREATE TABLE IF NOT EXISTS public.stocktaking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
  stocktaking_number TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'in_progress', 'completed', 'cancelled')),
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  UNIQUE(store_id, stocktaking_number)
);

CREATE TABLE IF NOT EXISTS public.stocktaking_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  stocktaking_id UUID NOT NULL REFERENCES public.stocktaking(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES public.items(id) ON DELETE RESTRICT,
  system_qty NUMERIC(14,3) NOT NULL DEFAULT 0,
  actual_qty NUMERIC(14,3) NOT NULL DEFAULT 0,
  difference NUMERIC(14,3) NOT NULL DEFAULT 0
);

-- النقل المخزني بين الفروع
CREATE TABLE IF NOT EXISTS public.stock_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  from_branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
  to_branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
  transfer_number TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'cancelled')),
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  UNIQUE(store_id, transfer_number)
);

CREATE TABLE IF NOT EXISTS public.stock_transfer_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  transfer_id UUID NOT NULL REFERENCES public.stock_transfers(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES public.items(id) ON DELETE RESTRICT,
  quantity NUMERIC(14,3) NOT NULL
);

-- ============================================================
-- 6. RBAC TABLES (الصلاحيات)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  role_id UUID REFERENCES public.roles(id) ON DELETE SET NULL,
  pin_code TEXT, -- رمز دخول الكاشير
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_system BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(store_id, name)
);

-- صلاحيات 3 مستويات: صفحة + عملية + عنصر UI
CREATE TABLE IF NOT EXISTS public.role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  resource_type TEXT NOT NULL CHECK (resource_type IN ('page', 'operation', 'ui_element')),
  resource_key TEXT NOT NULL, -- '/inventory/items' or 'delete_invoice' or 'btn_edit_price'
  allowed BOOLEAN NOT NULL DEFAULT true,
  UNIQUE(role_id, resource_type, resource_key)
);

-- ============================================================
-- 7. SYNC & AUDIT TABLES (المزامنة والمراجعة)
-- ============================================================

-- قائمة انتظار المزامنة (أوفلاين)
CREATE TABLE IF NOT EXISTS public.sync_operations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL,
  operation_id TEXT NOT NULL,
  table_name TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('insert', 'update', 'delete')),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'synced', 'failed')),
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  synced_at TIMESTAMPTZ,
  UNIQUE(store_id, operation_id)
);

-- سجل المراجعة
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_table TEXT NOT NULL,
  entity_id UUID,
  before_data JSONB,
  after_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 8. INDEXES (فهارس لتسريع البحث)
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_items_search ON public.items USING gin (to_tsvector('simple', search_text));
CREATE INDEX IF NOT EXISTS idx_items_store_status ON public.items (store_id, status);
CREATE INDEX IF NOT EXISTS idx_item_barcodes_lookup ON public.item_barcodes (store_id, barcode);
CREATE INDEX IF NOT EXISTS idx_stock_balances_item ON public.stock_balances (store_id, item_id);
CREATE INDEX IF NOT EXISTS idx_stock_ledger_item_date ON public.stock_ledger (store_id, item_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sales_date ON public.sales (store_id, sale_date DESC);
CREATE INDEX IF NOT EXISTS idx_sales_invoice ON public.sales (store_id, invoice_number);
CREATE INDEX IF NOT EXISTS idx_purchases_date ON public.purchases (store_id, purchase_date DESC);
CREATE INDEX IF NOT EXISTS idx_cash_tx_date ON public.cash_transactions (store_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sync_pending ON public.sync_operations (store_id, status, created_at);
CREATE INDEX IF NOT EXISTS idx_customers_search ON public.customers (store_id, name, phone);
CREATE INDEX IF NOT EXISTS idx_suppliers_search ON public.suppliers (store_id, name, phone);
CREATE INDEX IF NOT EXISTS idx_cashier_shifts_status ON public.cashier_shifts (store_id, branch_id, status);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON public.audit_logs (store_id, entity_table, entity_id, created_at DESC);

-- ============================================================
-- 9. ROW LEVEL SECURITY (تأمين البيانات)
-- ============================================================

-- Helper function: check store ownership
CREATE OR REPLACE FUNCTION public.is_store_owner(target_store_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY INVOKER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.stores s
    WHERE s.id = target_store_id AND s.owner_id = auth.uid()
  );
$$;

-- Enable RLS on all tables
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'stores', 'branches', 'categories', 'items', 'item_barcodes', 'item_units',
    'stock_balances', 'stock_ledger', 'suppliers', 'purchases', 'purchase_lines',
    'purchase_returns', 'purchase_return_lines', 'customers', 'sales', 'sale_lines',
    'sales_returns', 'sales_return_lines', 'cash_transactions', 'cashier_shifts',
    'stocktaking', 'stocktaking_lines', 'stock_transfers', 'stock_transfer_lines',
    'employees', 'roles', 'role_permissions', 'sync_operations', 'audit_logs'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

-- Owner policy for stores table
CREATE POLICY owner_all ON public.stores
  FOR ALL TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- Owner policy for all child tables (using store_id)
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'branches', 'categories', 'items', 'item_barcodes', 'item_units',
    'stock_balances', 'stock_ledger', 'suppliers', 'purchases', 'purchase_lines',
    'purchase_returns', 'purchase_return_lines', 'customers', 'sales', 'sale_lines',
    'sales_returns', 'sales_return_lines', 'cash_transactions', 'cashier_shifts',
    'stocktaking', 'stocktaking_lines', 'stock_transfers', 'stock_transfer_lines',
    'employees', 'roles', 'role_permissions', 'sync_operations', 'audit_logs'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS owner_all ON public.%I', t);
    EXECUTE format('CREATE POLICY owner_all ON public.%I FOR ALL TO authenticated USING (public.is_store_owner(store_id)) WITH CHECK (public.is_store_owner(store_id))', t);
  END LOOP;
END $$;

-- Grant permissions
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'stores', 'branches', 'categories', 'items', 'item_barcodes', 'item_units',
    'stock_balances', 'stock_ledger', 'suppliers', 'purchases', 'purchase_lines',
    'purchase_returns', 'purchase_return_lines', 'customers', 'sales', 'sale_lines',
    'sales_returns', 'sales_return_lines', 'cash_transactions', 'cashier_shifts',
    'stocktaking', 'stocktaking_lines', 'stock_transfers', 'stock_transfer_lines',
    'employees', 'roles', 'role_permissions', 'sync_operations', 'audit_logs'
  ] LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO authenticated', t);
  END LOOP;
END $$;

-- Enable Realtime for critical tables
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.sales;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.stock_balances;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.cash_transactions;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.sync_operations;
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
