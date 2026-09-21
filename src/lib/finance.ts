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
  return generateSequenceNumber('ERP-INV')
}

/** Generate sale number (alias for invoice number) */
export const generateSaleNumber = generateInvoiceNumber

/** Generate purchase number */
export function generatePurchaseNumber(): string {
  return generateSequenceNumber('ERP-PUR')
}

/** Generate return number */
export function generateReturnNumber(type: 'sale' | 'purchase'): string {
  return generateSequenceNumber(type === 'sale' ? 'ERP-SRT' : 'ERP-PRT')
}

/** Generate transfer number */
export function generateTransferNumber(): string {
  return generateSequenceNumber('ERP-TRF')
}

/** Generate stocktaking number */
export function generateStocktakingNumber(): string {
  return generateSequenceNumber('ERP-STK')
}

/** Generate shift number */
export function generateShiftNumber(): string {
  return generateSequenceNumber('ERP-SHF')
}

/** Standard prefixes for electronic weight scales (EAN-13) */
export const SCALE_BARCODE_PREFIXES = ['20', '21', '22', '23', '24', '27', '28', '99']

/** Check if scanned barcode is an electronic scale barcode */
export function isScaleBarcode(barcode: string): boolean {
  if (!barcode || typeof barcode !== 'string') return false
  const clean = barcode.trim()
  if (clean.length < 12 || clean.length > 13) return false
  const prefix2 = clean.slice(0, 2)
  return SCALE_BARCODE_PREFIXES.includes(prefix2)
}

/**
 * Parse embedded-weight or embedded-price EAN-13 scale barcode
 * Format: [PP][IIIII][WWWWW][C]
 * PP = Prefix (20, 21, 22, 28, 99 for weight; 27 for price)
 * IIIII = 5-digit item code
 * WWWWW = 5-digit weight in grams (e.g. 01250 = 1.250 kg)
 * PPPPP = 5-digit price in cents/piastres (e.g. 02550 = 25.50)
 * C = Check digit
 */
export function parseScaleBarcode(barcode: string): {
  isValid: boolean
  prefix: string
  itemCode: string
  weight?: number
  price?: number
  type: 'weight' | 'price'
  rawBarcode: string
} {
  const clean = (barcode || '').trim()
  if (!isScaleBarcode(clean)) {
    return {
      isValid: false,
      prefix: '',
      itemCode: '',
      type: 'weight',
      rawBarcode: clean,
    }
  }

  const prefix = clean.slice(0, 2)
  const itemCode = clean.slice(2, 7)
  const valuePart = clean.slice(7, 12)

  if (prefix === '27') {
    const rawPrice = parseInt(valuePart, 10) || 0
    const price = money(rawPrice / 100)
    return {
      isValid: true,
      prefix,
      itemCode,
      price,
      type: 'price',
      rawBarcode: clean,
    }
  }

  const rawGrams = parseInt(valuePart, 10) || 0
  const weight = Math.round((rawGrams / 1000 + Number.EPSILON) * 1000) / 1000
  return {
    isValid: true,
    prefix,
    itemCode,
    weight,
    type: 'weight',
    rawBarcode: clean,
  }
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

/** Generate standard 13-digit EAN barcode with valid checksum */
export function generateBarcode(prefix = '622'): string {
  const randomPart = Math.floor(100000000 + Math.random() * 900000000).toString()
  const raw12 = `${prefix}${randomPart}`.slice(0, 12)
  let sum = 0
  for (let i = 0; i < 12; i++) {
    const digit = parseInt(raw12[i], 10)
    sum += i % 2 === 0 ? digit : digit * 3
  }
  const checkDigit = (10 - (sum % 10)) % 10
  return `${raw12}${checkDigit}`
}
