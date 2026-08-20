'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/lib/db'
import { generateTransferNumber } from '@/lib/finance'
import { syncEngine } from '@/lib/sync-engine'
import { toast } from 'sonner'
import { Save, ArrowRight, Trash, Search } from 'lucide-react'
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

export default function NewTransferPage() {
  const router = useRouter()
  const [fromBranchId, setFromBranchId] = useState('branch-1')
  const [toBranchId, setToBranchId] = useState('branch-2')
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
      const storeId = 'default'

      const transferRecord = {
        id: transferId,
        store_id: storeId,
        from_branch_id: fromBranchId,
        to_branch_id: toBranchId,
        transfer_number: transferNumber,
        status: 'completed',
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
            notes: `تحويل صادر برقم ${transferNumber} إلى الفرع الثاني`,
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
            notes: `تحويل وارد برقم ${transferNumber} من الفرع الأول`,
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
    <div className="space-y-6 pb-20" dir="rtl">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push('/dashboard/transfers')} className="h-10 w-10 shrink-0">
            <ArrowRight className="h-6 w-6" />
          </Button>
          <h1 className="text-3xl font-bold tracking-tight">تحويل مخزني جديد</h1>
        </div>
        <Button onClick={handleSaveTransfer} size="lg" disabled={isSubmitting} className="gap-2 font-bold px-8 h-12 bg-cyan-600 hover:bg-cyan-700 text-white">
          <Save className="h-5 w-5 ml-1" />
          {isSubmitting ? 'جاري التحويل...' : 'تنفيذ التحويل المخزني'}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>من فرع / مخزن</CardTitle>
          </CardHeader>
          <CardContent>
            <Select value={fromBranchId} onValueChange={setFromBranchId}>
              <SelectTrigger className="h-12">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="branch-1">الفرع الرئيسي</SelectItem>
                <SelectItem value="branch-2">مخزن البضائع</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>إلى فرع / مخزن</CardTitle>
          </CardHeader>
          <CardContent>
            <Select value={toBranchId} onValueChange={setToBranchId}>
              <SelectTrigger className="h-12">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="branch-2">مخزن البضائع</SelectItem>
                <SelectItem value="branch-1">الفرع الرئيسي</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>الأصناف المراد تحويلها</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="relative max-w-md">
            <Search className="absolute right-3.5 top-3.5 h-5 w-5 text-muted-foreground" />
            <Input 
              placeholder="ابحث عن صنف لإضافته..." 
              className="pr-11 h-12 text-base"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchResults && searchResults.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-background border rounded-md shadow-lg max-h-60 overflow-auto">
                {searchResults.map(item => (
                  <div 
                    key={item.id} 
                    className="p-3 hover:bg-muted cursor-pointer flex justify-between border-b last:border-0"
                    onClick={() => handleAddItem(item)}
                  >
                    <span className="font-bold">{item.name}</span>
                    <span className="text-muted-foreground font-mono">{item.sku || 'إضافة'}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="border rounded-md overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>الصنف</TableHead>
                  <TableHead className="w-36 text-center">الكمية المحولة</TableHead>
                  <TableHead className="w-16"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lines.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center h-24 text-muted-foreground text-base">
                      لم يتم إضافة أصناف للتحويل بعد
                    </TableCell>
                  </TableRow>
                ) : (
                  lines.map(line => (
                    <TableRow key={line.id}>
                      <TableCell className="font-bold text-base">{line.item_name}</TableCell>
                      <TableCell className="text-center">
                        <Input 
                          type="number"
                          min="1"
                          className="w-28 h-10 font-bold text-center mx-auto"
                          value={line.quantity}
                          onChange={(e) => {
                            const val = Math.max(1, parseInt(e.target.value) || 1)
                            setLines(lines.map(l => l.id === line.id ? { ...l, quantity: val } : l))
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => removeLine(line.id)} className="text-destructive hover:bg-destructive/10">
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
