'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/lib/db'
import { generateStocktakingNumber } from '@/lib/finance'
import { syncEngine } from '@/lib/sync-engine'
import { toast } from 'sonner'
import { Save, ArrowRight, ClipboardCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

export default function NewStocktakingPage() {
  const router = useRouter()
  const [notes, setNotes] = useState('')
  const [actualCounts, setActualCounts] = useState<Record<string, number>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Fetch all items and current balances
  const itemsWithBalances = useLiveQuery(async () => {
    const items = await db.items.where('status').equals('active').toArray()
    const balances = await db.stock_balances.toArray()
    const balanceMap = new Map<string, number>()
    balances.forEach(b => balanceMap.set(b.item_id, (balanceMap.get(b.item_id) || 0) + b.quantity))

    return items.map(item => ({
      ...item,
      system_qty: balanceMap.get(item.id) || 0,
    }))
  }, []) || []

  const handleCountChange = (itemId: string, val: number) => {
    setActualCounts(prev => ({
      ...prev,
      [itemId]: val,
    }))
  }

  const handleSaveStocktaking = async () => {
    try {
      setIsSubmitting(true)
      const stocktakingId = crypto.randomUUID()
      const now = new Date().toISOString()
      const stocktakingNumber = generateStocktakingNumber()
      const storeId = 'default'
      const branchId = 'default'

      const stocktakingRecord = {
        id: stocktakingId,
        store_id: storeId,
        branch_id: branchId,
        stocktaking_number: stocktakingNumber,
        status: 'completed',
        notes: notes.trim(),
        created_at: now,
        completed_at: now,
      }

      await db.transaction('rw', [db.stocktaking, db.stocktaking_lines, db.stock_balances, db.stock_ledger, db.sync_queue], async () => {
        // 1. Save stocktaking header
        await db.stocktaking.add(stocktakingRecord)
        syncEngine.enqueueOperation('stocktaking', 'INSERT', stocktakingRecord)

        // 2. Save lines and adjust inventory
        for (const item of itemsWithBalances) {
          const actual = actualCounts[item.id] !== undefined ? actualCounts[item.id] : item.system_qty
          const diff = actual - item.system_qty

          const line = {
            id: crypto.randomUUID(),
            store_id: storeId,
            stocktaking_id: stocktakingId,
            item_id: item.id,
            system_qty: item.system_qty,
            actual_qty: actual,
            difference: diff,
          }
          await db.stocktaking_lines.add(line)
          syncEngine.enqueueOperation('stocktaking_lines', 'INSERT', line)

          if (diff !== 0) {
            // Update stock balance
            const balance = await db.stock_balances.where({ store_id: storeId, item_id: item.id, branch_id: branchId }).first()
            if (balance) {
              await db.stock_balances.where({ store_id: storeId, item_id: item.id, branch_id: branchId }).modify({
                quantity: actual,
                updated_at: now,
              })
            } else {
              await db.stock_balances.add({
                store_id: storeId,
                item_id: item.id,
                branch_id: branchId,
                quantity: actual,
                updated_at: now,
              })
            }

            // Record adjustment ledger entry
            const ledger = {
              id: crypto.randomUUID(),
              store_id: storeId,
              item_id: item.id,
              branch_id: branchId,
              movement_type: 'adjustment' as const,
              direction: (diff > 0 ? 'in' : 'out') as 'in' | 'out',
              quantity: Math.abs(diff),
              unit_price: item.buy_price || 0,
              total: Math.abs(diff) * (item.buy_price || 0),
              source_table: 'stocktaking',
              source_id: stocktakingId,
              notes: `تسوية جرد رقم ${stocktakingNumber} (${diff > 0 ? 'فائض' : 'عجز'})`,
              created_at: now,
            }
            await db.stock_ledger.add(ledger)
            syncEngine.enqueueOperation('stock_ledger', 'INSERT', ledger)
          }
        }
      })

      toast.success(`تم حفظ واعتماد الجرد رقم ${stocktakingNumber} وتسوية المخزون بنجاح`)
      router.push('/dashboard/stocktaking')
      router.refresh()
    } catch (error: any) {
      console.error(error)
      toast.error('حدث خطأ أثناء حفظ الجرد: ' + error.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-6 pb-20" dir="rtl">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push('/dashboard/stocktaking')} className="h-10 w-10 shrink-0">
            <ArrowRight className="h-6 w-6" />
          </Button>
          <h1 className="text-3xl font-bold tracking-tight">جلسة جرد وتسوية مخزون</h1>
        </div>
        <Button onClick={handleSaveStocktaking} size="lg" disabled={isSubmitting} className="gap-2 font-bold px-8 h-12 bg-emerald-600 hover:bg-emerald-700">
          <Save className="h-5 w-5 ml-1" />
          {isSubmitting ? 'جاري الاعتماد...' : 'اعتماد وتسوية الجرد'}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>ملاحظات الجرد</CardTitle>
        </CardHeader>
        <CardContent>
          <Input 
            placeholder="اكتب أي ملاحظات حول جلسة الجرد (اختياري)..." 
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="h-12 text-base"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>جدول حصر الكميات الفعلية</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="border rounded-md overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>اسم الصنف</TableHead>
                  <TableHead>الباركود / SKU</TableHead>
                  <TableHead className="w-36 text-center">الرصيد الدفتري</TableHead>
                  <TableHead className="w-44 text-center">الرصيد الفعلي (العد)</TableHead>
                  <TableHead className="w-36 text-center">الفارق (التسوية)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {itemsWithBalances.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center h-24 text-muted-foreground">
                      لا توجد أصناف نشطة للجرد
                    </TableCell>
                  </TableRow>
                ) : (
                  itemsWithBalances.map(item => {
                    const counted = actualCounts[item.id] !== undefined ? actualCounts[item.id] : item.system_qty
                    const diff = counted - item.system_qty

                    return (
                      <TableRow key={item.id}>
                        <TableCell className="font-bold text-base">{item.name}</TableCell>
                        <TableCell className="font-mono text-muted-foreground">{item.sku || '-'}</TableCell>
                        <TableCell className="text-center font-bold">{item.system_qty} {item.unit}</TableCell>
                        <TableCell className="text-center">
                          <Input 
                            type="number"
                            min="0"
                            className="w-32 h-10 font-black text-center mx-auto"
                            value={actualCounts[item.id] !== undefined ? actualCounts[item.id] : item.system_qty}
                            onChange={(e) => handleCountChange(item.id, parseFloat(e.target.value) || 0)}
                          />
                        </TableCell>
                        <TableCell className="text-center font-black">
                          {diff === 0 ? (
                            <span className="text-muted-foreground">0</span>
                          ) : diff > 0 ? (
                            <span className="text-emerald-600">+{diff} (فائض)</span>
                          ) : (
                            <span className="text-destructive">{diff} (عجز)</span>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
