// APR System - Financial & Calculation utility functions
// Strict Validation: Zero Negatives, Safe Decimal & Integer Quantities

/** Round strictly to 2 decimal places */
export function money(value: number): number {
  const n = Number(value) || 0
  return Math.round((n + Number.EPSILON) * 100) / 100
}

/** Convert any value to a safe positive number */
export function toNumber(value: unknown): number {
  const num = Number(value)
  return isNaN(num) ? 0 : num
}

/** Ensure value is strictly positive or zero */
export function positive(value: unknown): number {
  return Math.max(toNumber(value), 0)
}

/**
 * Strict Quantity Sanitizer:
 * - If allowDecimal is false (pieces, boxes): Strict Positive Integer (1, 2, 3...)
 * - If allowDecimal is true (kg, liters, weighed items): Strict Positive Float (max 3 decimals, min 0.001)
 */
export function cleanPositiveQuantity(qty: unknown, allowDecimal: boolean = false): number {
  const val = Math.abs(toNumber(qty))
  if (val <= 0) return allowDecimal ? 0.001 : 1
  if (!allowDecimal) {
    return Math.max(1, Math.floor(val))
  }
  return Math.max(0.001, Math.round((val + Number.EPSILON) * 1000) / 1000)
}

/** Strict Price Sanitizer: Never negative, max 2 decimals */
export function cleanPositivePrice(price: unknown): number {
  const val = Math.abs(toNumber(price))
  return money(val)
}

/** Strict Discount Sanitizer: Between 0 and maxBase */
export function cleanPositiveDiscount(discount: unknown, maxBase: number): number {
  const val = Math.abs(toNumber(discount))
  const safeBase = Math.max(0, money(maxBase))
  return money(Math.min(val, safeBase))
}

/** Calculate discount amount from type and value */
export function calcDiscount(
  type: 'fixed' | 'percent',
  value: number,
  base: number
): number {
  const safeBase = positive(base)
  if (type === 'percent') {
    const percent = Math.min(positive(value), 100)
    return money(safeBase * (percent / 100))
  }
  return money(Math.min(positive(value), safeBase))
}

/** Settle payment and determine status with strict non-negative rules */
export function settlePayment(total: number, paidAmount: number) {
  const safeTotal = money(positive(total))
  const paid = money(positive(paidAmount))
  const due = money(Math.max(safeTotal - paid, 0))
  const change = money(Math.max(paid - safeTotal, 0))
  
  let status: 'paid' | 'partial' | 'unpaid'

  if (paid >= safeTotal && safeTotal > 0) {
    status = 'paid'
  } else if (paid > 0 && paid < safeTotal) {
    status = 'partial'
  } else {
    status = safeTotal === 0 ? 'paid' : 'unpaid'
  }

  return { paidAmount: paid, dueAmount: due, changeAmount: change, paymentStatus: status }
}

/** Generate sequential number with prefix */
export function generateSequenceNumber(prefix: string): string {
  const timestamp = Date.now().toString(36).toUpperCase()
  const random = Math.random().toString(36).substring(2, 6).toUpperCase()
  return `${prefix}-${timestamp}-${random}`
}

/** Generate invoice number */
export function generateInvoiceNumber(): string {
  return generateSequenceNumber('APR-INV')
}

/** Generate sale number (alias for invoice number) */
export const generateSaleNumber = generateInvoiceNumber

/** Generate purchase number */
export function generatePurchaseNumber(): string {
  return generateSequenceNumber('APR-PUR')
}

/** Generate return number */
export function generateReturnNumber(type: 'sale' | 'purchase'): string {
  return generateSequenceNumber(type === 'sale' ? 'APR-SRT' : 'APR-PRT')
}

/** Generate transfer number */
export function generateTransferNumber(): string {
  return generateSequenceNumber('APR-TRF')
}

/** Generate stocktaking number */
export function generateStocktakingNumber(): string {
  return generateSequenceNumber('APR-STK')
}

/** Format currency with Arabic locale */
export function formatCurrency(amount: number, currency = 'EGP'): string {
  return new Intl.NumberFormat('ar-EG', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(money(positive(amount)))
}

/** Format number with Arabic locale */
export function formatNumber(num: number, decimals = 0): string {
  return new Intl.NumberFormat('ar-EG', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(positive(num))
}
