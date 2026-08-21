'use client'

import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/lib/db'
import { syncEngine } from '@/lib/sync-engine'
import { toast } from 'sonner'
import { Plus, Search, Users, Phone, MapPin, Trash, UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useStore } from '@/lib/store-context'
import { DEFAULT_STORE_UUID } from '@/lib/sync-engine'
import type { Customer } from '@/lib/types'

export default function CustomersPage() {
  const { storeId } = useStore()
  const currentStoreId = storeId || DEFAULT_STORE_UUID
  const [searchTerm, setSearchTerm] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const customers = useLiveQuery(
    () => db.customers.where('store_id').equals(currentStoreId).reverse().sortBy('created_at'),
    [currentStoreId]
  ) || []

  const filteredCustomers = customers.filter(c =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.phone && c.phone.includes(searchTerm))
  )

  const handleAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      toast.error('يرجى إدخال اسم العميل')
      return
    }

    try {
      setIsSubmitting(true)
      const now = new Date().toISOString()
      const newCustomer: Customer = {
        id: crypto.randomUUID(),
        store_id: currentStoreId,
        name: name.trim(),
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

  const handleDelete = async (id: string) => {
    if (!confirm('هل تريد حذف هذا العميل؟')) return
    await db.customers.delete(id)
    syncEngine.enqueueOperation('customers', 'DELETE', { id })
    toast.success('تم حذف العميل')
  }

  return (
    <div className="space-y-6 pb-20" dir="rtl">
      {/* Header Banner */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-sm transition-colors">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-100 dark:border-indigo-800/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shadow-xs">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
              إدارة العملاء
            </h1>
            <p className="text-xs sm:text-sm font-semibold text-slate-500 dark:text-slate-400 mt-0.5">
              تسجيل بيانات العملاء ومتابعة سجل المشتريات والتواصل
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Customers Table (2 Cols) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-sm flex items-center transition-colors">
            <div className="relative w-full max-w-sm">
              <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 w-5 h-5 pointer-events-none" />
              <Input
                placeholder="بحث باسم العميل أو رقم الهاتف..."
                className="pr-12 h-12 text-sm bg-slate-50/80 dark:bg-slate-800/80 rounded-xl"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-sm overflow-hidden transition-colors">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-right border-collapse">
                <thead className="bg-slate-50/90 dark:bg-slate-800/90 border-b border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-extrabold text-xs">
                  <tr>
                    <th className="py-4 px-6 font-black">اسم العميل</th>
                    <th className="py-4 px-6 font-black">الهاتف</th>
                    <th className="py-4 px-6 font-black">العنوان</th>
                    <th className="py-4 px-6 w-16"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                  {filteredCustomers.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-20 text-center text-slate-400 dark:text-slate-500">
                        <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
                        <p className="font-bold text-base text-slate-700 dark:text-slate-300">لا يوجد عملاء مسجلين</p>
                      </td>
                    </tr>
                  ) : (
                    filteredCustomers.map(customer => (
                      <tr key={customer.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                        <td className="py-4 px-6 font-bold text-slate-900 dark:text-white text-sm">{customer.name}</td>
                        <td className="py-4 px-6 font-mono text-slate-600 dark:text-slate-400 text-xs">{customer.phone || '-'}</td>
                        <td className="py-4 px-6 text-slate-500 dark:text-slate-400 text-xs">{customer.address || '-'}</td>
                        <td className="py-4 px-6 text-left">
                          <button 
                            type="button"
                            className="w-8 h-8 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center justify-center transition-colors cursor-pointer"
                            onClick={() => handleDelete(customer.id)}
                          >
                            <Trash className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Add Customer Form (1 Col) */}
        <div>
          <Card className="border-slate-200/90 dark:border-slate-800 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                إضافة عميل جديد
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAddCustomer} className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-600 dark:text-slate-300">اسم العميل *</Label>
                  <Input
                    placeholder="مثال: أحمد محمد"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    className="h-12 text-sm bg-slate-50/80 dark:bg-slate-800/80 rounded-xl font-bold"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-600 dark:text-slate-300">رقم الهاتف</Label>
                  <Input
                    placeholder="010XXXXXXXX"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    className="h-12 font-mono text-left bg-slate-50/80 dark:bg-slate-800/80 rounded-xl"
                    dir="ltr"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-600 dark:text-slate-300">العنوان</Label>
                  <Input
                    placeholder="المدينة / المنطقة / الشارع"
                    value={address}
                    onChange={e => setAddress(e.target.value)}
                    className="h-12 text-sm bg-slate-50/80 dark:bg-slate-800/80 rounded-xl"
                  />
                </div>

                <Button 
                  type="submit" 
                  disabled={isSubmitting} 
                  className="w-full h-12 text-sm font-black bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-xl shadow-md shadow-blue-600/25 active:scale-95 transition-all mt-2"
                >
                  <Plus className="ml-2 h-5 w-5" />
                  {isSubmitting ? 'جاري الحفظ...' : 'إضافة العميل'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
