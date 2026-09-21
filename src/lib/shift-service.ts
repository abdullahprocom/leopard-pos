import { db } from '@/lib/db'
import type { CashierShift, ShiftReconciliation, ShiftStatus } from '@/lib/types'
import { money, positive, generateShiftNumber } from '@/lib/finance'

export class ShiftService {
  /**
   * Get currently active open shift for a cashier in a store
   */
  static async getActiveShift(storeId: string, cashierId: string): Promise<CashierShift | null> {
    try {
      const shift = await db.cashier_shifts
        .where('store_id')
        .equals(storeId)
        .filter(s => s.cashier_id === cashierId && s.status === 'open')
        .first()

      return shift || null
    } catch (err) {
      console.error('Error fetching active shift:', err)
      return null
    }
  }

  /**
   * Open a new cashier shift with initial drawer cash
   */
  static async openShift(
    storeId: string,
    branchId: string,
    cashierId: string,
    cashierName: string,
    openingBalance: number,
    notes?: string
  ): Promise<CashierShift> {
    const existing = await this.getActiveShift(storeId, cashierId)
    if (existing) {
      return existing
    }

    const now = new Date().toISOString()
    const shiftId = crypto.randomUUID()
    const shiftNumber = generateShiftNumber()
    const cleanOpening = money(positive(openingBalance))

    const newShift: CashierShift = {
      id: shiftId,
      store_id: storeId,
      branch_id: branchId,
      shift_number: shiftNumber,
      cashier_id: cashierId,
      cashier_name: cashierName,
      opening_balance: cleanOpening,
      status: 'open',
      notes: notes?.trim() || undefined,
      opened_at: now,
    }

    await db.cashier_shifts.add(newShift)

    // Record initial cash transaction for audit trail
    if (cleanOpening > 0) {
      await db.cash_transactions.add({
        id: crypto.randomUUID(),
        store_id: storeId,
        branch_id: branchId,
        shift_id: shiftId,
        cashier_id: cashierId,
        type: 'deposit',
        transaction_type: 'opening_balance',
        direction: 'in',
        amount: cleanOpening,
        payment_method: 'cash',
        notes: `رصيد بداية الدرج للوردية ${shiftNumber}`,
        created_at: now,
      })
    }

    return newShift
  }

  /**
   * Blind close shift: Cashier only enters actual counted cash.
   * System calculates expected cash, difference (surplus/deficit) and seals the shift.
   */
  static async closeShift(
    shiftId: string,
    actualCash: number,
    closingNotes?: string
  ): Promise<CashierShift> {
    const shift = await db.cashier_shifts.get(shiftId)
    if (!shift) {
      throw new Error('الوردية غير موجودة')
    }

    if (shift.status === 'closed') {
      return shift
    }

    const now = new Date().toISOString()
    const cleanActual = money(positive(actualCash))

    // Calculate all financial totals for this shift
    const recon = await this.calculateShiftReconciliation(shiftId)

    const updatedShift: CashierShift = {
      ...shift,
      closing_balance: recon.expectedCash,
      expected_cash: recon.expectedCash,
      actual_cash: cleanActual,
      cash_difference: money(cleanActual - recon.expectedCash),
      total_cash_sales: recon.totalCashSales,
      total_card_sales: recon.totalCardSales,
      total_credit_sales: recon.totalCreditSales,
      total_cash_returns: recon.totalCashReturns,
      total_expenses: recon.totalExpenses,
      total_invoices_count: recon.invoiceCount,
      status: 'closed',
      notes: closingNotes?.trim() || shift.notes,
      closed_at: now,
    }

    await db.cashier_shifts.update(shiftId, updatedShift)
    return updatedShift
  }

  /**
   * Detailed financial reconciliation of a shift (Admin / Manager view)
   */
  static async calculateShiftReconciliation(shiftId: string): Promise<ShiftReconciliation> {
    const shift = await db.cashier_shifts.get(shiftId)
    if (!shift) {
      throw new Error('الوردية غير موجودة')
    }

    const openingBalance = shift.opening_balance || 0

    // Fetch all sales for this shift
    const shiftSales = await db.sales
      .where('shift_id')
      .equals(shiftId)
      .toArray()

    let totalCashSales = 0
    let totalCardSales = 0
    let totalCreditSales = 0

    for (const sale of shiftSales) {
      if (sale.status === 'void' || sale.status === 'cancelled') continue
      const paid = sale.paid_amount || sale.total || 0
      if (sale.payment_method === 'cash') {
        totalCashSales += paid
      } else if (sale.payment_method === 'card') {
        totalCardSales += paid
      } else if (sale.payment_method === 'credit') {
        totalCreditSales += (sale.due_amount || sale.total || 0)
      } else {
        totalCashSales += paid
      }
    }

    // Fetch cash returns for this shift
    const cashReturns = await db.cash_transactions
      .where('shift_id')
      .equals(shiftId)
      .filter(t => t.type === 'sale_return' || t.transaction_type === 'sale_return')
      .toArray()

    const totalCashReturns = cashReturns.reduce((sum, t) => sum + (t.amount || 0), 0)

    // Fetch cash expenses for this shift
    const expenses = await db.cash_transactions
      .where('shift_id')
      .equals(shiftId)
      .filter(t => t.type === 'expense' || t.type === 'withdrawal' || t.transaction_type === 'expense')
      .toArray()

    const totalExpenses = expenses.reduce((sum, t) => sum + (t.amount || 0), 0)

    // Expected cash in drawer = Opening + Cash Sales - Cash Returns - Cash Expenses
    const expectedCash = money(openingBalance + totalCashSales - totalCashReturns - totalExpenses)
    const actualCash = shift.actual_cash !== undefined ? shift.actual_cash : expectedCash
    const difference = money(actualCash - expectedCash)

    let status: 'surplus' | 'deficit' | 'balanced' = 'balanced'
    if (difference < -0.01) status = 'deficit'
    else if (difference > 0.01) status = 'surplus'

    return {
      shift,
      openingBalance: money(openingBalance),
      totalCashSales: money(totalCashSales),
      totalCardSales: money(totalCardSales),
      totalCreditSales: money(totalCreditSales),
      totalCashReturns: money(totalCashReturns),
      totalExpenses: money(totalExpenses),
      expectedCash,
      actualCash,
      difference,
      invoiceCount: shiftSales.length,
      status,
    }
  }

  /**
   * Get shift history for a store/branch
   */
  static async getShiftHistory(storeId: string, branchId?: string): Promise<CashierShift[]> {
    let query = db.cashier_shifts.where('store_id').equals(storeId)
    const shifts = await query.reverse().sortBy('opened_at')
    if (branchId) {
      return shifts.filter(s => s.branch_id === branchId)
    }
    return shifts
  }
}
