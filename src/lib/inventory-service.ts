import { db } from '@/lib/db';
import { syncEngine } from './sync-engine';

export class InventoryService {
  /**
   * Create an item with barcodes and unit levels
   */
  static async createItem(
    item: { name: string; category_id?: string; base_price: number; cost_price: number; [key: string]: any }, 
    barcodes: string[], 
    units: { unit_name: string; conversion_factor: number; [key: string]: any }[]
  ) {
    // Write all operations within a Dexie transaction
    return await (db as any).transaction('rw', (db as any).items, (db as any).item_barcodes, (db as any).item_units, (db as any).stock_balances, async () => {
      
      // Validate barcode uniqueness locally
      for (const barcode of barcodes) {
        const existing = await (db as any).item_barcodes.where('barcode').equals(barcode).first();
        if (existing) {
          throw new Error(`Barcode ${barcode} already exists`);
        }
      }

      const itemId = crypto.randomUUID();
      // Search text contains item name and all its barcodes
      const search_text = `${item.name} ${barcodes.join(' ')}`.toLowerCase();

      const newItem = {
        id: itemId,
        ...item,
        search_text,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      await (db as any).items.add(newItem);
      syncEngine.enqueueOperation('items', 'INSERT', newItem);

      // Add item barcodes
      for (const barcode of barcodes) {
        const itemBarcode = {
          id: crypto.randomUUID(),
          item_id: itemId,
          barcode,
          created_at: new Date().toISOString()
        };
        await (db as any).item_barcodes.add(itemBarcode);
        syncEngine.enqueueOperation('item_barcodes', 'INSERT', itemBarcode);
      }

      // Add item units
      for (const unit of units) {
        const itemUnit = {
          id: crypto.randomUUID(),
          item_id: itemId,
          ...unit,
          created_at: new Date().toISOString()
        };
        await (db as any).item_units.add(itemUnit);
        syncEngine.enqueueOperation('item_units', 'INSERT', itemUnit);
      }

      // Initialize stock_balances entry with 0 quantity
      // assuming a null branch for default/global or parameterize it later
      const stockBalance = {
        id: crypto.randomUUID(),
        item_id: itemId,
        branch_id: null,
        quantity: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      await (db as any).stock_balances.add(stockBalance);
      syncEngine.enqueueOperation('stock_balances', 'INSERT', stockBalance);

      return itemId;
    });
  }

  /**
   * Update item details
   */
  static async updateItem(id: string, updates: any) {
    return await (db as any).transaction('rw', (db as any).items, async () => {
      const updatedItem = {
        ...updates,
        updated_at: new Date().toISOString()
      };
      await (db as any).items.update(id, updatedItem);
      
      const item = await (db as any).items.get(id);
      syncEngine.enqueueOperation('items', 'UPDATE', item);
      return item;
    });
  }

  /**
   * Search by name or barcode (local DB)
   */
  static async searchItems(query: string) {
    const lowerQuery = query.toLowerCase();
    
    // 1. Try exact barcode match first
    const barcodeMatch = await (db as any).item_barcodes.where('barcode').equals(query).first();
    if (barcodeMatch) {
      const item = await (db as any).items.get(barcodeMatch.item_id);
      if (item) return [item];
    }
    
    // 2. Fall back to fuzzy name search using search_text
    const items = await (db as any).items
      .filter((item: any) => (item.search_text || '').toLowerCase().includes(lowerQuery))
      .toArray();
      
    return items;
  }

  /**
   * Exact barcode lookup
   */
  static async getItemByBarcode(barcode: string) {
    const barcodeMatch = await (db as any).item_barcodes.where('barcode').equals(barcode).first();
    if (!barcodeMatch) return null;
    return await (db as any).items.get(barcodeMatch.item_id);
  }

  /**
   * Adjust stock levels and record movement ledger
   */
  static async adjustStock(
    itemId: string, 
    branchId: string | null, 
    quantity: number, 
    type: string, 
    direction: 'in' | 'out', 
    sourceTable: string, 
    sourceId: string
  ) {
    return await (db as any).transaction('rw', (db as any).stock_balances, (db as any).stock_ledger, async () => {
      // Using array filter if compound index is missing, ideally we'd query by item_id and filter branch_id
      const balances = await (db as any).stock_balances.where('item_id').equals(itemId).toArray();
      let balance = balances.find((b: any) => b.branch_id === branchId);

      if (!balance) {
        balance = {
          id: crypto.randomUUID(),
          item_id: itemId,
          branch_id: branchId,
          quantity: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        await (db as any).stock_balances.add(balance);
        syncEngine.enqueueOperation('stock_balances', 'INSERT', balance);
      }

      const newQuantity = direction === 'in' 
        ? balance.quantity + quantity 
        : balance.quantity - quantity;

      await (db as any).stock_balances.update(balance.id, {
        quantity: newQuantity,
        updated_at: new Date().toISOString()
      });

      const updatedBalance = await (db as any).stock_balances.get(balance.id);
      syncEngine.enqueueOperation('stock_balances', 'UPDATE', updatedBalance);

      const ledgerEntry = {
        id: crypto.randomUUID(),
        item_id: itemId,
        branch_id: branchId,
        quantity: direction === 'in' ? quantity : -quantity,
        type,
        source_table: sourceTable,
        source_id: sourceId,
        created_at: new Date().toISOString()
      };

      await (db as any).stock_ledger.add(ledgerEntry);
      syncEngine.enqueueOperation('stock_ledger', 'INSERT', ledgerEntry);
    });
  }

  /**
   * Get current stock balance for an item
   */
  static async getStockBalance(itemId: string, branchId: string | null) {
    const balances = await (db as any).stock_balances.where('item_id').equals(itemId).toArray();
    const balance = balances.find((b: any) => b.branch_id === branchId);
    return balance?.quantity || 0;
  }

  /**
   * Get stock ledger history for an item
   */
  static async getStockMovements(itemId: string) {
    return await (db as any).stock_ledger
      .where('item_id')
      .equals(itemId)
      .reverse()
      .sortBy('created_at');
  }
}
