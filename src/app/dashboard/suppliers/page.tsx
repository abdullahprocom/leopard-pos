'use client'

import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/lib/db'
import { syncEngine } from '@/lib/sync-engine'
import { toast } from 'sonner'
import { Plus, Search, Building2, Trash, Factory } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useStore } from '@/lib/store-context'
import { DEFAULT_STORE_UUID } from '@/lib/sync-engine'
import type { Supplier } from '@/lib/types'

export default function SuppliersPage() {
  const { storeId } = useStore()
  const currentStoreId = storeId || DEFAULT_STORE_UUID
  const [searchTerm, setSearchTerm] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const suppliers = useLiveQuery(
    () => db.suppliers.where('store_id').equals(currentStoreId).reverse().sortBy('created_at'),
    [currentStoreId]
  ) || []

  const filteredSuppliers = suppliers.filter(s =>
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (s.phone && s.phone.includes(searchTerm))
  )

  const handleAddSupplier = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      toast.error('يرجى إدخال اسم المورد أو الشركة')
      return
    }

    try {
      setIsSubmitting(true)
      const now = new Date().toISOString()
      const newSupplier: Supplier = {
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

      await db.suppliers.add(newSupplier)
      syncEngine.enqueueOperation('suppliers', 'INSERT', newSupplier)

      toast.success('تمت إضافة المورد بنجاح')
      setName('')
      setPhone('')
      setAddress('')
    } catch (err: any) {
      toast.error('حدث خطأ أثناء إضافة المورد: ' + err.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('هل تريد حذف هذا المورد؟')) return
    await db.suppliers.delete(id)
    syncEngine.enqueueOperation('suppliers', 'DELETE', { id })
    toast.success('تم حذف المورد')
  }

  return (
    <div className="space-y-6 pb-20" dir="rtl">
      {/* Header Banner */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-sm transition-colors">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-200 shadow-xs">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
              إدارة الشركات والموردين
            </h1>
            <p className="text-xs sm:text-sm font-semibold text-slate-500 dark:text-slate-400 mt-0.5">
              تسجيل الشركات الموردة ومتابعة الفواتير وحسابات المشتريات
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Suppliers List (2 Cols) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-sm flex items-center transition-colors">
            <div className="relative w-full max-w-sm">
              <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 w-5 h-5 pointer-events-none" />
              <Input
                placeholder="بحث باسم المورد أو رقم الهاتف..."
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
                    <th className="py-4 px-6 font-black">اسم المورد / الشركة</th>
                    <th className="py-4 px-6 font-black">الهاتف</th>
                    <th className="py-4 px-6 font-black">العنوان</th>
                    <th className="py-4 px-6 w-16"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                  {filteredSuppliers.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-20 text-center text-slate-400 dark:text-slate-500">
                        <Building2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
                        <p className="font-bold text-base text-slate-700 dark:text-slate-300">لا يوجد موردين مسجلين</p>
                      </td>
                    </tr>
                  ) : (
                    filteredSuppliers.map(supplier => (
                      <tr key={supplier.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                        <td className="py-4 px-6 font-bold text-slate-900 dark:text-white text-sm">{supplier.name}</td>
                        <td className="py-4 px-6 font-mono text-slate-600 dark:text-slate-400 text-xs">{supplier.phone || '-'}</td>
                        <td className="py-4 px-6 text-slate-500 dark:text-slate-400 text-xs">{supplier.address || '-'}</td>
                        <td className="py-4 px-6 text-left">
                          <button 
                            type="button"
                            className="w-8 h-8 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center justify-center transition-colors cursor-pointer"
                            onClick={() => handleDelete(supplier.id)}
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

        {/* Add Supplier Form (1 Col) */}
        <div>
          <Card className="border-slate-200/90 dark:border-slate-800 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                <Factory className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                إضافة مورد جديد
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAddSupplier} className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-600 dark:text-slate-300">اسم المورد أو الشركة *</Label>
                  <Input
                    placeholder="مثال: شركة الأهرام للصناعات الغذائية"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    className="h-12 text-sm bg-slate-50/80 dark:bg-slate-800/80 rounded-xl font-bold"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-600 dark:text-slate-300">رقم الهاتف</Label>
                  <Input
                    placeholder="011XXXXXXXX"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    className="h-12 font-mono text-left bg-slate-50/80 dark:bg-slate-800/80 rounded-xl"
                    dir="ltr"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-600 dark:text-slate-300">العنوان والمقر</Label>
                  <Input
                    placeholder="المدينة / المنطقة"
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
                  {isSubmitting ? 'جاري الحفظ...' : 'إضافة المورد'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
