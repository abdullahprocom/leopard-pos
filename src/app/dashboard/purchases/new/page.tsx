'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/lib/db'
import { generatePurchaseNumber } from '@/lib/finance'
import { syncEngine } from '@/lib/sync-engine'
import { toast } from 'sonner'
import { Plus, Trash, Save, Search, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { Purchase, PurchaseLine, PaymentStatus, PaymentMethod } from '@/lib/types'

interface FormPurchaseLine {
  id: string
  item_id: string
  item_name: string
  quantity: number
  buy_price: number
  sell_price: number
  discount: number
  net_total: number
}

export default function NewPurchasePage() {
  const router = useRouter()
  const [supplierName, setSupplierName] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [lines, setLines] = useState<FormPurchaseLine[]>([])
  const [paidAmount, setPaidAmount] = useState<number>(0)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const items = useLiveQuery(async () => {
    if (searchTerm.length < 1) return []
    const q = searchTerm.toLowerCase()
    return await db.items
      .filter(item => (item.search_text || item.name || '').toLowerCase().includes(q))
      .limit(10)
      .toArray()
  }, [searchTerm]) || []

  const handleAddItem = (item: any) => {
    const existingLine = lines.find(l => l.item_id === item.id)
    if (existingLine) {
      updateLine(existingLine.id, 'quantity', existingLine.quantity + 1)
    } else {
      const newLine: FormPurchaseLine = {
        id: crypto.randomUUID(),
        item_id: item.id,
        item_name: item.name,
        quantity: 1,
        buy_price: item.buy_price || 0,
        sell_price: item.sell_price || 0,
        discount: 0,
        net_total: item.buy_price || 0,
      }
      setLines([...lines, newLine])
    }
    setSearchTerm('')
  }

  const updateLine = (id: string, field: keyof FormPurchaseLine, value: number) => {
    setLines(lines.map(line => {
      if (line.id === id) {
        const updated = { ...line, [field]: value }
        updated.net_total = Math.max((updated.quantity * updated.buy_price) - updated.discount, 0)
        return updated
      }
      return line
    }))
  }

  const removeLine = (id: string) => {
    setLines(lines.filter(l => l.id !== id))
  }

  const subtotal = lines.reduce((sum, line) => sum + (line.quantity * line.buy_price), 0)
  const totalDiscount = lines.reduce((sum, line) => sum + line.discount, 0)
  const totalAmount = Math.max(subtotal - totalDiscount, 0)
  const dueAmount = Math.max(totalAmount - paidAmount, 0)

  const handleSave = async () => {
    if (lines.length === 0) {
      toast.error('الرجاء إضافة أصناف للفاتورة')
      return
    }

    try {
      setIsSubmitting(true)
      const purchaseId = crypto.randomUUID()
      const now = new Date().toISOString()
      const purchaseNumber = generatePurchaseNumber()
      const storeId = 'default'
      const branchId = 'default'

      let paymentStatus: PaymentStatus = 'unpaid'
      if (paidAmount >= totalAmount && totalAmount > 0) paymentStatus = 'paid'
      else if (paidAmount > 0) paymentStatus = 'partial'

      const purchase: Purchase = {
        id: purchaseId,
        store_id: storeId,
        branch_id: branchId,
        supplier_id: undefined,
        purchase_number: purchaseNumber,
        supplier_name: supplierName.trim() || 'مورد عام',
        status: 'received',
        payment_status: paymentStatus,
        payment_method: paymentMethod,
        subtotal,
        discount_total: totalDiscount,
        tax_total: 0,
        total: totalAmount,
        paid_amount: paidAmount,
        due_amount: dueAmount,
        purchase_date: now,
        notes: '',
        created_at: now,
        updated_at: now,
      }

      await db.transaction('rw', [db.purchases, db.purchase_lines, db.items, db.stock_balances, db.stock_ledger, db.cash_transactions, db.sync_queue], async () => {
        // 1. Save purchase
        await db.purchases.add(purchase)
        syncEngine.enqueueOperation('purchases', 'INSERT', purchase)

        // 2. Save lines & update stock/items
        for (const line of lines) {
          const purchaseLine: PurchaseLine = {
            id: crypto.randomUUID(),
            store_id: storeId,
            purchase_id: purchaseId,
            item_id: line.item_id,
            quantity: line.quantity,
            buy_price: line.buy_price,
            sell_price: line.sell_price,
            discount: line.discount,
            net_total: line.net_total,
          }
          await db.purchase_lines.add(purchaseLine)
          syncEngine.enqueueOperation('purchase_lines', 'INSERT', purchaseLine)

          // Update item prices
          await db.items.update(line.item_id, {
            buy_price: line.buy_price,
            sell_price: line.sell_price,
            updated_at: now,
          })

          // Adjust stock balance
          const stock = await db.stock_balances.where({ store_id: storeId, item_id: line.item_id, branch_id: branchId }).first()
          if (stock) {
            await db.stock_balances.where({ store_id: storeId, item_id: line.item_id, branch_id: branchId }).modify({
              quantity: stock.quantity + line.quantity,
              updated_at: now,
            })
          } else {
            await db.stock_balances.add({
              store_id: storeId,
              item_id: line.item_id,
              branch_id: branchId,
              quantity: line.quantity,
              updated_at: now,
            })
          }

          // Stock ledger
          const ledger = {
            id: crypto.randomUUID(),
            store_id: storeId,
            item_id: line.item_id,
            branch_id: branchId,
            movement_type: 'purchase' as const,
            direction: 'in' as const,
            quantity: line.quantity,
            unit_price: line.buy_price,
            total: line.net_total,
            source_table: 'purchases',
            source_id: purchaseId,
            notes: `فاتورة شراء رقم ${purchaseNumber}`,
            created_at: now,
          }
          await db.stock_ledger.add(ledger)
          syncEngine.enqueueOperation('stock_ledger', 'INSERT', ledger)
        }

        // 3. Cash transaction if paid
        if (paidAmount > 0) {
          const cashTx = {
            id: crypto.randomUUID(),
            store_id: storeId,
            branch_id: branchId,
            transaction_type: 'purchase-payment',
            direction: 'out' as const,
            amount: paidAmount,
            payment_method: paymentMethod,
            account_name: 'الصندوق الرئيسي',
            source_table: 'purchases',
            source_id: purchaseId,
            notes: `دفعة لفاتورة مشتريات رقم ${purchaseNumber}`,
            created_at: now,
          }
          await db.cash_transactions.add(cashTx)
          syncEngine.enqueueOperation('cash_transactions', 'INSERT', cashTx)
        }
      })

      toast.success('تم حفظ فاتورة المشتريات وتحديث المخزون بنجاح')
      router.push('/dashboard/purchases')
      router.refresh()
    } catch (error: any) {
      console.error(error)
      toast.error('حدث خطأ أثناء حفظ الفاتورة: ' + error.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-6 pb-20" dir="rtl">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push('/dashboard/purchases')} className="h-10 w-10 shrink-0">
            <ArrowRight className="h-6 w-6" />
          </Button>
          <h1 className="text-3xl font-bold tracking-tight">فاتورة مشتريات جديدة</h1>
        </div>
        <Button onClick={handleSave} size="lg" disabled={isSubmitting} className="gap-2 font-bold px-8 h-12">
          <Save className="h-5 w-5" />
          {isSubmitting ? 'جاري الحفظ...' : 'حفظ الفاتورة'}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>تفاصيل الفاتورة</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>المورد</Label>
                <Input 
                  placeholder="اسم المورد..." 
                  value={supplierName}
                  onChange={(e) => setSupplierName(e.target.value)}
                  className="h-12 text-base"
                />
              </div>
              <div className="space-y-2">
                <Label>بحث عن صنف لإضافته</Label>
                <div className="relative">
                  <Search className="absolute right-3.5 top-3.5 h-5 w-5 text-muted-foreground" />
                  <Input 
                    placeholder="ابحث بالاسم أو الباركود..." 
                    className="pr-11 h-12 text-base"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                  {items && items.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-background border rounded-md shadow-lg max-h-60 overflow-auto">
                      {items.map(item => (
                        <div 
                          key={item.id} 
                          className="p-3 hover:bg-muted cursor-pointer flex justify-between border-b last:border-0"
                          onClick={() => handleAddItem(item)}
                        >
                          <span className="font-bold">{item.name}</span>
                          <span className="text-muted-foreground font-mono">{item.sku || `${item.buy_price} ج.م`}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="border rounded-md overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>الصنف</TableHead>
                    <TableHead className="w-28">الكمية</TableHead>
                    <TableHead className="w-32">سعر الشراء</TableHead>
                    <TableHead className="w-32">سعر البيع</TableHead>
                    <TableHead className="w-28">الخصم</TableHead>
                    <TableHead className="w-32">الصافي</TableHead>
                    <TableHead className="w-16"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lines.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center h-32 text-muted-foreground text-base">
                        لم يتم إضافة أصناف بعد - ابحث لإضافة منتجات للفاتورة
                      </TableCell>
                    </TableRow>
                  ) : (
                    lines.map((line) => (
                      <TableRow key={line.id}>
                        <TableCell className="font-bold text-base">{line.item_name}</TableCell>
                        <TableCell>
                          <Input 
                            type="number" 
                            min="1" 
                            value={line.quantity}
                            onChange={(e) => updateLine(line.id, 'quantity', parseFloat(e.target.value) || 0)}
                            className="h-10 text-center font-bold"
                          />
                        </TableCell>
                        <TableCell>
                          <Input 
                            type="number" 
                            min="0" 
                            step="0.01"
                            value={line.buy_price}
                            onChange={(e) => updateLine(line.id, 'buy_price', parseFloat(e.target.value) || 0)}
                            className="h-10 font-semibold"
                          />
                        </TableCell>
                        <TableCell>
                          <Input 
                            type="number" 
                            min="0" 
                            step="0.01"
                            value={line.sell_price}
                            onChange={(e) => updateLine(line.id, 'sell_price', parseFloat(e.target.value) || 0)}
                            className="h-10 font-semibold"
                          />
                        </TableCell>
                        <TableCell>
                          <Input 
                            type="number" 
                            min="0" 
                            value={line.discount}
                            onChange={(e) => updateLine(line.id, 'discount', parseFloat(e.target.value) || 0)}
                            className="h-10 font-semibold"
                          />
                        </TableCell>
                        <TableCell className="font-black text-primary text-base">{line.net_total.toFixed(2)}</TableCell>
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

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>الملخص المالي</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between text-base">
                <span className="text-muted-foreground">المجموع:</span>
                <span className="font-bold">{subtotal.toFixed(2)} ج.م</span>
              </div>
              <div className="flex justify-between text-base text-red-500">
                <span>الخصم:</span>
                <span className="font-bold">{totalDiscount.toFixed(2)} ج.م</span>
              </div>
              <div className="flex justify-between font-black text-xl border-t pt-4">
                <span>الإجمالي:</span>
                <span className="text-primary">{totalAmount.toFixed(2)} ج.م</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>الدفع</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>المبلغ المدفوع</Label>
                <Input 
                  type="number" 
                  min="0" 
                  max={totalAmount}
                  value={paidAmount}
                  onChange={(e) => setPaidAmount(parseFloat(e.target.value) || 0)}
                  className="h-12 text-xl font-bold"
                />
              </div>
              <div className="space-y-2">
                <Label>طريقة الدفع</Label>
                <Select value={paymentMethod} onValueChange={(v: any) => setPaymentMethod(v)}>
                  <SelectTrigger className="h-12">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">نقدي</SelectItem>
                    <SelectItem value="card">بطاقة</SelectItem>
                    <SelectItem value="bank-transfer">تحويل بنكي</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-between font-bold text-base border-t pt-4">
                <span>المتبقي:</span>
                <span className={dueAmount > 0 ? "text-red-500 font-black text-lg" : "text-green-500"}>
                  {dueAmount.toFixed(2)} ج.م
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
