import Dexie from 'dexie';
import { db } from '@/lib/db';
import { createClient } from '@/lib/supabase/client';

export type SyncStatus = {
  pending: number;
  synced: number;
  failed: number;
};

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
      this.processQueue();
    }
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
          if (op.action === 'INSERT') {
            const { error } = await this.supabase.from(op.table_name).insert(op.payload);
            if (error) throw error;
          } else if (op.action === 'UPDATE') {
            const { error } = await this.supabase
              .from(op.table_name)
              .update(op.payload)
              .eq('id', op.payload.id);
            if (error) throw error;
          } else if (op.action === 'DELETE') {
            const { error } = await this.supabase
              .from(op.table_name)
              .delete()
              .eq('id', op.payload.id);
            if (error) throw error;
          }

          // Mark as synced upon success
          await (db as any).sync_queue.update(op.id, { 
            status: 'synced', 
            synced_at: new Date().toISOString() 
          });
        } catch (error) {
          console.error(`Sync error for operation ${op.id}:`, error);
          const nextRetry = (op.retry_count || 0) + 1;
          
          if (nextRetry >= 3) {
            // Mark as failed after 3 retries
            await (db as any).sync_queue.update(op.id, { 
              status: 'failed', 
              error_message: error instanceof Error ? error.message : String(error) 
            });
          } else {
            // Increment retry count
            await (db as any).sync_queue.update(op.id, { retry_count: nextRetry });
          }
        }
      }
    } finally {
      this.isSyncing = false;
      this.emitStatus();
    }
  }

  /**
   * Starts periodic syncing of the queue.
   */
  startAutoSync(intervalMs: number = 5000) {
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
   * Returns current counts of pending, synced, and failed operations.
   */
  async getSyncStatus(): Promise<SyncStatus> {
    const pending = await (db as any).sync_queue.where('status').equals('pending').count();
    const synced = await (db as any).sync_queue.where('status').equals('synced').count();
    const failed = await (db as any).sync_queue.where('status').equals('failed').count();
    return { pending, synced, failed };
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
