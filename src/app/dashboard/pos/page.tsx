'use client'

import React, { useState, useEffect, useRef, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, getDeviceId } from '@/lib/db'
import { generateSaleNumber, cleanPositiveQuantity, cleanPositivePrice, cleanPositiveDiscount, money, formatCurrency } from '@/lib/finance'
import { syncEngine, DEFAULT_STORE_UUID, DEFAULT_BRANCH_UUID } from '@/lib/sync-engine'
import { useStore } from '@/lib/store-context'
import { useAuth } from '@/lib/auth-context'
import { toast } from 'sonner'
import { 
  Search, 
  Plus, 
  Minus, 
  Trash2, 
  ShoppingCart, 
  CreditCard, 
  Banknote, 
  X, 
  CheckCircle2, 
  User, 
  Sparkles, 
  Printer, 
  RotateCcw, 
  Scale, 
  Tag, 
  ChevronDown,
  Home,
  Sun,
  Moon,
  Bell,
  Headphones,
  Calendar,
  Layers,
  Calculator,
  Receipt,
  FileSpreadsheet,
  Undo2,
  Clock,
  ArrowRightLeft,
  DollarSign,
  Building2,
  Info,
  LogOut,
  ShoppingBag,
  AlertTriangle,
  Package,
  Layers3
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { WeightScaleModal } from '@/components/WeightScaleModal'
import { CalculatorModal } from '@/components/calculator-modal'
import { ThermalReceipt } from './receipt'
import type { Sale, SaleLine, CashTransaction, Customer, Item, PaymentStatus, PaymentMethod, StockLedgerEntry } from '@/lib/types'

interface UnitOption {
  unit_name: string
  conversion_factor: number
  price?: number
}

interface CartItem {
  id: string
  item_id: string
  name: string
  base_name: string
  quantity: number
  unit_price: number
  base_price: number
  discount: number
  total: number
  allow_decimal?: boolean
  available_stock: number
  base_unit: string
  unit_name: string
  conversion_factor: number
  available_units: UnitOption[]
  exceeds_stock?: boolean
}

export default function POSPage() {
  const router = useRouter()
  const { storeName, storeId, branchId, businessType } = useStore()
  const { currentUser, logout } = useAuth()

  const [searchTerm, setSearchTerm] = useState('')
  const [cart, setCart] = useState<CartItem[]>([])
  const [customerMode, setCustomerMode] = useState<'cash' | 'customer' | 'supplier'>('cash')
  const [customerName, setCustomerName] = useState('عميل نقدي')
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null)
  const [priceCategory, setPriceCategory] = useState<'default' | 'wholesale' | 'retail'>('default')
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'credit' | 'split'>('cash')
  const [paidAmount, setPaidAmount] = useState<string>('')
  const [lastSale, setLastSale] = useState<any>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [selectedCatId, setSelectedCatId] = useState<string>('all')
  const [showQuickItems, setShowQuickItems] = useState(false)

  // Modals state
  const [scaleModalOpen, setScaleModalOpen] = useState(false)
  const [scaleItem, setScaleItem] = useState<any>(null)
  const [calculatorOpen, setCalculatorOpen] = useState(false)
  const [inquiryModalOpen, setInquiryModalOpen] = useState(false)
  const [inquiryQuery, setInquiryQuery] = useState('')
  const [expenseModalOpen, setExpenseModalOpen] = useState(false)
  const [expenseAmount, setExpenseAmount] = useState('')
  const [expenseNote, setExpenseNote] = useState('')
  const [suspendedCarts, setSuspendedCarts] = useState<{ id: string; name: string; date: string; cart: CartItem[] }[]>([])
  const [suspendedModalOpen, setSuspendedModalOpen] = useState(false)
  const [recentSalesModalOpen, setRecentSalesModalOpen] = useState(false)
  const [shiftModalOpen, setShiftModalOpen] = useState(false)

  const searchInputRef = useRef<HTMLInputElement>(null)
  const currentStoreId = storeId || DEFAULT_STORE_UUID
  const currentBranchId = branchId || DEFAULT_BRANCH_UUID

  // ─── Live Queries ───
  const allItems = useLiveQuery(
    () => db.items.where('store_id').equals(currentStoreId).filter(i => i.status === 'active').toArray(),
    [currentStoreId]
  ) || []

  const allCategories = useLiveQuery(
    () => db.categories.where('store_id').equals(currentStoreId).sortBy('sort_order'),
    [currentStoreId]
  ) || []

  const allCustomers = useLiveQuery(
    () => db.customers.where('store_id').equals(currentStoreId).toArray(),
    [currentStoreId]
  ) || []

  const recentSalesList = useLiveQuery(
    () => db.sales.where('store_id').equals(currentStoreId).reverse().limit(10).toArray(),
    [currentStoreId]
  ) || []

  const stockBalances = useLiveQuery(
    () => db.stock_balances.where('store_id').equals(currentStoreId).toArray(),
    [currentStoreId]
  ) || []

  const allItemUnits = useLiveQuery(
    () => db.item_units.where('store_id').equals(currentStoreId).toArray(),
    [currentStoreId]
  ) || []

  // Stock Map for Instant Stock Inquiries (Item ID -> Total Available in base units)
  const stockMap = useMemo(() => {
    const map = new Map<string, number>()
    stockBalances.forEach(sb => {
      map.set(sb.item_id, (map.get(sb.item_id) || 0) + (sb.quantity || 0))
    })
    return map
  }, [stockBalances])

  // Units Map (Item ID -> Unit Options)
  const itemUnitsMap = useMemo(() => {
    const map = new Map<string, UnitOption[]>()
    allItemUnits.forEach(u => {
      if (!map.has(u.item_id)) map.set(u.item_id, [])
      map.get(u.item_id)!.push({
        unit_name: u.unit_name,
        conversion_factor: u.conversion_factor || 1,
        price: u.sell_price
      })
    })
    return map
  }, [allItemUnits])

  // Focus search input on load & listen for F-keys shortcuts
  useEffect(() => {
    if (searchInputRef.current) {
      searchInputRef.current.focus()
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault()
        if (searchInputRef.current) searchInputRef.current.focus()
      } else if (e.key === 'F3') {
        e.preventDefault()
        setInquiryModalOpen(true)
      } else if (e.key === 'F4') {
        e.preventDefault()
        setCalculatorOpen(prev => !prev)
      } else if (e.key === 'F9') {
        e.preventDefault()
        handleCompleteSale('split')
      } else if (e.key === 'F10') {
        e.preventDefault()
        handleCompleteSale('cash')
      } else if (e.key === 'F12' || e.key === 'Escape') {
        e.preventDefault()
        clearCart()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [cart, paidAmount, paymentMethod, customerName])

  // Get available unit options for an item (including weight presets or custom units)
  const getItemUnitOptions = (item: any): UnitOption[] => {
    const baseUnitName = item.unit || (item.allow_decimal ? 'كيلو جرام' : 'قطعة')
    const customUnits = itemUnitsMap.get(item.id) || []

    if (customUnits.length > 0) {
      // Ensure base unit is included
      const hasBase = customUnits.some(u => u.conversion_factor === 1)
      return hasBase ? customUnits : [{ unit_name: baseUnitName, conversion_factor: 1 }, ...customUnits]
    }

    // Weight item presets (معامل التفكيك بالأوزان)
    if (item.allow_decimal || baseUnitName.includes('كيلو') || baseUnitName === 'كجم') {
      return [
        { unit_name: 'كيلو جرام (1 كجم)', conversion_factor: 1 },
        { unit_name: 'نصف كيلو (500 جم)', conversion_factor: 0.5 },
        { unit_name: 'ربع كيلو (250 جم)', conversion_factor: 0.25 },
        { unit_name: 'ثمن كيلو (125 جم)', conversion_factor: 0.125 },
        { unit_name: '100 جرام', conversion_factor: 0.1 },
      ]
    }

    // Default single unit
    return [{ unit_name: baseUnitName, conversion_factor: 1 }]
  }

  const handleSearchKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && searchTerm.trim()) {
      e.preventDefault()
      const query = searchTerm.trim().toLowerCase()
      let item: any = null
      let matchedUnitName: string | undefined = undefined
      let matchedMultiplier: number = 1
      let matchedPrice: number | undefined = undefined

      // 1. Search in item_barcodes
      const barcodeRecord = await db.item_barcodes.where('barcode').equals(query).first()
      if (barcodeRecord) {
        item = await db.items.get(barcodeRecord.item_id)
        if (barcodeRecord.conversion_factor && barcodeRecord.conversion_factor > 0) {
          matchedMultiplier = barcodeRecord.conversion_factor
          matchedUnitName = barcodeRecord.unit_name
          matchedPrice = barcodeRecord.price_override
        }
      }

      // 2. Or search by SKU or name
      if (!item) {
        item = await db.items.where('sku').equals(query).first()
      }
      if (!item) {
        item = await db.items.filter(i => (i.search_text || i.name || '').toLowerCase().includes(query)).first()
      }

      if (item) {
        if (matchedMultiplier > 0 && matchedMultiplier !== 1) {
          addToCart(item, 1, matchedUnitName, matchedPrice, matchedMultiplier)
        } else {
          handleItemClick(item)
        }
        setSearchTerm('')
      } else {
        toast.error('لم يتم العثور على الصنف - تأكد من قراءة الباركود أو كتابة الاسم بشكل صحيح')
      }
    }
  }

  const handleItemClick = (item: any) => {
    if (item.allow_decimal) {
      setScaleItem(item)
      setScaleModalOpen(true)
    } else {
      addToCart(item, 1)
    }
  }

  // Add Item to Cart with full unit conversion & stock awareness
  const addToCart = (
    item: any, 
    quantity: number = 1, 
    unitLabel?: string, 
    overridePrice?: number,
    conversionFactor: number = 1
  ) => {
    const basePrice = cleanPositivePrice(
      priceCategory === 'wholesale' && item.wholesale_price 
        ? item.wholesale_price 
        : (item.sell_price || item.unit_price || 0)
    )
    
    const unitPrice = overridePrice !== undefined && overridePrice > 0 
      ? overridePrice 
      : money(basePrice * conversionFactor)

    const allowDec = Boolean(item.allow_decimal)
    const validQty = cleanPositiveQuantity(quantity, allowDec)
    const availableStock = stockMap.get(item.id) ?? 0
    const baseUnitName = item.unit || (allowDec ? 'كيلو جرام' : 'قطعة')
    const unitName = unitLabel || baseUnitName
    const unitOptions = getItemUnitOptions(item)

    setCart(prev => {
      const existing = prev.find(i => i.item_id === item.id && i.unit_name === unitName)
      if (existing) {
        const nextQty = allowDec 
          ? cleanPositiveQuantity(existing.quantity + validQty, true)
          : cleanPositiveQuantity(existing.quantity + validQty, false)
        
        const totalBaseQty = nextQty * existing.conversion_factor
        const exceeds = item.manage_inventory !== false && totalBaseQty > availableStock
        const nextTotal = money(nextQty * existing.unit_price - existing.discount)

        if (exceeds) {
          toast.warning(`تنبيه: الكمية المطلوبة (${nextQty} ${unitName}) تتجاوز المخزون المتاح (${availableStock} ${baseUnitName})`)
        }

        return prev.map(i => (i.item_id === item.id && i.unit_name === unitName)
          ? { 
              ...i, 
              quantity: nextQty, 
              total: Math.max(0, nextTotal),
              available_stock: availableStock,
              exceeds_stock: exceeds
            } 
          : i
        )
      }

      const totalBaseQty = validQty * conversionFactor
      const exceeds = item.manage_inventory !== false && totalBaseQty > availableStock

      if (exceeds) {
        toast.warning(`تنبيه: الكمية المطلوبة (${validQty} ${unitName}) تتجاوز المخزون المتاح (${availableStock} ${baseUnitName})`)
      }

      return [...prev, {
        id: crypto.randomUUID(),
        item_id: item.id,
        name: unitLabel && unitLabel !== baseUnitName ? `${item.name} (${unitLabel})` : item.name,
        base_name: item.name,
        quantity: validQty,
        unit_price: unitPrice,
        base_price: basePrice,
        discount: 0,
        total: money(validQty * unitPrice),
        allow_decimal: allowDec,
        available_stock: availableStock,
        base_unit: baseUnitName,
        unit_name: unitName,
        conversion_factor: conversionFactor,
        available_units: unitOptions,
        exceeds_stock: exceeds
      }]
    })

    toast.success(`تمت إضافة: ${item.name}`, { duration: 1200 })
  }

  // Change unit / conversion factor of a cart row directly
  const handleUnitChange = (cartItemId: string, newUnit: UnitOption) => {
    setCart(prev => prev.map(item => {
      if (item.id === cartItemId) {
        const newUnitPrice = newUnit.price !== undefined && newUnit.price > 0
          ? newUnit.price
          : money(item.base_price * newUnit.conversion_factor)
        
        const totalBaseQty = item.quantity * newUnit.conversion_factor
        const exceeds = totalBaseQty > item.available_stock
        const newTotal = money(item.quantity * newUnitPrice - item.discount)

        return {
          ...item,
          name: newUnit.unit_name !== item.base_unit ? `${item.base_name} (${newUnit.unit_name})` : item.base_name,
          unit_name: newUnit.unit_name,
          unit_price: newUnitPrice,
          conversion_factor: newUnit.conversion_factor,
          total: Math.max(0, newTotal),
          exceeds_stock: exceeds
        }
      }
      return item
    }))
    toast.info(`تم تغيير الوحدة إلى: ${newUnit.unit_name}`)
  }

  const handleScaleConfirm = (calculatedKg: number) => {
    if (!scaleItem) return
    const validKg = cleanPositiveQuantity(calculatedKg, true)
    const basePrice = cleanPositivePrice(scaleItem.sell_price || scaleItem.unit_price || 0)
    const availableStock = stockMap.get(scaleItem.id) ?? 0
    const exceeds = scaleItem.manage_inventory !== false && validKg > availableStock

    if (exceeds) {
      toast.warning(`تنبيه: الوزن المطلوب (${validKg} كجم) يتجاوز المخزون المتاح (${availableStock} كجم)`)
    }

    setCart(prev => {
      const existing = prev.find(i => i.item_id === scaleItem.id)
      if (existing) {
        const nextTotal = money(validKg * existing.unit_price - existing.discount)
        return prev.map(i => i.item_id === scaleItem.id
          ? { 
              ...i, 
              quantity: validKg, 
              total: Math.max(0, nextTotal),
              available_stock: availableStock,
              exceeds_stock: exceeds
            }
          : i
        )
      }

      const unitOptions = getItemUnitOptions(scaleItem)
      return [...prev, {
        id: crypto.randomUUID(),
        item_id: scaleItem.id,
        name: scaleItem.name,
        base_name: scaleItem.name,
        quantity: validKg,
        unit_price: basePrice,
        base_price: basePrice,
        discount: 0,
        total: money(validKg * basePrice),
        allow_decimal: true,
        available_stock: availableStock,
        base_unit: scaleItem.unit || 'كيلو جرام',
        unit_name: 'كيلو جرام',
        conversion_factor: 1,
        available_units: unitOptions,
        exceeds_stock: exceeds
      }]
    })

    toast.success(`تم إدراج الوزن: ${validKg} كجم`)
  }

  const updateQuantity = (id: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        const newQty = cleanPositiveQuantity(item.quantity + delta, item.allow_decimal)
        if (newQty <= 0) return null

        const totalBaseQty = newQty * (item.conversion_factor || 1)
        const exceeds = totalBaseQty > item.available_stock

        if (exceeds && delta > 0) {
          toast.warning(`تنبيه: الكمية (${newQty}) تتجاوز المخزون المتاح (${item.available_stock} ${item.base_unit})`)
        }

        return {
          ...item,
          quantity: newQty,
          total: money(newQty * item.unit_price - item.discount),
          exceeds_stock: exceeds
        }
      }
      return item
    }).filter(Boolean) as CartItem[])
  }

  const handleDirectQuantityChange = (id: string, rawVal: string) => {
    const val = parseFloat(rawVal)
    if (isNaN(val) || val <= 0) return
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        const newQty = cleanPositiveQuantity(val, item.allow_decimal)
        const totalBaseQty = newQty * (item.conversion_factor || 1)
        const exceeds = totalBaseQty > item.available_stock

        return {
          ...item,
          quantity: newQty,
          total: money(newQty * item.unit_price - item.discount),
          exceeds_stock: exceeds
        }
      }
      return item
    }))
  }

  const removeFromCart = (id: string) => {
    setCart(prev => prev.filter(item => item.id !== id))
    toast.info('تم حذف الصنف من السلة')
  }

  const clearCart = () => {
    if (cart.length > 0) {
      setCart([])
      setPaidAmount('')
      toast.info('تم تفريغ السلة')
    }
  }

  // Hold / Suspend cart
  const handleHoldCart = () => {
    if (cart.length === 0) {
      toast.error('السلة فارغة، لا يمكن تعليقها')
      return
    }
    const suspended = {
      id: crypto.randomUUID(),
      name: `${customerName} (${cart.length} أصناف)`,
      date: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
      cart: [...cart]
    }
    setSuspendedCarts(prev => [suspended, ...prev])
    setCart([])
    toast.success('تم تعليق الفاتورة بنجاح')
  }

  const handleResumeCart = (item: typeof suspendedCarts[0]) => {
    setCart(item.cart)
    setSuspendedCarts(prev => prev.filter(s => s.id !== item.id))
    setSuspendedModalOpen(false)
    toast.success(`تم استرجاع سلة: ${item.name}`)
  }

  // Quick expense creation
  const handleSaveExpense = async (e: React.FormEvent) => {
    e.preventDefault()
    const num = cleanPositivePrice(parseFloat(expenseAmount))
    if (num <= 0) {
      toast.error('يرجى إدخال مبلغ صحيح للمصروف')
      return
    }
    const tx: CashTransaction = {
      id: crypto.randomUUID(),
      store_id: currentStoreId,
      branch_id: currentBranchId,
      type: 'expense',
      transaction_type: 'expense_out',
      amount: num,
      payment_method: 'cash',
      notes: expenseNote.trim() || 'مصروف نقطة البيع',
      created_at: new Date().toISOString(),
    }
    await db.cash_transactions.add(tx)
    setExpenseAmount('')
    setExpenseNote('')
    setExpenseModalOpen(false)
    toast.success(`تم تسجيل مصروف بقيمة ${num.toFixed(2)} ج.م في الخزينة`)
  }

  // Calculations
  const subtotal = money(cart.reduce((acc, item) => acc + (item.quantity * item.unit_price), 0))
  const totalDiscount = money(cart.reduce((acc, item) => acc + item.discount, 0))
  const finalTotal = Math.max(0, money(subtotal - totalDiscount))
  const totalItemsCount = cart.reduce((acc, item) => acc + (item.allow_decimal ? 1 : item.quantity), 0)

  // Complete checkout & automatically deduct stock from Dexie & record stock movement
  const handleCompleteSale = async (method: 'cash' | 'card' | 'credit' | 'split' = paymentMethod) => {
    if (cart.length === 0) {
      toast.error('السلة فارغة! يرجى إضافة أصناف أولاً')
      return
    }

    try {
      setIsProcessing(true)
      const saleId = crypto.randomUUID()
      const invoiceNumber = generateSaleNumber()
      const now = new Date().toISOString()
      const deviceId = getDeviceId()

      const isCredit = method === 'credit'
      const parsedPaid = isCredit ? 0 : finalTotal
      const paymentStatus: PaymentStatus = isCredit ? 'unpaid' : 'paid'
      const pMethod: PaymentMethod = method === 'card' ? 'card' : 'cash'

      const saleRecord: Sale = {
        id: saleId,
        store_id: currentStoreId,
        branch_id: currentBranchId,
        invoice_number: invoiceNumber,
        customer_id: selectedCustomerId || undefined,
        customer_name: customerName || 'عميل نقدي',
        subtotal,
        discount_total: totalDiscount,
        tax_total: 0,
        round_diff: 0,
        total: finalTotal,
        paid_amount: parsedPaid,
        change_amount: 0,
        due_amount: Math.max(0, money(finalTotal - parsedPaid)),
        payment_method: pMethod,
        payment_status: paymentStatus,
        status: 'invoice',
        created_by: currentUser?.id || 'cashier',
        device_id: deviceId,
        sale_date: now,
        created_at: now,
        updated_at: now
      }

      const saleLines: SaleLine[] = cart.map(item => ({
        id: crypto.randomUUID(),
        store_id: currentStoreId,
        sale_id: saleId,
        item_id: item.item_id,
        item_name: item.name,
        quantity: item.quantity,
        unit_price: item.unit_price,
        cost_price: 0,
        discount: item.discount,
        tax: 0,
        net_total: item.total,
      }))

      // Atomic Transaction: Save Sale + Lines + Cash Tx + Deduct Stock Balances + Stock Ledger Audit
      await db.transaction('rw', [db.sales, db.sale_lines, db.cash_transactions, db.stock_balances, db.stock_ledger], async () => {
        await db.sales.add(saleRecord)
        await db.sale_lines.bulkAdd(saleLines)

        // 1. Deduct Stock for each line
        for (const line of cart) {
          const baseQtyDeducted = line.quantity * (line.conversion_factor || 1)
          
          // Find stock balance record
          const sb = await db.stock_balances
            .where('item_id')
            .equals(line.item_id)
            .first()

          const currentQty = sb?.quantity || 0
          const updatedQty = currentQty - baseQtyDeducted

          if (sb && sb.id) {
            await db.stock_balances.update(sb.id, {
              quantity: updatedQty,
              updated_at: now
            })
            syncEngine.enqueueOperation('stock_balances', 'UPDATE', { ...sb, quantity: updatedQty, updated_at: now })
          } else {
            const newSb = {
              id: crypto.randomUUID(),
              store_id: currentStoreId,
              branch_id: currentBranchId,
              item_id: line.item_id,
              quantity: updatedQty,
              updated_at: now
            }
            await db.stock_balances.add(newSb)
            syncEngine.enqueueOperation('stock_balances', 'INSERT', newSb)
          }

          // 2. Add Stock Ledger Entry
          const ledgerEntry: StockLedgerEntry = {
            id: crypto.randomUUID(),
            store_id: currentStoreId,
            branch_id: currentBranchId,
            item_id: line.item_id,
            movement_type: 'sale',
            direction: 'out',
            quantity: baseQtyDeducted,
            unit_price: line.unit_price,
            total: line.total,
            source_table: 'sales',
            source_id: saleId,
            notes: `فاتورة بيع نقدي رقم ${invoiceNumber} (${line.name})`,
            created_by: currentUser?.id || 'cashier',
            created_at: now
          }
          await db.stock_ledger.add(ledgerEntry)
          syncEngine.enqueueOperation('stock_ledger', 'INSERT', ledgerEntry)
        }

        // 3. Record Cash Inflow
        if (parsedPaid > 0) {
          const cashTx: CashTransaction = {
            id: crypto.randomUUID(),
            store_id: currentStoreId,
            branch_id: currentBranchId,
            type: 'sale',
            transaction_type: 'sale_in',
            amount: parsedPaid,
            payment_method: pMethod,
            notes: `تحصيل فاتورة مبيعات رقم ${invoiceNumber}`,
            reference_type: 'sale',
            reference_id: saleId,
            created_at: now
          }
          await db.cash_transactions.add(cashTx)
        }
      })

      setLastSale({
        ...saleRecord,
        lines: cart.map(c => ({ name: c.name, quantity: c.quantity, unitPrice: c.unit_price, total: c.total }))
      })

      toast.success(`تم حفظ الفاتورة بنجاح: ${invoiceNumber} وخصم المخزون`)
      setCart([])
      setPaidAmount('')

    } catch (err: any) {
      console.error('POS Error:', err)
      toast.error('حدث خطأ أثناء حفظ الفاتورة: ' + err.message)
    } finally {
      setIsProcessing(false)
    }
  }

  const quickItems = useMemo(() => {
    if (selectedCatId === 'all') return allItems.slice(0, 24)
    return allItems.filter(i => i.category_id === selectedCatId).slice(0, 24)
  }, [allItems, selectedCatId])

  const filteredInquiryItems = useMemo(() => {
    if (!inquiryQuery.trim()) return allItems.slice(0, 20)
    const q = inquiryQuery.toLowerCase()
    return allItems.filter(i => 
      (i.name || '').toLowerCase().includes(q) || 
      (i.sku || '').toLowerCase().includes(q) ||
      (i.search_text || '').toLowerCase().includes(q)
    ).slice(0, 30)
  }, [allItems, inquiryQuery])

  return (
    <div className="fixed inset-0 z-40 bg-[#070e1c] text-white flex flex-col font-sans select-none overflow-hidden" dir="rtl">
      
      {/* ─── 1. TOP APP BAR ─── */}
      <div className="bg-[#0b1528] border-b border-slate-800 px-4 py-2.5 flex items-center justify-between gap-3 shadow-md">
        
        {/* Left Side: Logo & Status */}
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            className="w-10 h-10 rounded-2xl bg-blue-600 hover:bg-blue-500 flex items-center justify-center text-white shadow-lg shadow-blue-600/30 transition-all cursor-pointer"
            title="العودة للوحة التحكم"
          >
            <Home className="w-5 h-5" />
          </Link>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-black tracking-tight text-white flex items-center gap-1.5">
                <ShoppingCart className="w-4 h-4 text-blue-400" />
                <span>نقطة البيع (POS)</span>
              </h1>
              <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-emerald-950/80 text-emerald-400 border border-emerald-800/60">
                ● متصل
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-medium">
              {storeName || 'المتجر الرئيسي'} • {currentUser?.name || 'الكاشير'}
            </p>
          </div>
        </div>

        {/* Center: Action Shortcut Badges */}
        <div className="hidden lg:flex items-center gap-2">
          <button
            type="button"
            onClick={() => setExpenseModalOpen(true)}
            className="px-3 py-1.5 rounded-xl bg-rose-950/80 hover:bg-rose-900/90 text-rose-300 border border-rose-800/60 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Receipt className="w-3.5 h-3.5" />
            <span>إضافة مصروفات</span>
          </button>

          <button
            type="button"
            onClick={() => setInquiryModalOpen(true)}
            className="px-3 py-1.5 rounded-xl bg-purple-950/80 hover:bg-purple-900/90 text-purple-300 border border-purple-800/60 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Search className="w-3.5 h-3.5" />
            <span>استعلام أصناف (F3)</span>
          </button>

          <button
            type="button"
            onClick={() => setShowQuickItems(prev => !prev)}
            className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
              showQuickItems 
                ? 'bg-amber-600 text-white border-amber-500' 
                : 'bg-amber-950/80 text-amber-300 border-amber-800/60 hover:bg-amber-900/90'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>أصناف سريعة</span>
          </button>

          <button
            type="button"
            onClick={() => setRecentSalesModalOpen(true)}
            className="px-3 py-1.5 rounded-xl bg-blue-950/80 hover:bg-blue-900/90 text-blue-300 border border-blue-800/60 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Clock className="w-3.5 h-3.5" />
            <span>آخر العمليات</span>
          </button>

          <button
            type="button"
            onClick={() => setSuspendedModalOpen(true)}
            className="px-3 py-1.5 rounded-xl bg-teal-950/80 hover:bg-teal-900/90 text-teal-300 border border-teal-800/60 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>معلقة ({suspendedCarts.length})</span>
          </button>
        </div>

        {/* Right Side: Shift & Utility Buttons */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setCalculatorOpen(prev => !prev)}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
            title="الآلة الحاسبة (F4)"
          >
            <Calculator className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => setShiftModalOpen(true)}
            className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-black flex items-center gap-1.5 shadow-md shadow-rose-600/20 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>إغلاق الوردية</span>
          </button>
        </div>

      </div>

      {/* ─── 2. SEARCH & CUSTOMER BAR ─── */}
      <div className="bg-[#0b1528] border-b border-slate-800 px-5 py-3.5 flex items-center justify-between gap-4 flex-wrap shadow-sm">
        
        {/* Search Bar */}
        <div className="flex-1 min-w-[320px] max-w-3xl relative">
          <Input
            ref={searchInputRef}
            placeholder="ابحث هنا باسم الصنف، الباركود، أو SKU... [F2]"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            className="h-12 bg-[#13223d] border-slate-700 text-white rounded-2xl pr-12 pl-20 text-sm sm:text-base font-bold placeholder:text-slate-500 focus:border-blue-500 shadow-inner"
            autoFocus
          />
          <div className="absolute right-4 top-3.5 text-slate-400 pointer-events-none">
            <Search className="w-5 h-5" />
          </div>
          <div className="absolute left-3 top-2 flex items-center gap-1.5">
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
            <span className="px-2.5 py-1 rounded-lg bg-blue-900/80 text-blue-200 font-mono text-xs font-black border border-blue-700/50">
              {cart.length} أصناف
            </span>
          </div>
        </div>

        {/* Price Category & Customer Selector */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="flex items-center gap-2 px-3.5 py-2 bg-[#13223d] border border-slate-700 rounded-xl text-xs font-black text-slate-200">
              <Tag className="w-3.5 h-3.5 text-blue-400" />
              <span className="text-slate-400 font-normal">السعر:</span>
              <select
                value={priceCategory}
                onChange={e => setPriceCategory(e.target.value as any)}
                className="bg-transparent text-white font-black outline-none cursor-pointer text-xs"
              >
                <option value="default" className="bg-[#0b1528] text-white">الافتراضي</option>
                <option value="wholesale" className="bg-[#0b1528] text-white">جملة</option>
                <option value="retail" className="bg-[#0b1528] text-white">قطاعي</option>
              </select>
            </div>
          </div>

          <div className="flex items-center bg-[#13223d] border border-slate-700 p-1 rounded-xl gap-1 shadow-inner">
            <button
              type="button"
              onClick={() => {
                setCustomerMode('cash')
                setCustomerName('عميل نقدي')
                setSelectedCustomerId(null)
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer ${
                customerMode === 'cash' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
              }`}
            >
              <User className="w-3.5 h-3.5" />
              <span>نقدي</span>
            </button>

            <button
              type="button"
              onClick={() => {
                const name = prompt('أدخل اسم العميل:')
                if (name && name.trim()) {
                  setCustomerMode('customer')
                  setCustomerName(name.trim())
                }
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer ${
                customerMode === 'customer' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
              }`}
            >
              <User className="w-3.5 h-3.5" />
              <span>{customerMode === 'customer' ? customerName : 'عميل مسمى'}</span>
            </button>
          </div>
        </div>

      </div>

      {/* ─── 3. QUICK ITEMS GALLERY ─── */}
      {showQuickItems && (
        <div className="bg-[#0b1528] border-b border-slate-800 p-4 space-y-3 animate-fadeIn">
          <div className="flex items-center gap-2 overflow-x-auto pb-1.5">
            <button
              type="button"
              onClick={() => setSelectedCatId('all')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-black shrink-0 transition-colors ${
                selectedCatId === 'all' ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              الكل ({allItems.length})
            </button>
            {allCategories.map(c => (
              <button
                key={c.id}
                type="button"
                onClick={() => setSelectedCatId(c.id)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-black shrink-0 transition-colors ${
                  selectedCatId === c.id ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2.5 max-h-44 overflow-y-auto p-1">
            {quickItems.map(item => {
              const stock = stockMap.get(item.id) ?? 0
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleItemClick(item)}
                  className="p-3 rounded-2xl bg-[#13223d] hover:bg-blue-900/40 border border-slate-700 text-right flex flex-col justify-between gap-1.5 transition-all cursor-pointer active:scale-95 shadow-xs"
                >
                  <p className="text-xs font-black text-white truncate w-full">{item.name}</p>
                  <div className="flex items-center justify-between w-full text-[10px]">
                    <span className="font-black text-emerald-400 font-mono" dir="ltr">
                      {cleanPositivePrice(item.sell_price).toFixed(2)} ج.م
                    </span>
                    <span className={`font-bold px-1.5 py-0.2 rounded ${
                      stock > 0 ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/40' : 'bg-rose-950 text-rose-400 border border-rose-800/40'
                    }`}>
                      المتاح: {stock}
                    </span>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* ─── 4. MAIN CART DISPLAY ─── */}
      <div className="flex-1 flex flex-col p-4 overflow-y-auto min-h-[340px]">
        {cart.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-500 space-y-4 my-auto">
            <div className="w-24 h-24 rounded-3xl bg-[#0e1b33] border border-slate-800/80 flex items-center justify-center text-slate-500 shadow-2xl">
              <ShoppingBag className="w-12 h-12 stroke-1 text-slate-400 opacity-60" />
            </div>
            <p className="text-lg sm:text-xl font-black text-slate-300 tracking-wide">
              السلة فارغة، ابدأ بالبحث أو مسح الباركود لإضافة الأصناف
            </p>
          </div>
        ) : (
          <div className="bg-[#0b1528] rounded-2xl border border-slate-800 overflow-hidden shadow-2xl">
            <table className="w-full text-right text-xs sm:text-sm">
              <thead>
                <tr className="bg-[#13223d] border-b border-slate-800 text-xs font-black text-slate-300">
                  <th className="p-3.5">الصنف والمخزون المتوفر</th>
                  <th className="p-3.5 text-center">الوحدة / معامل التفكيك</th>
                  <th className="p-3.5 text-center">سعر الوحدة</th>
                  <th className="p-3.5 text-center w-60">الكمية</th>
                  <th className="p-3.5 text-center">الإجمالي</th>
                  <th className="p-3.5 text-center w-12">حذف</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80 font-black">
                {cart.map(item => (
                  <tr key={item.id} className={`hover:bg-slate-800/50 transition-colors ${item.exceeds_stock ? 'bg-rose-950/20' : ''}`}>
                    
                    {/* Item Name & Stock Status Badge */}
                    <td className="p-3.5">
                      <div className="space-y-1">
                        <p className="text-white font-black text-sm sm:text-base">{item.name}</p>
                        
                        <div className="flex items-center gap-2 flex-wrap text-[10px]">
                          <span className={`px-2 py-0.5 rounded-md font-bold border ${
                            item.available_stock > 0
                              ? 'bg-emerald-950/80 text-emerald-400 border-emerald-800/50'
                              : 'bg-rose-950/80 text-rose-400 border-rose-800/50'
                          }`}>
                            المتوفر بالمخزن: {item.available_stock} {item.base_unit}
                          </span>

                          {item.exceeds_stock && (
                            <span className="px-2 py-0.5 rounded-md font-black bg-rose-600/90 text-white animate-pulse flex items-center gap-1 shadow-xs">
                              <AlertTriangle className="w-3 h-3" />
                              الكمية المطلوبة تتجاوز المخزون المتوفر!
                            </span>
                          )}

                          {item.allow_decimal && (
                            <button
                              type="button"
                              onClick={() => {
                                setScaleItem({ id: item.item_id, name: item.base_name, sell_price: item.base_price, quantity: item.quantity })
                                setScaleModalOpen(true)
                              }}
                              className="px-2 py-0.5 rounded-md bg-blue-950/80 text-blue-300 border border-blue-800/50 hover:bg-blue-900 flex items-center gap-1 cursor-pointer"
                            >
                              <Scale className="w-3 h-3 text-blue-400" />
                              <span>وزن بالميزان</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Unit Selector / Disassembly Factor */}
                    <td className="p-3.5 text-center">
                      {item.available_units && item.available_units.length > 1 ? (
                        <div className="inline-block relative">
                          <select
                            value={item.unit_name}
                            onChange={(e) => {
                              const selected = item.available_units.find(u => u.unit_name === e.target.value)
                              if (selected) handleUnitChange(item.id, selected)
                            }}
                            className="bg-[#13223d] text-blue-300 border border-blue-800/60 rounded-xl px-3 py-1.5 text-xs font-bold outline-none cursor-pointer shadow-xs"
                          >
                            {item.available_units.map((u, idx) => (
                              <option key={idx} value={u.unit_name} className="bg-[#0b1528] text-white">
                                {u.unit_name} (×{u.conversion_factor})
                              </option>
                            ))}
                          </select>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-300 font-bold px-2.5 py-1 bg-slate-800 rounded-lg border border-slate-700">
                          {item.unit_name}
                        </span>
                      )}
                    </td>

                    {/* Unit Price */}
                    <td className="p-3.5 text-center font-mono text-slate-200 text-sm" dir="ltr">
                      {item.unit_price.toFixed(2)}
                    </td>

                    {/* Quantity Controls + Direct Editable Input */}
                    <td className="p-3.5 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.id, item.allow_decimal ? -0.25 : -1)}
                          className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-white flex items-center justify-center cursor-pointer active:scale-95"
                          title="إنقاص"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        
                        <input
                          type="number"
                          step={item.allow_decimal ? '0.05' : '1'}
                          min="0.01"
                          value={item.quantity}
                          onChange={e => handleDirectQuantityChange(item.id, e.target.value)}
                          className="w-20 h-8 bg-[#13223d] border border-slate-700 text-center font-mono font-black text-sm text-white rounded-lg outline-none focus:border-blue-500"
                        />

                        <button
                          type="button"
                          onClick={() => updateQuantity(item.id, item.allow_decimal ? 0.25 : 1)}
                          className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-white flex items-center justify-center cursor-pointer active:scale-95"
                          title="زيادة"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>

                    {/* Total Price */}
                    <td className="p-3.5 text-center font-mono font-black text-emerald-400 text-base" dir="ltr">
                      {item.total.toFixed(2)}
                    </td>

                    {/* Remove Row Button */}
                    <td className="p-3.5 text-center">
                      <button
                        type="button"
                        onClick={() => removeFromCart(item.id)}
                        className="w-8 h-8 rounded-xl hover:bg-rose-950/60 text-slate-500 hover:text-rose-400 flex items-center justify-center transition-colors cursor-pointer"
                        title="حذف من السلة"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ─── 5. FIXED BOTTOM SUMMARY & CHECKOUT ACTIONS ─── */}
      <div className="bg-[#0b1528] border-t border-slate-800 p-4 space-y-3.5 shadow-2xl">
        
        {/* Figures & Summary Labels */}
        <div className="flex items-center justify-between flex-wrap gap-4 px-2 border-b border-slate-800/80 pb-3">
          
          {/* Final Net Amount */}
          <div className="flex items-baseline gap-2.5">
            <span className="text-xs font-black text-slate-400">الصافي النهائي:</span>
            <span className="text-3xl sm:text-4xl font-black text-emerald-400 font-mono tracking-tight" dir="ltr">
              {finalTotal.toFixed(2)} <span className="text-sm font-bold">ج.م</span>
            </span>
          </div>

          {/* Subtotal, Discounts, and Items count */}
          <div className="flex items-center gap-6 flex-wrap text-xs sm:text-sm font-black">
            <div className="flex items-center gap-1.5 text-slate-300">
              <span className="text-slate-400 font-normal">إجمالي الخصم:</span>
              <span className="font-mono text-amber-400 font-black" dir="ltr">{totalDiscount.toFixed(2)} ج.م</span>
            </div>

            <div className="flex items-center gap-1.5 text-slate-300">
              <span className="text-slate-400 font-normal">قبل الخصم:</span>
              <span className="font-mono text-white font-black" dir="ltr">{subtotal.toFixed(2)} ج.م</span>
            </div>

            <div className="flex items-center gap-1.5 text-slate-300">
              <span className="text-slate-400 font-normal">الأصناف:</span>
              <span className="font-mono text-white text-base font-black">{totalItemsCount}</span>
            </div>
          </div>

        </div>

        {/* Bottom Action Checkout Buttons */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          
          {/* Sub Actions */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={clearCart}
              className="px-3.5 py-2.5 rounded-xl bg-rose-600/20 text-rose-400 hover:bg-rose-600 hover:text-white border border-rose-600/30 text-xs font-black transition-all cursor-pointer"
            >
              إلغاء (F12)
            </button>

            <button
              type="button"
              onClick={handleHoldCart}
              className="px-3.5 py-2.5 rounded-xl bg-blue-600/20 text-blue-400 hover:bg-blue-600 hover:text-white border border-blue-600/30 text-xs font-black transition-all cursor-pointer"
            >
              تعليق الفاتورة
            </button>
          </div>

          {/* Main Checkout Buttons */}
          <div className="flex items-center gap-2.5">
            <Button
              type="button"
              disabled={isProcessing || cart.length === 0}
              onClick={() => handleCompleteSale('credit')}
              className="h-12 px-4 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-black text-xs cursor-pointer shadow-lg shadow-purple-600/20"
            >
              بيع آجل (Credit)
            </Button>

            <Button
              type="button"
              disabled={isProcessing || cart.length === 0}
              onClick={() => handleCompleteSale('card')}
              className="h-12 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs cursor-pointer shadow-lg shadow-indigo-600/20"
            >
              <CreditCard className="w-4 h-4 ml-1.5" />
              دفع فيزا / كارت
            </Button>

            <Button
              type="button"
              disabled={isProcessing || cart.length === 0}
              onClick={() => handleCompleteSale('cash')}
              className="h-12 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm cursor-pointer shadow-xl shadow-emerald-600/30 active:scale-95 transition-all"
            >
              <Banknote className="w-4 h-4 ml-1.5" />
              دفع نقدي وحفظ (F10)
            </Button>
          </div>

        </div>

      </div>

      {/* ─── 6. MODALS ─── */}
      {/* Weight Scale Modal */}
      <WeightScaleModal
        isOpen={scaleModalOpen}
        onClose={() => setScaleModalOpen(false)}
        item={scaleItem}
        onConfirm={handleScaleConfirm}
      />

      {/* Calculator Modal */}
      <CalculatorModal
        isOpen={calculatorOpen}
        onClose={() => setCalculatorOpen(false)}
      />

      {/* Item Inquiry Modal (F3) */}
      {inquiryModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0b1528] border border-slate-700 rounded-3xl p-6 w-full max-w-2xl shadow-2xl space-y-4 text-right">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-lg font-black text-white flex items-center gap-2">
                <Search className="w-5 h-5 text-purple-400" />
                استعلام وبحث الأصناف والمخزون المتاح (F3)
              </h3>
              <button
                type="button"
                onClick={() => setInquiryModalOpen(false)}
                className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <Input
              placeholder="اكتب اسم الصنف أو كود الباركود أو SKU..."
              value={inquiryQuery}
              onChange={e => setInquiryQuery(e.target.value)}
              className="h-12 bg-[#13223d] border-slate-700 text-white rounded-xl text-sm font-bold"
              autoFocus
            />

            <div className="max-h-72 overflow-y-auto divide-y divide-slate-800 border border-slate-800 rounded-xl">
              {filteredInquiryItems.map(item => {
                const stock = stockMap.get(item.id) ?? 0
                return (
                  <div key={item.id} className="p-3 flex items-center justify-between hover:bg-slate-800/50 transition-colors">
                    <div>
                      <p className="text-sm font-bold text-white">{item.name}</p>
                      <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                        <span>الكود: {item.sku || '—'}</span>
                        <span className={`px-2 py-0.2 rounded font-bold ${
                          stock > 0 ? 'bg-emerald-950 text-emerald-400' : 'bg-rose-950 text-rose-400'
                        }`}>
                          المتوفر: {stock} {item.unit || 'وحدة'}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-black text-emerald-400 font-mono" dir="ltr">
                        {cleanPositivePrice(item.sell_price).toFixed(2)} ج.م
                      </span>
                      <Button
                        size="sm"
                        onClick={() => {
                          handleItemClick(item)
                          setInquiryModalOpen(false)
                        }}
                        className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg cursor-pointer"
                      >
                        إضافة للسلة
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Quick Expense Modal */}
      {expenseModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <form onSubmit={handleSaveExpense} className="bg-[#0b1528] border border-slate-700 rounded-3xl p-6 w-full max-w-md shadow-2xl space-y-4 text-right">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-lg font-black text-white flex items-center gap-2">
                <Receipt className="w-5 h-5 text-rose-500" />
                تسجيل مصروف جديد من الخزينة
              </h3>
              <button
                type="button"
                onClick={() => setExpenseModalOpen(false)}
                className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-300">مبلغ المصروف (ج.م) *</Label>
              <Input
                type="number"
                step="0.01"
                required
                value={expenseAmount}
                onChange={e => setExpenseAmount(e.target.value)}
                placeholder="0.00"
                className="h-12 bg-[#13223d] border-slate-700 text-white rounded-xl text-base font-bold font-mono"
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-300">بيان المصروف / الملاحظات</Label>
              <Input
                value={expenseNote}
                onChange={e => setExpenseNote(e.target.value)}
                placeholder="مثال: فاتورة كهرباء، بوفيه، إكرامية..."
                className="h-12 bg-[#13223d] border-slate-700 text-white rounded-xl text-sm font-semibold"
              />
            </div>

            <Button
              type="submit"
              className="w-full h-12 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold cursor-pointer"
            >
              خصم وتسجيل المصروف
            </Button>
          </form>
        </div>
      )}

      {/* Suspended Carts Modal */}
      {suspendedModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0b1528] border border-slate-700 rounded-3xl p-6 w-full max-w-lg shadow-2xl space-y-4 text-right">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-lg font-black text-white flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-teal-400" />
                الفواتير المعلقة ({suspendedCarts.length})
              </h3>
              <button
                type="button"
                onClick={() => setSuspendedModalOpen(false)}
                className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {suspendedCarts.length === 0 ? (
              <p className="text-center text-slate-500 py-8">لا توجد فواتير معلقة حالياً</p>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {suspendedCarts.map(s => (
                  <div key={s.id} className="p-3 bg-[#13223d] border border-slate-700 rounded-xl flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold text-white">{s.name}</p>
                      <p className="text-xs text-slate-400">الوقت: {s.date}</p>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => handleResumeCart(s)}
                      className="bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-lg cursor-pointer"
                    >
                      استرجاع للسلة
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Shift Modal */}
      {shiftModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0b1528] border border-slate-700 rounded-3xl p-6 w-full max-w-md shadow-2xl space-y-4 text-right">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-lg font-black text-white flex items-center gap-2">
                <Clock className="w-5 h-5 text-amber-400" />
                ملخص وإغلاق الوردية الحالية
              </h3>
              <button
                type="button"
                onClick={() => setShiftModalOpen(false)}
                className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 bg-[#13223d] p-4 rounded-xl border border-slate-700 text-xs">
              <p><strong className="text-slate-400">الكاشير المسؤول:</strong> {currentUser?.name || 'كاشير'}</p>
              <p><strong className="text-slate-400">الفرع / المتجر:</strong> {storeName || 'المتجر الرئيسي'}</p>
              <p><strong className="text-slate-400">عدد الفواتير الصادرة اليوم:</strong> {recentSalesList.length}</p>
              <p><strong className="text-slate-400">إجمالي المبيعات النقدية:</strong> <span className="font-mono text-emerald-400 font-bold">{recentSalesList.reduce((acc, s) => acc + (s.total || 0), 0).toFixed(2)} ج.م</span></p>
            </div>

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShiftModalOpen(false)}
                className="flex-1 border-slate-700 text-slate-300"
              >
                إلغاء
              </Button>
              <Button
                type="button"
                onClick={() => {
                  toast.success('تم إغلاق الوردية وطباعة تقرير التقفيل اليومي')
                  setShiftModalOpen(false)
                  router.push('/dashboard')
                }}
                className="flex-1 bg-rose-600 hover:bg-rose-700 text-white font-bold"
              >
                تأكيد وتقفيل الوردية
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Thermal Receipt Print Modal */}
      {lastSale && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-700 rounded-3xl p-6 w-full max-w-md shadow-2xl space-y-4 text-slate-900 dark:text-white" dir="rtl">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-base font-black flex items-center gap-2">
                <Printer className="w-5 h-5 text-emerald-500" />
                طباعة الفاتورة الحرارية (80mm)
              </h3>
              <button
                type="button"
                onClick={() => setLastSale(null)}
                className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="max-h-96 overflow-y-auto p-4 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800">
              <ThermalReceipt
                storeName={storeName || 'المتجر الرئيسي'}
                invoiceNumber={lastSale.invoice_number}
                date={lastSale.sale_date}
                customerName={lastSale.customer_name}
                items={lastSale.lines || []}
                subtotal={lastSale.subtotal}
                discount={lastSale.discount_total}
                tax={lastSale.tax_total || 0}
                total={lastSale.total}
                paid={lastSale.paid_amount}
                change={lastSale.change_amount || 0}
              />
            </div>

            <div className="flex gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <Button
                variant="outline"
                onClick={() => setLastSale(null)}
                className="flex-1 rounded-xl text-xs font-bold"
              >
                إغلاق
              </Button>
              <Button
                onClick={() => {
                  window.print()
                }}
                className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black gap-1.5 shadow-md shadow-emerald-600/30"
              >
                <Printer className="w-4 h-4" />
                طباعة الفاتورة (Enter)
              </Button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
