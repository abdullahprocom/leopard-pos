import Dexie from 'dexie';
import { db } from '@/lib/db';
import { createClient } from '@/lib/supabase/client';
import type { BusinessType } from '@/lib/types';

export type SyncStatus = {
  pending: number;
  synced: number;
  failed: number;
};

// Standard valid fallback UUIDs for offline standalone operation
export const DEFAULT_STORE_UUID = '00000000-0000-0000-0001-000000000001';
export const DEFAULT_BRANCH_UUID = '00000000-0000-0000-0001-000000000002';
export const DEFAULT_USER_UUID = '00000000-0000-0000-0000-000000000003';

// 🏢 Multi-Tenant Isolated Store & Branch Mapping per Business Profile
export const TENANT_STORE_MAP: Record<BusinessType, { storeId: string; branchId: string; defaultName: string }> = {
  supermarket: {
    storeId: '00000000-0000-0000-0001-000000000001',
    branchId: '00000000-0000-0000-0001-000000000002',
    defaultName: 'سوبر ماركت الهدى',
  },
  pharmacy: {
    storeId: '00000000-0000-0000-0002-000000000001',
    branchId: '00000000-0000-0000-0002-000000000002',
    defaultName: 'صيدلية الشفاء والعافية',
  },
  clothing: {
    storeId: '00000000-0000-0000-0003-000000000001',
    branchId: '00000000-0000-0000-0003-000000000002',
    defaultName: 'بوتيك الأناقة للملابس والموضة',
  },
  restaurant: {
    storeId: '00000000-0000-0000-0004-000000000001',
    branchId: '00000000-0000-0000-0004-000000000002',
    defaultName: 'مطعم وكافيه الشرق',
  },
  general: {
    storeId: '00000000-0000-0000-0005-000000000001',
    branchId: '00000000-0000-0000-0005-000000000002',
    defaultName: 'مؤسسة التجارة العامة والتوريدات',
  },
};

export function getTenantInfo(businessType: BusinessType) {
  return TENANT_STORE_MAP[businessType] || TENANT_STORE_MAP.supermarket;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isValidUUID(str: any): boolean {
  if (typeof str !== 'string') return false;
  return UUID_REGEX.test(str) || str.startsWith('00000000-0000-0000-0000-');
}

class SyncEngine {
  private isSyncing = false;
  private autoSyncInterval: ReturnType<typeof setInterval> | null = null;
  private listeners: Set<(status: SyncStatus) => void> = new Set();
  private supabase = createClient();

  /**
   * Add an operation to the local Dexie queue and trigger sync if online.
   */
  async enqueueOperation(tableName: string, action: 'INSERT' | 'UPDATE' | 'DELETE', payload: any) {
    const operation = {
      id: crypto.randomUUID(),
      table_name: tableName,
      action,
      payload,
      status: 'pending',
      retry_count: 0,
      created_at: new Date().toISOString(),
    };

    // Add to Dexie offline queue safely outside any active transactions
    try {
      await Dexie.ignoreTransaction(async () => {
        await (db as any).sync_queue.add(operation);
      });
    } catch {
      await (db as any).sync_queue.add(operation);
    }
    
    this.emitStatus();
    
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      // Defer execution slightly to avoid blocking UI rendering
      setTimeout(() => this.processQueue(), 50);
    }
  }

  /**
   * Clean and prepare payload for Supabase PostgreSQL schema
   */
  private sanitizePayload(tableName: string, payload: any) {
    if (!payload || typeof payload !== 'object') return payload;
    const clean = { ...payload };

    // Ensure valid UUIDs for primary and foreign key columns
    if (clean.id && !isValidUUID(clean.id)) {
      clean.id = crypto.randomUUID();
    }
    if (clean.store_id && !isValidUUID(clean.store_id)) {
      clean.store_id = DEFAULT_STORE_UUID;
    }
    if (clean.branch_id && !isValidUUID(clean.branch_id)) {
      clean.branch_id = DEFAULT_BRANCH_UUID;
    }
    if (clean.from_branch_id && !isValidUUID(clean.from_branch_id)) {
      clean.from_branch_id = DEFAULT_BRANCH_UUID;
    }
    if (clean.to_branch_id && !isValidUUID(clean.to_branch_id)) {
      clean.to_branch_id = DEFAULT_BRANCH_UUID;
    }
    if (clean.owner_id && !isValidUUID(clean.owner_id)) {
      clean.owner_id = DEFAULT_USER_UUID;
    }
    if (clean.customer_id && !isValidUUID(clean.customer_id)) {
      delete clean.customer_id;
    }
    if (clean.supplier_id && !isValidUUID(clean.supplier_id)) {
      delete clean.supplier_id;
    }
    if (clean.category_id && !isValidUUID(clean.category_id)) {
      delete clean.category_id;
    }
    if (clean.role_id && !isValidUUID(clean.role_id)) {
      delete clean.role_id;
    }
    if (clean.shift_id && !isValidUUID(clean.shift_id)) {
      delete clean.shift_id;
    }
    if (clean.cashier_id && !isValidUUID(clean.cashier_id)) {
      delete clean.cashier_id;
    }
    if (clean.source_id && !isValidUUID(clean.source_id)) {
      delete clean.source_id;
    }
    if (clean.purchase_id && !isValidUUID(clean.purchase_id)) {
      delete clean.purchase_id;
    }
    if (clean.sale_id && !isValidUUID(clean.sale_id)) {
      delete clean.sale_id;
    }
    if (clean.return_id && !isValidUUID(clean.return_id)) {
      delete clean.return_id;
    }
    if (clean.transfer_id && !isValidUUID(clean.transfer_id)) {
      delete clean.transfer_id;
    }
    if (clean.session_id && !isValidUUID(clean.session_id)) {
      delete clean.session_id;
    }
    if (clean.purchase_line_id && !isValidUUID(clean.purchase_line_id)) {
      delete clean.purchase_line_id;
    }
    if (clean.sale_line_id && !isValidUUID(clean.sale_line_id)) {
      delete clean.sale_line_id;
    }

    return clean;
  }

  /**
   * Process the queue of pending operations.
   * Runs sequentially to maintain operation order.
   */
  async processQueue() {
    if (this.isSyncing || (typeof navigator !== 'undefined' && !navigator.onLine)) return;
    this.isSyncing = true;

    try {
      const pendingOps = await (db as any).sync_queue
        .where('status')
        .equals('pending')
        .sortBy('created_at');

      for (const op of pendingOps) {
        if (typeof navigator !== 'undefined' && !navigator.onLine) break;

        try {
          const sanitized = this.sanitizePayload(op.table_name, op.payload);

          if (op.action === 'DELETE') {
            const { error } = await this.supabase
              .from(op.table_name)
              .delete()
              .eq('id', sanitized.id);
            if (error) throw error;
          } else {
            // Use upsert for both INSERT and UPDATE to prevent duplication / missing row errors
            const { error } = await this.supabase
              .from(op.table_name)
              .upsert(sanitized, { onConflict: 'id' });
            if (error) throw error;
          }

          // Mark as synced upon success
          await (db as any).sync_queue.update(op.id, { 
            status: 'synced', 
            synced_at: new Date().toISOString(),
            error_message: undefined
          });
        } catch (err: any) {
          const errorMsg = err?.message || (typeof err === 'object' ? JSON.stringify(err) : String(err));
          // Soft warn to avoid triggering Next.js full-screen dev error overlay
          console.warn(`[SyncEngine] Offline deferred op ${op.id} (${op.table_name}): ${errorMsg}`);
          
          const nextRetry = (op.retry_count || 0) + 1;
          
          if (nextRetry >= 3) {
            // Mark as failed after 3 retries so queue can continue
            await (db as any).sync_queue.update(op.id, { 
              status: 'failed', 
              error_message: errorMsg 
            });
          } else {
            // Increment retry count
            await (db as any).sync_queue.update(op.id, { 
              retry_count: nextRetry,
              error_message: errorMsg 
            });
          }
        }
      }
    } catch (queueErr) {
      console.warn('[SyncEngine] Queue processing notice:', queueErr);
    } finally {
      this.isSyncing = false;
      this.emitStatus();
    }
  }

  /**
   * Starts periodic syncing of the queue.
   */
  startAutoSync(intervalMs: number = 10000) {
    if (this.autoSyncInterval) return;
    
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.processQueue());
    }
    
    this.autoSyncInterval = setInterval(() => {
      this.processQueue();
    }, intervalMs);
  }

  /**
   * Stops periodic syncing.
   */
  stopAutoSync() {
    if (this.autoSyncInterval) {
      clearInterval(this.autoSyncInterval);
      this.autoSyncInterval = null;
    }
  }

  /**
   * Clear or reset failed operations
   */
  async clearFailedOperations() {
    try {
      await (db as any).sync_queue.where('status').equals('failed').delete();
      this.emitStatus();
    } catch (e) {
      console.warn('[SyncEngine] clearFailed error:', e);
    }
  }

  /**
   * Returns current counts of pending, synced, and failed operations.
   */
  async getSyncStatus(): Promise<SyncStatus> {
    try {
      const pending = await (db as any).sync_queue.where('status').equals('pending').count();
      const synced = await (db as any).sync_queue.where('status').equals('synced').count();
      const failed = await (db as any).sync_queue.where('status').equals('failed').count();
      return { pending, synced, failed };
    } catch {
      return { pending: 0, synced: 0, failed: 0 };
    }
  }

  /**
   * Subscribe to sync status changes.
   */
  subscribe(listener: (status: SyncStatus) => void) {
    this.listeners.add(listener);
    this.emitStatus();
    return () => this.listeners.delete(listener);
  }

  private async emitStatus() {
    const status = await this.getSyncStatus();
    this.listeners.forEach(listener => listener(status));
  }
}

export const syncEngine = new SyncEngine();
