'use client'

import React, { useState, useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/lib/db'
import { syncEngine } from '@/lib/sync-engine'
import { toast } from 'sonner'
import { 
  Plus, Search, Users, Phone, MapPin, Trash2, UserPlus, 
  FileSpreadsheet, Printer, ChevronLeft, ChevronRight,
  ChevronsLeft, ChevronsRight, LayoutGrid, LayoutList,
  Edit3, ShieldCheck, DollarSign, Wallet
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useStore } from '@/lib/store-context'
import { DEFAULT_STORE_UUID } from '@/lib/sync-engine'
import type { Customer } from '@/lib/types'

type TableDensity = 'compact' | 'comfortable'

function exportCustomersToCSV(data: Customer[], filename: string) {
  if (data.length === 0) { toast.error('لا يوجد عملاء للتصدير'); return }
  const headers = ['اسم العميل', 'رقم الهاتف', 'العنوان', 'الرصيد الحالي', 'الحالة']
  const rows = data.map(c => [
    c.name,
    c.phone || '—',
    c.address || '—',
    (c.balance || 0).toFixed(2),
    c.status === 'active' ? 'نشط' : 'غير نشط'
  ])
  const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.map(cell => `"${cell}"`).join(','))].join('\n')
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = `${filename}_${new Date().toISOString().slice(0,10)}.csv`
  link.click()
  toast.success('تم تصدير دليل العملاء بنجاح')
}

export default function CustomersPage() {
  const { storeId } = useStore()
  const currentStoreId = storeId || DEFAULT_STORE_UUID

  const [searchTerm, setSearchTerm] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Pagination & Layout
  const [currentPage, setCurrentPage] = useState(1)
  const [rowsPerPage, setRowsPerPage] = useState(25)
  const [density, setDensity] = useState<TableDensity>('comfortable')

  const customers = useLiveQuery(
    () => db.customers.where('store_id').equals(currentStoreId).reverse().sortBy('created_at'),
    [currentStoreId]
  ) || []

  // Stats
  const stats = useMemo(() => {
    let totalBalance = 0
    let withBalanceCount = 0

    customers.forEach(c => {
      const b = Number(c.balance) || 0
      totalBalance += b
      if (b > 0) withBalanceCount++
    })

    return { total: customers.length, totalBalance, withBalanceCount }
  }, [customers])

  const filteredCustomers = useMemo(() => {
    return customers.filter(c =>
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.phone && c.phone.includes(searchTerm)) ||
      (c.address && c.address.toLowerCase().includes(searchTerm.toLowerCase()))
    )
  }, [customers, searchTerm])

  const totalPages = Math.max(1, Math.ceil(filteredCustomers.length / rowsPerPage))
  const paginatedCustomers = filteredCustomers.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage)
  const startIndex = (currentPage - 1) * rowsPerPage + 1
  const endIndex = Math.min(currentPage * rowsPerPage, filteredCustomers.length)

  const resetPage = () => setCurrentPage(1)

  const handleAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmedName = name.trim()
    if (!trimmedName) {
      toast.error('يرجى إدخال اسم العميل')
      return
    }

    try {
      setIsSubmitting(true)
      const now = new Date().toISOString()
      const newCustomer: Customer = {
        id: crypto.randomUUID(),
        store_id: currentStoreId,
        name: trimmedName,
        phone: phone.trim() || undefined,
        address: address.trim() || undefined,
        balance: 0,
        status: 'active',
        created_at: now,
        updated_at: now,
      }

      await db.customers.add(newCustomer)
      syncEngine.enqueueOperation('customers', 'INSERT', newCustomer)

      toast.success('تمت إضافة العميل بنجاح')
      setName('')
      setPhone('')
      setAddress('')
    } catch (err: any) {
      toast.error('حدث خطأ أثناء إضافة العميل: ' + err.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (id: string, custName: string) => {
    if (!confirm(`هل أنت متأكد من حذف العميل (${custName})؟`)) return
    await db.customers.delete(id)
    syncEngine.enqueueOperation('customers', 'DELETE', { id })
    toast.success('تم حذف العميل بنجاح')
  }

  const py = density === 'compact' ? 'py-2.5' : 'py-3.5'
  const textSize = density === 'compact' ? 'text-xs' : 'text-sm'

  return (
    <div className="space-y-4 pb-12 select-none" dir="rtl">
      {/* ── Header Banner ── */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-sm transition-colors">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/50 border border-blue-100 dark:border-blue-800/60 flex items-center justify-center text-blue-600 dark:text-blue-400 shadow-xs">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              دليل وبيانات العملاء
            </h1>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-0.5">
              إدارة العملاء، أرقام الهواتف، العناوين، ومتابعة الأرصدة الآجلة
            </p>
          </div>
        </div>
      </div>

      {/* ── KPI Stats Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="flex items-center gap-3.5 p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="w-10 h-10 rounded-xl bg-blue-500/15 border border-blue-500/25 flex items-center justify-center text-blue-500">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white leading-none font-mono">
              {stats.total}
            </p>
            <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mt-1">إجمالي العملاء المسجلين</p>
          </div>
        </div>

        <div className="flex items-center gap-3.5 p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center text-emerald-500">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400 leading-none font-mono">
              {stats.total - stats.withBalanceCount}
            </p>
            <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mt-1">عملاء مخلصين الحساب (0 رصيد)</p>
          </div>
        </div>

        <div className="flex items-center gap-3.5 p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="w-10 h-10 rounded-xl bg-rose-500/15 border border-rose-500/25 flex items-center justify-center text-rose-500">
            <Wallet className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xl sm:text-2xl font-black text-rose-600 dark:text-rose-400 leading-none font-mono">
              {stats.totalBalance.toFixed(2)} <span className="text-xs font-normal">ج.م</span>
            </p>
            <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mt-1">إجمالي الذمم المدينة (الآجل)</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Customers Table (2 Cols) */}
        <div className="lg:col-span-2 space-y-3">
          {/* Search Bar & Table Toolbar */}
          <div className="bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-xs flex items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 pointer-events-none" />
              <Input
                placeholder="بحث باسم العميل، الهاتف، أو العنوان..."
                className="pr-10 h-10 text-xs bg-slate-50/80 dark:bg-slate-800/80 rounded-xl font-bold"
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); resetPage() }}
              />
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => exportCustomersToCSV(filteredCustomers, 'customers_list')}
                className="w-8 h-8 rounded-lg bg-slate-50 hover:bg-emerald-50 dark:bg-slate-800 dark:hover:bg-emerald-950/40 text-slate-500 hover:text-emerald-600 flex items-center justify-center transition-all cursor-pointer active:scale-95"
                title="تصدير CSV"
              >
                <FileSpreadsheet className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="w-8 h-8 rounded-lg bg-slate-50 hover:bg-blue-50 dark:bg-slate-800 dark:hover:bg-blue-950/40 text-slate-500 hover:text-blue-600 flex items-center justify-center transition-all cursor-pointer active:scale-95"
                title="طباعة"
              >
                <Printer className="w-4 h-4" />
              </button>
              <div className="w-px h-4 bg-slate-200 dark:bg-slate-700 mx-0.5" />
              <button
                type="button"
                onClick={() => setDensity(density === 'compact' ? 'comfortable' : 'compact')}
                className="w-8 h-8 rounded-lg bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 text-slate-500 flex items-center justify-center transition-all cursor-pointer active:scale-95"
                title={density === 'compact' ? 'عرض مريح' : 'عرض مضغوط'}
              >
                {density === 'compact' ? <LayoutGrid className="w-4 h-4" /> : <LayoutList className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Table Container */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-right border-collapse min-w-[550px]">
                <thead className="bg-slate-50/90 dark:bg-slate-800/90 border-b border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-extrabold text-xs">
                  <tr>
                    <th className={`${py} px-4 font-black`}>اسم العميل</th>
                    <th className={`${py} px-4 font-black`}>الهاتف</th>
                    <th className={`${py} px-4 font-black`}>العنوان</th>
                    <th className={`${py} px-4 font-black text-center`}>الرصيد الآجل</th>
                    <th className={`${py} px-4 text-center w-16`}></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {paginatedCustomers.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-slate-400">
                        <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
                        <p className="font-bold text-xs">لا يوجد عملاء مطابقين للبحث</p>
                      </td>
                    </tr>
                  ) : (
                    paginatedCustomers.map(customer => (
                      <tr key={customer.id} className="hover:bg-blue-50/30 dark:hover:bg-slate-800/40 transition-colors">
                        <td className={`${py} px-4 font-black text-slate-900 dark:text-white ${textSize}`}>
                          {customer.name}
                        </td>
                        <td className={`${py} px-4 font-mono text-slate-600 dark:text-slate-400 text-xs`} dir="ltr">
                          {customer.phone || '—'}
                        </td>
                        <td className={`${py} px-4 text-slate-500 dark:text-slate-400 text-xs`}>
                          {customer.address || '—'}
                        </td>
                        <td className={`${py} px-4 text-center`}>
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-mono font-bold ${
                            Number(customer.balance || 0) > 0
                              ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                          }`}>
                            {Number(customer.balance || 0).toFixed(2)} ج.م
                          </span>
                        </td>
                        <td className={`${py} px-4 text-center`}>
                          <button
                            type="button"
                            onClick={() => handleDelete(customer.id, customer.name)}
                            className="w-7 h-7 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center justify-center transition-all cursor-pointer"
                            title="حذف العميل"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Footer */}
            {filteredCustomers.length > 0 && (
              <div className="bg-white dark:bg-slate-900 px-4 py-2.5 border-t border-slate-200/90 dark:border-slate-800 flex items-center justify-between text-xs">
                <div className="text-[11px] font-bold text-slate-500">
                  عرض {startIndex}-{endIndex} من إجمالي {filteredCustomers.length}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    className="w-7 h-7 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-500 flex items-center justify-center disabled:opacity-30 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                  <span className="px-2 h-7 rounded-md bg-blue-600 text-white font-black text-xs flex items-center justify-center">
                    {currentPage}
                  </span>
                  <button
                    type="button"
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    className="w-7 h-7 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-500 flex items-center justify-center disabled:opacity-30 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Add Customer Form (1 Col) */}
        <div>
          <Card className="border-slate-200/90 dark:border-slate-800 shadow-sm rounded-2xl sticky top-4">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-blue-600" />
                إضافة عميل جديد
              </CardTitle>
              <CardDescription className="text-xs font-semibold text-slate-500">
                تسجيل بيانات عميل جديد في النظام ونقطة البيع
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAddCustomer} className="space-y-3.5">
                <div className="space-y-1">
                  <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">اسم العميل *</Label>
                  <Input
                    placeholder="مثال: شركة النور أو أحمد علي"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    className="h-10 text-xs bg-slate-50/80 dark:bg-slate-800/80 rounded-xl font-bold"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                    <Phone className="w-3 h-3 text-slate-400" />
                    رقم الهاتف
                  </Label>
                  <Input
                    placeholder="01XXXXXXXXX"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    className="h-10 text-xs bg-slate-50/80 dark:bg-slate-800/80 rounded-xl font-mono text-left"
                    dir="ltr"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-slate-400" />
                    العنوان / المنطقة
                  </Label>
                  <Input
                    placeholder="المدينة / الشارع"
                    value={address}
                    onChange={e => setAddress(e.target.value)}
                    className="h-10 text-xs bg-slate-50/80 dark:bg-slate-800/80 rounded-xl"
                  />
                </div>

                <Button 
                  type="submit" 
                  disabled={isSubmitting} 
                  className="w-full h-11 text-xs font-black bg-blue-600 hover:bg-blue-500 text-white rounded-xl shadow-md shadow-blue-600/25 active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1.5 mt-2"
                >
                  <Plus className="h-4 w-4" />
                  {isSubmitting ? 'جاري الحفظ...' : 'حفظ بيانات العميل'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
