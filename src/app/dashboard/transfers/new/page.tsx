'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/lib/db'
import { generateTransferNumber } from '@/lib/finance'
import { syncEngine, DEFAULT_STORE_UUID, DEFAULT_BRANCH_UUID } from '@/lib/sync-engine'
import { toast } from 'sonner'
import { Save, ArrowRight, Trash, Search, ArrowLeftRight } from 'lucide-react'
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

interface TransferLineItem {
  id: string
  item_id: string
  item_name: string
  quantity: number
  available_stock: number
}

const WAREHOUSE_BRANCH_UUID = '00000000-0000-0000-0000-000000000004'

export default function NewTransferPage() {
  const router = useRouter()
  const [fromBranchId, setFromBranchId] = useState(DEFAULT_BRANCH_UUID)
  const [toBranchId, setToBranchId] = useState(WAREHOUSE_BRANCH_UUID)
  const [notes, setNotes] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [lines, setLines] = useState<TransferLineItem[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Search items
  const searchResults = useLiveQuery(async () => {
    if (searchTerm.length < 1) return []
    const q = searchTerm.toLowerCase()
    return await db.items
      .filter(item => (item.search_text || item.name || '').toLowerCase().includes(q))
      .limit(10)
      .toArray()
  }, [searchTerm]) || []

  const handleAddItem = async (item: any) => {
    const existing = lines.find(l => l.item_id === item.id)
    if (existing) {
      setLines(lines.map(l => l.item_id === item.id ? { ...l, quantity: l.quantity + 1 } : l))
    } else {
      const stock = await db.stock_balances.where({ item_id: item.id, branch_id: fromBranchId }).first()
      const available = stock?.quantity || 0

      setLines([...lines, {
        id: crypto.randomUUID(),
        item_id: item.id,
        item_name: item.name,
        quantity: 1,
        available_stock: available,
      }])
    }
    setSearchTerm('')
  }

  const removeLine = (id: string) => {
    setLines(lines.filter(l => l.id !== id))
  }

  const handleSaveTransfer = async () => {
    if (lines.length === 0) {
      toast.error('يرجى إضافة أصناف للتحويل')
      return
    }

    if (fromBranchId === toBranchId) {
      toast.error('لا يمكن التحويل لنفس الفرع')
      return
    }

    try {
      setIsSubmitting(true)
      const transferId = crypto.randomUUID()
      const now = new Date().toISOString()
      const transferNumber = generateTransferNumber()
      const storeId = DEFAULT_STORE_UUID

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

          // Deduct from source branch
          const fromStock = await db.stock_balances.where({ store_id: storeId, item_id: line.item_id, branch_id: fromBranchId }).first()
          if (fromStock) {
            await db.stock_balances.where({ store_id: storeId, item_id: line.item_id, branch_id: fromBranchId }).modify({
              quantity: Math.max(fromStock.quantity - line.quantity, 0),
              updated_at: now,
            })
          }

          // Ledger out from source
          const ledgerOut = {
            id: crypto.randomUUID(),
            store_id: storeId,
            item_id: line.item_id,
            branch_id: fromBranchId,
            movement_type: 'transfer' as const,
            direction: 'out' as const,
            quantity: line.quantity,
            unit_price: 0,
            total: 0,
            source_table: 'stock_transfers',
            source_id: transferId,
            notes: `تحويل صادر برقم ${transferNumber}`,
            created_at: now,
          }
          await db.stock_ledger.add(ledgerOut)
          syncEngine.enqueueOperation('stock_ledger', 'INSERT', ledgerOut)

          // Add to target branch
          const toStock = await db.stock_balances.where({ store_id: storeId, item_id: line.item_id, branch_id: toBranchId }).first()
          if (toStock) {
            await db.stock_balances.where({ store_id: storeId, item_id: line.item_id, branch_id: toBranchId }).modify({
              quantity: toStock.quantity + line.quantity,
              updated_at: now,
            })
          } else {
            await db.stock_balances.add({
              id: crypto.randomUUID(),
              store_id: storeId,
              item_id: line.item_id,
              branch_id: toBranchId,
              quantity: line.quantity,
              updated_at: now,
            })
          }

          // Ledger in to target
          const ledgerIn = {
            id: crypto.randomUUID(),
            store_id: storeId,
            item_id: line.item_id,
            branch_id: toBranchId,
            movement_type: 'transfer' as const,
            direction: 'in' as const,
            quantity: line.quantity,
            unit_price: 0,
            total: 0,
            source_table: 'stock_transfers',
            source_id: transferId,
            notes: `تحويل وارد برقم ${transferNumber}`,
            created_at: now,
          }
          await db.stock_ledger.add(ledgerIn)
          syncEngine.enqueueOperation('stock_ledger', 'INSERT', ledgerIn)
        }
      })

      toast.success(`تم تنفيذ التحويل المخزني رقم ${transferNumber} بنجاح`)
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
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white">تحويل ونقل مخزني</h1>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">نقل البضائع والأرصدة بين الفروع والمستودعات</p>
          </div>
        </div>
        <Button onClick={handleSaveTransfer} size="lg" disabled={isSubmitting} className="gap-2 font-black px-8 h-12 bg-cyan-600 hover:bg-cyan-700 active:bg-cyan-800 text-white rounded-xl shadow-md shadow-cyan-600/20 cursor-pointer">
          <Save className="h-5 w-5 ml-1" />
          {isSubmitting ? 'جاري التحويل...' : 'تنفيذ وترحيل التحويل'}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border-slate-200/90 dark:border-slate-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-slate-900 dark:text-white">من فرع / مخزن (المصدر)</CardTitle>
          </CardHeader>
          <CardContent>
            <Select value={fromBranchId} onValueChange={setFromBranchId}>
              <SelectTrigger className="h-12 text-sm font-bold bg-slate-50/80 dark:bg-slate-800/80 rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl shadow-xl dark:bg-slate-900 dark:border-slate-800">
                <SelectItem value={DEFAULT_BRANCH_UUID}>الفرع الرئيسي / صالة العرض</SelectItem>
                <SelectItem value={WAREHOUSE_BRANCH_UUID}>المستودع والمخزن المركزي</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <Card className="border-slate-200/90 dark:border-slate-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-slate-900 dark:text-white">إلى فرع / مخزن (الوجهة)</CardTitle>
          </CardHeader>
          <CardContent>
            <Select value={toBranchId} onValueChange={setToBranchId}>
              <SelectTrigger className="h-12 text-sm font-bold bg-slate-50/80 dark:bg-slate-800/80 rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl shadow-xl dark:bg-slate-900 dark:border-slate-800">
                <SelectItem value={WAREHOUSE_BRANCH_UUID}>المستودع والمخزن المركزي</SelectItem>
                <SelectItem value={DEFAULT_BRANCH_UUID}>الفرع الرئيسي / صالة العرض</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      </div>

      <Card className="border-slate-200/90 dark:border-slate-800 shadow-sm">
        <CardHeader>
          <CardTitle className="text-slate-900 dark:text-white">الأصناف المراد تحويلها</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          
          {/* Isolated Search Container with high z-index and solid popup */}
          <div className="relative max-w-lg z-30">
            <Search className="absolute right-3.5 top-3.5 h-5 w-5 text-slate-400" />
            <Input 
              placeholder="ابحث باسم الصنف أو امسح الباركود..." 
              className="pr-11 h-12 text-base font-bold bg-slate-50/80 dark:bg-slate-800/80 rounded-xl"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchResults && searchResults.length > 0 && (
              <div className="absolute top-full right-0 left-0 mt-2 z-50 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl max-h-60 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                {searchResults.map(item => (
                  <div 
                    key={item.id} 
                    className="p-3.5 hover:bg-blue-50 dark:hover:bg-slate-800 cursor-pointer flex justify-between items-center transition-colors"
                    onClick={() => handleAddItem(item)}
                  >
                    <span className="font-bold text-slate-900 dark:text-white text-sm">{item.name}</span>
                    <span className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-2.5 py-1 rounded-md font-mono font-bold">{item.sku || 'اختيار'}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Table Container */}
          <div className="border border-slate-200/90 dark:border-slate-800 rounded-xl overflow-hidden">
            <Table>
              <TableHeader>
                <tr className="border-b border-slate-200/90 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-xs font-black text-slate-500 dark:text-slate-400">
                  <th className="p-3.5 text-right">الصنف</th>
                  <th className="p-3.5 w-40 text-center">الكمية المحولة</th>
                  <th className="p-3.5 w-16 text-center">حذف</th>
                </tr>
              </TableHeader>
              <TableBody>
                {lines.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center h-28 text-slate-400 text-sm font-semibold">
                      لم يتم إضافة أصناف للتحويل بعد - ابحث واختر من القائمة أعلاه
                    </TableCell>
                  </TableRow>
                ) : (
                  lines.map(line => (
                    <TableRow key={line.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                      <TableCell className="font-bold text-base text-slate-900 dark:text-white">{line.item_name}</TableCell>
                      <TableCell className="text-center">
                        <Input 
                          type="number"
                          min="1"
                          className="w-28 h-10 font-bold font-mono text-center mx-auto bg-slate-50 dark:bg-slate-800 rounded-lg"
                          value={line.quantity}
                          onChange={(e) => {
                            const val = Math.max(1, parseInt(e.target.value) || 1)
                            setLines(lines.map(l => l.id === line.id ? { ...l, quantity: val } : l))
                          }}
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        <Button variant="ghost" size="icon" onClick={() => removeLine(line.id)} className="text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40">
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
