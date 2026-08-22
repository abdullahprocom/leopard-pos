'use client'

import React, { useState, useEffect } from 'react'
import { 
  DollarSign, 
  Plus, 
  Receipt, 
  Trash2, 
  Calendar, 
  TrendingDown, 
  Building, 
  Zap, 
  Users, 
  Wrench, 
  Coffee, 
  Layers,
  FileText,
  Filter
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatCurrency, formatNumber } from '@/lib/finance'
import { useStore } from '@/lib/store-context'
import { useAuth } from '@/lib/auth-context'
import { toast } from 'sonner'

interface ExpenseItem {
  id: string
  store_id: string
  category: string
  amount: number
  description: string
  payment_method: 'cash' | 'card'
  created_by: string
  created_at: string
}

const EXPENSE_CATEGORIES = [
  { id: 'rent', name: 'إيجار المنشأة والمخازن', icon: Building },
  { id: 'utilities', name: 'كهرباء، مياه، وإنترنت', icon: Zap },
  { id: 'salaries', name: 'مرتبات وسلف العاملين', icon: Users },
  { id: 'maintenance', name: 'صيانة ومعدات', icon: Wrench },
  { id: 'hospitality', name: 'بوفيه وضيافة ونظافة', icon: Coffee },
  { id: 'other', name: 'مصروفات ونثريات تشغيلية أخرى', icon: Layers },
]

export default function ExpensesPage() {
  const { storeId, storeName } = useStore()
  const { currentUser } = useAuth()

  const [expenses, setExpenses] = useState<ExpenseItem[]>([])
  const [category, setCategory] = useState('utilities')
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card'>('cash')
  const [filterCategory, setFilterCategory] = useState('all')

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(`erp_expenses_${storeId}`)
      if (saved) {
        try {
          setExpenses(JSON.parse(saved))
        } catch {
          setExpenses([])
        }
      }
    }
  }, [storeId])

  const saveExpensesList = (newList: ExpenseItem[]) => {
    setExpenses(newList)
    if (typeof window !== 'undefined') {
      localStorage.setItem(`erp_expenses_${storeId}`, JSON.stringify(newList))
    }
  }

  const handleAddExpense = (e: React.FormEvent) => {
    e.preventDefault()
    const numAmount = parseFloat(amount)
    if (!numAmount || numAmount <= 0) {
      toast.error('يرجى كتابة مبلغ مصروف صحيح')
      return
    }

    const catObj = EXPENSE_CATEGORIES.find(c => c.id === category)
    const newExpense: ExpenseItem = {
      id: crypto.randomUUID(),
      store_id: storeId,
      category: catObj?.name || 'مصروف عام',
      amount: numAmount,
      description: description.trim() || catObj?.name || 'سند صرف مصروفات',
      payment_method: paymentMethod,
      created_by: currentUser?.name || 'المدير',
      created_at: new Date().toISOString(),
    }

    const updated = [newExpense, ...expenses]
    saveExpensesList(updated)
    setAmount('')
    setDescription('')
    toast.success(`تم تسجيل سند صرف بقيمة ${formatCurrency(numAmount)} بنجاح`)
  }

  const handleDeleteExpense = (id: string) => {
    const updated = expenses.filter(item => item.id !== id)
    saveExpensesList(updated)
    toast.success('تم حذف سند الصرف')
  }

  // Calculated Stats
  const todayStr = new Date().toISOString().split('T')[0]
  const todayTotal = expenses
    .filter(e => e.created_at.startsWith(todayStr))
    .reduce((sum, e) => sum + e.amount, 0)

  const monthTotal = expenses.reduce((sum, e) => sum + e.amount, 0)

  const filteredExpenses = filterCategory === 'all'
    ? expenses
    : expenses.filter(e => e.category.includes(filterCategory))

  return (
    <div className="space-y-6 pb-12 select-none" dir="rtl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-xs">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <DollarSign className="w-6 h-6 text-amber-500" />
            سندات المصروفات والنثريات اليومية
          </h1>
          <p className="text-xs sm:text-sm font-semibold text-slate-500 dark:text-slate-400 mt-1">
            تسجيل ومتابعة كافة المصروفات التشغيلية والرواتب وخصمها من صافي أرباح المنشأة
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-slate-900 border-slate-800 text-white rounded-2xl shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-400">مصروفات اليوم</p>
                <p className="text-2xl font-black text-amber-400 font-mono mt-1">
                  {formatCurrency(todayTotal)}
                </p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
                <TrendingDown className="w-6 h-6" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-800 text-white rounded-2xl shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-400">إجمالي المصروفات المسجلة</p>
                <p className="text-2xl font-black text-rose-400 font-mono mt-1">
                  {formatCurrency(monthTotal)}
                </p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center border border-rose-500/30">
                <Receipt className="w-6 h-6" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-800 text-white rounded-2xl shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-400">عدد سندات الصرف</p>
                <p className="text-2xl font-black text-blue-400 font-mono mt-1">
                  {formatNumber(expenses.length)} سند
                </p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-blue-500/20 text-blue-400 flex items-center justify-center border border-blue-500/30">
                <FileText className="w-6 h-6" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Expense Entry Form */}
        <Card className="bg-slate-900 border-slate-800 text-white rounded-2xl shadow-sm lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base font-black flex items-center gap-2 text-white">
              <Plus className="w-5 h-5 text-amber-500" />
              تسجيل سند صرف جديد
            </CardTitle>
            <CardDescription className="text-xs text-slate-400">
              أدخل بيانات المصروف ليتم خصمها من تقارير الأرباح
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAddExpense} className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-300">بند / تصنيف المصروف</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger className="h-11 bg-slate-950/80 border-slate-800 text-white rounded-xl text-sm font-bold">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-800 text-white rounded-xl">
                    {EXPENSE_CATEGORIES.map(cat => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-300">المبلغ المنصرف (ج.م)</Label>
                <Input
                  type="number"
                  step="0.5"
                  min="0"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="h-11 bg-slate-950/80 border-slate-800 text-white rounded-xl text-base font-black font-mono text-left"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-300">طريقة الدفع</Label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('cash')}
                    className={`h-10 rounded-xl font-bold text-xs border transition-all cursor-pointer ${
                      paymentMethod === 'cash'
                        ? 'bg-emerald-600 border-emerald-500 text-white shadow-md'
                        : 'bg-slate-950/80 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    نقدي (كاش)
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('card')}
                    className={`h-10 rounded-xl font-bold text-xs border transition-all cursor-pointer ${
                      paymentMethod === 'card'
                        ? 'bg-blue-600 border-blue-500 text-white shadow-md'
                        : 'bg-slate-950/80 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    شبكة / فيزا
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-300">بيان / تفاصيل المصروف</Label>
                <Input
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="مثال: فاتورة كهرباء شهر أغسطس"
                  className="h-11 bg-slate-950/80 border-slate-800 text-white rounded-xl text-sm font-bold"
                />
              </div>

              <Button
                type="submit"
                className="w-full h-11 bg-amber-600 hover:bg-amber-500 text-white font-black rounded-xl shadow-md shadow-amber-600/30 cursor-pointer"
              >
                <Plus className="w-4 h-4 ml-1" />
                حفظ سند الصرف
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Expenses History Table */}
        <Card className="bg-slate-900 border-slate-800 text-white rounded-2xl shadow-sm lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-base font-black text-white">سجل المصروفات المسجلة</CardTitle>
              <CardDescription className="text-xs text-slate-400">
                عرض تفصيلي لكافة السندات المسجلة
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-400" />
              <Select value={filterCategory} onValueChange={setFilterCategory}>
                <SelectTrigger className="h-9 bg-slate-950 border-slate-800 text-xs font-bold rounded-lg w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-800 text-white rounded-xl text-xs">
                  <SelectItem value="all">كافة البنود</SelectItem>
                  <SelectItem value="إيجار">إيجار</SelectItem>
                  <SelectItem value="كهرباء">كهرباء ومياه</SelectItem>
                  <SelectItem value="مرتبات">مرتبات</SelectItem>
                  <SelectItem value="صيانة">صيانة</SelectItem>
                  <SelectItem value="بوفيه">بوفيه</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-bold">
                    <th className="pb-3 pr-2">البند / التصنيف</th>
                    <th className="pb-3">البيان والتفاصيل</th>
                    <th className="pb-3">المبلغ</th>
                    <th className="pb-3">طريقة الدفع</th>
                    <th className="pb-3">المسؤول والتاريخ</th>
                    <th className="pb-3 text-center">إجراء</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-semibold">
                  {filteredExpenses.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-500 font-bold">
                        لا توجد مصروفات مسجلة حتى الآن
                      </td>
                    </tr>
                  ) : (
                    filteredExpenses.map(item => (
                      <tr key={item.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-3.5 pr-2 font-black text-amber-400">
                          {item.category}
                        </td>
                        <td className="py-3.5 text-slate-200">
                          {item.description}
                        </td>
                        <td className="py-3.5 font-black text-rose-400 font-mono">
                          {formatCurrency(item.amount)}
                        </td>
                        <td className="py-3.5">
                          <span className={`px-2 py-0.5 rounded-md font-bold text-[10px] ${
                            item.payment_method === 'cash'
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                          }`}>
                            {item.payment_method === 'cash' ? 'نقدي' : 'فيزا'}
                          </span>
                        </td>
                        <td className="py-3.5 text-slate-400 text-[11px]">
                          <div>{item.created_by}</div>
                          <div className="text-[10px] text-slate-500 font-mono">
                            {new Date(item.created_at).toLocaleDateString('ar-EG')}
                          </div>
                        </td>
                        <td className="py-3.5 text-center">
                          <button
                            type="button"
                            onClick={() => handleDeleteExpense(item.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                            title="حذف السند"
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
