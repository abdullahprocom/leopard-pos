// Leopard POS - Financial utility functions
// Core calculations used across sales, purchases, and reports

/** Round to 2 decimal places */
export function money(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

/** Convert any value to a safe positive number */
export function toNumber(value: unknown): number {
  const num = Number(value)
  return isNaN(num) ? 0 : num
}

/** Ensure value is positive or zero */
export function positive(value: unknown): number {
  return Math.max(toNumber(value), 0)
}

/** Calculate discount amount from type and value */
export function calcDiscount(
  type: 'fixed' | 'percent',
  value: number,
  base: number
): number {
  if (type === 'percent') {
    return money(Math.min(base * (positive(value) / 100), base))
  }
  return money(Math.min(positive(value), base))
}

/** Settle payment and determine status */
export function settlePayment(total: number, paidAmount: number) {
  const paid = money(positive(paidAmount))
  const safeTotal = money(positive(total))
  const due = money(Math.max(safeTotal - paid, 0))
  let status: 'paid' | 'partial' | 'unpaid'

  if (paid >= safeTotal) {
    status = 'paid'
  } else if (paid > 0) {
    status = 'partial'
  } else {
    status = 'unpaid'
  }

  return { paidAmount: paid, dueAmount: due, paymentStatus: status }
}

/** Generate sequential number with prefix */
export function generateSequenceNumber(prefix: string): string {
  const timestamp = Date.now().toString(36).toUpperCase()
  const random = Math.random().toString(36).substring(2, 6).toUpperCase()
  return `${prefix}-${timestamp}-${random}`
}

/** Generate invoice number */
export function generateInvoiceNumber(): string {
  return generateSequenceNumber('INV')
}

/** Generate sale number (alias for invoice number) */
export const generateSaleNumber = generateInvoiceNumber

/** Generate purchase number */
export function generatePurchaseNumber(): string {
  return generateSequenceNumber('PUR')
}

/** Generate return number */
export function generateReturnNumber(type: 'sale' | 'purchase'): string {
  return generateSequenceNumber(type === 'sale' ? 'SRT' : 'PRT')
}

/** Generate transfer number */
export function generateTransferNumber(): string {
  return generateSequenceNumber('TRF')
}

/** Generate stocktaking number */
export function generateStocktakingNumber(): string {
  return generateSequenceNumber('STK')
}

/** Format currency with Arabic locale */
export function formatCurrency(amount: number, currency = 'EGP'): string {
  return new Intl.NumberFormat('ar-EG', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount)
}

/** Format number with Arabic locale */
export function formatNumber(num: number, decimals = 0): string {
  return new Intl.NumberFormat('ar-EG', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(num)
}
