'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/lib/db'
import { generateTransferNumber } from '@/lib/finance'
import { syncEngine, DEFAULT_STORE_UUID, DEFAULT_BRANCH_UUID } from '@/lib/sync-engine'
import { toast } from 'sonner'
import { Save, ArrowRight, Trash, Search, ArrowLeftRight, AlertTriangle, Building2, Package } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useStore } from '@/lib/store-context'
import type { StockLedgerEntry } from '@/lib/types'

interface TransferLineItem {
  id: string
  item_id: string
  item_name: string
  quantity: number
  available_stock: number
  unit: string
}

const WAREHOUSE_BRANCH_UUID = '00000000-0000-0000-0000-000000000004'

export default function NewTransferPage() {
  const router = useRouter()
  const { storeId, branchId } = useStore()
  const currentStoreId = storeId || DEFAULT_STORE_UUID
  const currentBranchId = branchId || DEFAULT_BRANCH_UUID

  const [fromBranchId, setFromBranchId] = useState(currentBranchId)
  const [toBranchId, setToBranchId] = useState(WAREHOUSE_BRANCH_UUID)
  const [notes, setNotes] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [lines, setLines] = useState<TransferLineItem[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Live Query for stock balances in current store
  const allStockBalances = useLiveQuery(
    () => db.stock_balances.where('store_id').equals(currentStoreId).toArray(),
    [currentStoreId]
  ) || []

  // Stock Map for fromBranch
  const fromStockMap = useMemo(() => {
    const map = new Map<string, number>()
    allStockBalances.forEach(sb => {
      // If branch_id matches or is unassigned
      if (!sb.branch_id || sb.branch_id === fromBranchId) {
        map.set(sb.item_id, (map.get(sb.item_id) || 0) + (sb.quantity || 0))
      }
    })
    return map
  }, [allStockBalances, fromBranchId])

  // Search items strictly for current store
  const searchResults = useLiveQuery(async () => {
    if (searchTerm.length < 1) return []
    const q = searchTerm.toLowerCase()
    return await db.items
      .where('store_id').equals(currentStoreId)
      .filter(item => (item.search_text || item.name || '').toLowerCase().includes(q))
      .limit(10)
      .toArray()
  }, [searchTerm, currentStoreId]) || []

  const handleAddItem = (item: any) => {
    const available = fromStockMap.get(item.id) ?? 0

    if (item.manage_inventory !== false && available <= 0) {
      toast.error(`🚫 لا يمكن نقل (${item.name}): رصيد الصنف صفر في فرع المصدر`)
      return
    }

    const existing = lines.find(l => l.item_id === item.id)
    if (existing) {
      if (item.manage_inventory !== false && existing.quantity + 1 > available) {
        toast.error(`🚫 لا يمكن زيادة الكمية: تم الوصول للحد الأقصى المتوفر في فرع المصدر (${available})`)
        return
      }
      setLines(lines.map(l => l.item_id === item.id ? { ...l, quantity: l.quantity + 1 } : l))
    } else {
      setLines([...lines, {
        id: crypto.randomUUID(),
        item_id: item.id,
        item_name: item.name,
        quantity: 1,
        available_stock: available,
        unit: item.unit || 'قطعة'
      }])
    }
    setSearchTerm('')
    toast.success(`تمت إضافة: ${item.name}`)
  }

  const handleQuantityChange = (lineId: string, rawVal: string) => {
    const val = parseInt(rawVal) || 0
    setLines(prev => prev.map(line => {
      if (line.id === lineId) {
        if (val <= 0) return { ...line, quantity: 1 }
        if (val > line.available_stock) {
          toast.error(`🚫 الكمية المطلوبة تتجاوز الرصيد المتوفر في فرع المصدر (${line.available_stock} ${line.unit})`)
          return { ...line, quantity: Math.max(1, line.available_stock) }
        }
        return { ...line, quantity: val }
      }
      return line
    }))
  }

  const removeLine = (id: string) => {
    setLines(lines.filter(l => l.id !== id))
    toast.info('تم حذف السطر من التحويل')
  }

  const handleSaveTransfer = async () => {
    if (lines.length === 0) {
      toast.error('يرجى إضافة أصناف للتحويل')
      return
    }

    if (fromBranchId === toBranchId) {
      toast.error('لا يمكن التحويل لنفس الفرع! يرجى اختيار فرع مصدر وفرع وجهة مختلفين')
      return
    }

    // Strict validation: check all lines against available stock
    for (const line of lines) {
      const currentAvailable = fromStockMap.get(line.item_id) ?? 0
      if (line.quantity > currentAvailable) {
        toast.error(`🚫 خطأ مخزني: الصنف (${line.item_name}) الكمية المراد نقلها (${line.quantity}) تتجاوز الرصيد المتوفر بالمصدر (${currentAvailable})`)
        return
      }
    }

    try {
      setIsSubmitting(true)
      const transferId = crypto.randomUUID()
      const now = new Date().toISOString()
      const transferNumber = generateTransferNumber()
      const storeId = currentStoreId

      const transferRecord = {
        id: transferId,
        store_id: storeId,
        from_branch_id: fromBranchId,
        to_branch_id: toBranchId,
        transfer_number: transferNumber,
        status: 'completed' as const,
        notes: notes.trim(),
        created_at: now,
        completed_at: now,
      }

      await db.transaction('rw', [db.stock_transfers, db.stock_transfer_lines, db.stock_balances, db.stock_ledger, db.sync_queue], async () => {
        // 1. Save transfer header
        await db.stock_transfers.add(transferRecord)
        syncEngine.enqueueOperation('stock_transfers', 'INSERT', transferRecord)

        // 2. Save lines and adjust inventory in both branches
        for (const line of lines) {
          const transferLine = {
            id: crypto.randomUUID(),
            store_id: storeId,
            transfer_id: transferId,
            item_id: line.item_id,
            quantity: line.quantity,
          }
          await db.stock_transfer_lines.add(transferLine)
          syncEngine.enqueueOperation('stock_transfer_lines', 'INSERT', transferLine)

          // 2a. Deduct from Source Branch in stock_balances
          const fromStock = await db.stock_balances
            .where('item_id')
            .equals(line.item_id)
            .first()

          if (fromStock && fromStock.id) {
            const updatedQty = Math.max(0, fromStock.quantity - line.quantity)
            await db.stock_balances.update(fromStock.id, {
              quantity: updatedQty,
              updated_at: now,
            })
            syncEngine.enqueueOperation('stock_balances', 'UPDATE', { ...fromStock, quantity: updatedQty, updated_at: now })
          }

          // 2b. Add to Destination Branch in stock_balances
          const toStock = await db.stock_balances
            .where('item_id')
            .equals(line.item_id)
            .filter(sb => sb.branch_id === toBranchId)
            .first()

          if (toStock && toStock.id) {
            const updatedToQty = toStock.quantity + line.quantity
            await db.stock_balances.update(toStock.id, {
              quantity: updatedToQty,
              updated_at: now,
            })
            syncEngine.enqueueOperation('stock_balances', 'UPDATE', { ...toStock, quantity: updatedToQty, updated_at: now })
          } else {
            const newToSb = {
              id: crypto.randomUUID(),
              store_id: storeId,
              branch_id: toBranchId,
              item_id: line.item_id,
              quantity: line.quantity,
              updated_at: now
            }
            await db.stock_balances.add(newToSb)
            syncEngine.enqueueOperation('stock_balances', 'INSERT', newToSb)
          }

          // 2c. Stock Ledger: Out from Source
          const ledgerOut: StockLedgerEntry = {
            id: crypto.randomUUID(),
            store_id: storeId,
            branch_id: fromBranchId,
            item_id: line.item_id,
            movement_type: 'transfer',
            direction: 'out',
            quantity: line.quantity,
            unit_price: 0,
            total: 0,
            source_table: 'stock_transfers',
            source_id: transferId,
            notes: `تحويل مخزني صادر رقم ${transferNumber} إلى (${toBranchId === WAREHOUSE_BRANCH_UUID ? 'المستودع المركزي' : 'الفرع الرئيسي'})`,
            created_at: now,
          }
          await db.stock_ledger.add(ledgerOut)
          syncEngine.enqueueOperation('stock_ledger', 'INSERT', ledgerOut)

          // 2d. Stock Ledger: In to Destination
          const ledgerIn: StockLedgerEntry = {
            id: crypto.randomUUID(),
            store_id: storeId,
            branch_id: toBranchId,
            item_id: line.item_id,
            movement_type: 'transfer',
            direction: 'in',
            quantity: line.quantity,
            unit_price: 0,
            total: 0,
            source_table: 'stock_transfers',
            source_id: transferId,
            notes: `تحويل مخزني وارد رقم ${transferNumber} من (${fromBranchId === currentBranchId ? 'الفرع الرئيسي' : 'المستودع المركزي'})`,
            created_at: now,
          }
          await db.stock_ledger.add(ledgerIn)
          syncEngine.enqueueOperation('stock_ledger', 'INSERT', ledgerIn)
        }
      })

      toast.success(`تم حفظ وترحيل التحويل المخزني ${transferNumber} وخصم الرصيد بنجاح`)
      router.push('/dashboard/transfers')
      router.refresh()
    } catch (error: any) {
      console.error(error)
      toast.error('حدث خطأ أثناء حفظ التحويل: ' + error.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-6 pb-28 select-none" dir="rtl">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.push('/dashboard/transfers')} className="h-10 w-10 shrink-0">
            <ArrowRight className="h-6 w-6" />
          </Button>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
              <ArrowLeftRight className="w-7 h-7 text-cyan-600 dark:text-cyan-400" />
              تحويل ونقل مخزني بين الفروع
            </h1>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">نقل البضائع والأرصدة مع خصم وإضافة رصيد المخزن تلقائياً</p>
          </div>
        </div>
        <Button onClick={handleSaveTransfer} size="lg" disabled={isSubmitting} className="gap-2 font-black px-8 h-12 bg-cyan-600 hover:bg-cyan-700 active:bg-cyan-800 text-white rounded-xl shadow-md shadow-cyan-600/20 cursor-pointer">
          <Save className="h-5 w-5 ml-1" />
          {isSubmitting ? 'جاري التحويل...' : 'تنفيذ وترحيل التحويل'}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border-slate-200/90 dark:border-slate-800 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
              <Building2 className="w-4 h-4 text-amber-500" />
              من فرع / مخزن (المصدر - الذي سيُخصم منه)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Select value={fromBranchId} onValueChange={setFromBranchId}>
              <SelectTrigger className="h-12 text-sm font-bold bg-slate-50/80 dark:bg-slate-800/80 rounded-xl">
                <SelectValue placeholder="اختر الفرع المصدر">
                  {fromBranchId === WAREHOUSE_BRANCH_UUID ? 'المستودع والمخزن المركزي' : 'الفرع الرئيسي / صالة البيع'}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="rounded-xl shadow-xl dark:bg-slate-900 dark:border-slate-800">
                <SelectItem value={currentBranchId}>الفرع الرئيسي / صالة البيع</SelectItem>
                <SelectItem value={WAREHOUSE_BRANCH_UUID}>المستودع والمخزن المركزي</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <Card className="border-slate-200/90 dark:border-slate-800 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
              <Building2 className="w-4 h-4 text-emerald-500" />
              إلى فرع / مخزن (الوجهة - الذي سيُضاف إليه)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Select value={toBranchId} onValueChange={setToBranchId}>
              <SelectTrigger className="h-12 text-sm font-bold bg-slate-50/80 dark:bg-slate-800/80 rounded-xl">
                <SelectValue placeholder="اختر الفرع الوجهة">
                  {toBranchId === currentBranchId ? 'الفرع الرئيسي / صالة البيع' : 'المستودع والمخزن المركزي'}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="rounded-xl shadow-xl dark:bg-slate-900 dark:border-slate-800">
                <SelectItem value={WAREHOUSE_BRANCH_UUID}>المستودع والمخزن المركزي</SelectItem>
                <SelectItem value={currentBranchId}>الفرع الرئيسي / صالة البيع</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      </div>

      <Card className="border-slate-200/90 dark:border-slate-800 shadow-sm">
        <CardHeader>
          <CardTitle className="text-slate-900 dark:text-white flex items-center gap-2">
            <Package className="w-5 h-5 text-blue-500" />
            الأصناف المراد تحويلها مع فحص الرصيد المتاح
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          
          {/* Isolated Search Container with high z-index and solid popup */}
          <div className="relative max-w-lg z-30">
            <Search className="absolute right-3.5 top-3.5 h-5 w-5 text-slate-400" />
            <Input 
              placeholder="ابحث باسم الصنف أو امسح الباركود لإضافته للتحويل..." 
              className="pr-11 h-12 text-sm font-bold bg-slate-50/80 dark:bg-slate-800/80 rounded-xl"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchResults && searchResults.length > 0 && (
              <div className="absolute top-full right-0 left-0 mt-2 z-50 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl max-h-60 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                {searchResults.map(item => {
                  const stock = fromStockMap.get(item.id) ?? 0
                  return (
                    <div 
                      key={item.id} 
                      className="p-3.5 hover:bg-blue-50 dark:hover:bg-slate-800 cursor-pointer flex justify-between items-center transition-colors"
                      onClick={() => handleAddItem(item)}
                    >
                      <div>
                        <p className="font-bold text-slate-900 dark:text-white text-sm">{item.name}</p>
                        <p className="text-xs text-slate-400 font-mono">الكود: {item.sku || '—'}</p>
                      </div>
                      <span className={`text-xs px-2.5 py-1 rounded-md font-bold ${
                        stock > 0 ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400' : 'bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400'
                      }`}>
                        المتاح بالمصدر: {stock} {item.unit || 'وحدة'}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Table Container */}
          <div className="border border-slate-200/90 dark:border-slate-800 rounded-xl overflow-hidden">
            <Table>
              <TableHeader>
                <tr className="border-b border-slate-200/90 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-xs font-black text-slate-500 dark:text-slate-400">
                  <th className="p-3.5 text-right">الصنف والرصيد المتاح بالمصدر</th>
                  <th className="p-3.5 w-44 text-center">الكمية المراد تحويلها</th>
                  <th className="p-3.5 w-16 text-center">حذف</th>
                </tr>
              </TableHeader>
              <TableBody>
                {lines.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center h-28 text-slate-400 text-sm font-semibold">
                      لم يتم إضافة أصناف للتحويل بعد — ابحث واختر من القائمة أعلاه
                    </TableCell>
                  </TableRow>
                ) : (
                  lines.map(line => (
                    <TableRow key={line.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                      <TableCell className="p-3.5">
                        <p className="font-bold text-sm sm:text-base text-slate-900 dark:text-white">{line.item_name}</p>
                        <span className="inline-block mt-0.5 text-[11px] font-bold px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/40">
                          الرصيد المتاح بالمصدر: {line.available_stock} {line.unit}
                        </span>
                      </TableCell>
                      <TableCell className="text-center p-3.5">
                        <div className="flex items-center justify-center gap-1">
                          <Input 
                            type="number"
                            min="1"
                            max={line.available_stock}
                            className="w-24 h-10 font-black font-mono text-center bg-slate-50 dark:bg-slate-800 rounded-lg text-sm"
                            value={line.quantity}
                            onChange={(e) => handleQuantityChange(line.id, e.target.value)}
                          />
                          <span className="text-xs text-slate-400 font-bold">{line.unit}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center p-3.5">
                        <Button variant="ghost" size="icon" onClick={() => removeLine(line.id)} className="text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer">
                          <Trash className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
