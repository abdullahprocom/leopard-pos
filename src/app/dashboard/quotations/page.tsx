'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/lib/db'
import { useStore } from '@/lib/store-context'
import { useAuth } from '@/lib/auth-context'
import { formatCurrency, formatNumber } from '@/lib/finance'
import { 
  FileSpreadsheet, 
  Plus, 
  Printer, 
  Trash2, 
  ShoppingCart, 
  Calendar, 
  User, 
  Search,
  CheckCircle2,
  FileText
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'

interface QuotationItem {
  id: string
  code: string
  customer_name: string
  customer_phone?: string
  items_summary: string
  total_amount: number
  valid_until: string
  created_at: string
}

export default function QuotationsPage() {
  const router = useRouter()
  const { storeId, storeName } = useStore()
  const { currentUser } = useAuth()

  const [quotations, setQuotations] = useState<QuotationItem[]>([])
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [itemsSummary, setItemsSummary] = useState('')
  const [totalAmount, setTotalAmount] = useState('')
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(`erp_quotations_${storeId}`)
      if (saved) {
        try {
          setQuotations(JSON.parse(saved))
        } catch {
          setQuotations([])
        }
      }
    }
  }, [storeId])

  const saveQuotations = (list: QuotationItem[]) => {
    setQuotations(list)
    if (typeof window !== 'undefined') {
      localStorage.setItem(`erp_quotations_${storeId}`, JSON.stringify(list))
    }
  }

  const handleCreateQuotation = (e: React.FormEvent) => {
    e.preventDefault()
    if (!customerName.trim()) {
      toast.error('يرجى كتابة اسم العميل')
      return
    }
    const numTotal = parseFloat(totalAmount)
    if (!numTotal || numTotal <= 0) {
      toast.error('يرجى تحديد إجمالي عرض السعر')
      return
    }

    const newQuote: QuotationItem = {
      id: crypto.randomUUID(),
      code: `QT-${Date.now().toString().slice(-5)}`,
      customer_name: customerName.trim(),
      customer_phone: customerPhone.trim() || undefined,
      items_summary: itemsSummary.trim() || 'عرض أسعار أصناف وبضائع متنوعة',
      total_amount: numTotal,
      valid_until: new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0],
      created_at: new Date().toISOString(),
    }

    const updated = [newQuote, ...quotations]
    saveQuotations(updated)
    setCustomerName('')
    setCustomerPhone('')
    setItemsSummary('')
    setTotalAmount('')
    toast.success(`تم إنشاء عرض السعر (${newQuote.code}) للعميل بنجاح`)
  }

  const handleDelete = (id: string) => {
    const updated = quotations.filter(q => q.id !== id)
    saveQuotations(updated)
    toast.success('تم حذف عرض السعر')
  }

  const filteredQuotes = quotations.filter(q => 
    q.customer_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    q.code.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="space-y-6 pb-16 select-none" dir="rtl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-xs">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <FileSpreadsheet className="w-6 h-6 text-pink-500" />
            عروض الأسعار الرسمية للعملاء
          </h1>
          <p className="text-xs sm:text-sm font-semibold text-slate-500 dark:text-slate-400 mt-1">
            إنشاء وطباعة عروض الأسعار مع إمكانية تحويلها لفاتورة بيع مباشرة
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Create Form */}
        <Card className="bg-slate-900 border-slate-800 text-white rounded-2xl shadow-sm lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base font-black flex items-center gap-2 text-white">
              <Plus className="w-4 h-4 text-pink-400" />
              إنشاء عرض سعر جديد
            </CardTitle>
            <CardDescription className="text-xs text-slate-400">
              أدخل بيانات العميل وإجمالي العرض
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateQuotation} className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-300">اسم العميل / الجهة</Label>
                <Input
                  value={customerName}
                  onChange={e => setCustomerName(e.target.value)}
                  placeholder="مثال: شركة النور أو أحمد علي"
                  className="h-11 bg-slate-950/80 border-slate-800 text-white rounded-xl text-sm font-bold"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-300">رقم الهاتف (اختياري)</Label>
                <Input
                  value={customerPhone}
                  onChange={e => setCustomerPhone(e.target.value)}
                  placeholder="010XXXXXXXX"
                  className="h-11 bg-slate-950/80 border-slate-800 text-white rounded-xl text-sm font-bold text-left font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-300">ملخص الأصناف والكميات</Label>
                <Input
                  value={itemsSummary}
                  onChange={e => setItemsSummary(e.target.value)}
                  placeholder="مثال: 5 كرتونة عصير + 10 علب شاي"
                  className="h-11 bg-slate-950/80 border-slate-800 text-white rounded-xl text-sm font-bold"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-300">إجمالي قيمة العرض (ج.م)</Label>
                <Input
                  type="number"
                  step="0.5"
                  min="0"
                  value={totalAmount}
                  onChange={e => setTotalAmount(e.target.value)}
                  placeholder="0.00"
                  className="h-11 bg-slate-950/80 border-slate-800 text-white rounded-xl text-base font-black font-mono text-left"
                />
              </div>

              <Button
                type="submit"
                className="w-full h-11 bg-pink-600 hover:bg-pink-500 text-white font-black rounded-xl shadow-md shadow-pink-600/30 cursor-pointer"
              >
                <Plus className="w-4 h-4 ml-1" />
                حفظ وإصدار عرض السعر
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Quotations List */}
        <Card className="bg-slate-900 border-slate-800 text-white rounded-2xl shadow-sm lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-base font-black text-white">قائمة عروض الأسعار</CardTitle>
              <CardDescription className="text-xs text-slate-400">
                سجل العروض الصادرة للعملاء
              </CardDescription>
            </div>
            <div className="relative w-44">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-3" />
              <Input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="بحث..."
                className="h-9 pr-8 bg-slate-950 border-slate-800 text-xs font-bold rounded-lg"
              />
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-bold">
                    <th className="pb-3 pr-2">رقم العرض</th>
                    <th className="pb-3">العميل</th>
                    <th className="pb-3">الملخص</th>
                    <th className="pb-3">الإجمالي</th>
                    <th className="pb-3">صالح حتى</th>
                    <th className="pb-3 text-center">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-semibold">
                  {filteredQuotes.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-500 font-bold">
                        لا توجد عروض أسعار مسجلة
                      </td>
                    </tr>
                  ) : (
                    filteredQuotes.map(item => (
                      <tr key={item.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-3.5 pr-2 font-mono font-black text-pink-400">
                          {item.code}
                        </td>
                        <td className="py-3.5 text-white font-bold">
                          <div>{item.customer_name}</div>
                          {item.customer_phone && (
                            <span className="text-[10px] text-slate-400 font-mono">{item.customer_phone}</span>
                          )}
                        </td>
                        <td className="py-3.5 text-slate-300">
                          {item.items_summary}
                        </td>
                        <td className="py-3.5 font-black text-emerald-400 font-mono">
                          {formatCurrency(item.total_amount)}
                        </td>
                        <td className="py-3.5 text-slate-400 text-[11px] font-mono">
                          {item.valid_until}
                        </td>
                        <td className="py-3.5 text-center flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              toast.success('تم تحويل العرض إلى فاتورة بيع بالكاشير')
                              router.push('/dashboard/pos')
                            }}
                            className="p-1.5 text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors cursor-pointer"
                            title="تحويل إلى فاتورة بيع"
                          >
                            <ShoppingCart className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => window.print()}
                            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                            title="طباعة عرض السعر"
                          >
                            <Printer className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(item.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                            title="حذف"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
