'use client'

import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/lib/db'
import { syncEngine } from '@/lib/sync-engine'
import { toast } from 'sonner'
import { Plus, Search, Shield, UserCheck, Trash, UserCog } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { Employee } from '@/lib/types'

export default function EmployeesPage() {
  const [searchTerm, setSearchTerm] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [pinCode, setPinCode] = useState('')
  const [role, setRole] = useState('cashier')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const employees = useLiveQuery(
    () => db.employees.orderBy('created_at').reverse().toArray()
  ) || []

  const filteredEmployees = employees.filter(e =>
    e.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (e.phone && e.phone.includes(searchTerm))
  )

  const handleAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      toast.error('يرجى إدخال اسم الموظف')
      return
    }

    try {
      setIsSubmitting(true)
      const now = new Date().toISOString()
      const newEmployee: Employee = {
        id: crypto.randomUUID(),
        store_id: 'default',
        name: name.trim(),
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        role_id: role,
        pin_code: pinCode.trim() || undefined,
        status: 'active',
        created_at: now,
        updated_at: now,
      }

      await db.employees.add(newEmployee)
      syncEngine.enqueueOperation('employees', 'INSERT', newEmployee)

      toast.success('تمت إضافة الموظف بنجاح')
      setName('')
      setPhone('')
      setEmail('')
      setPinCode('')
      setRole('cashier')
    } catch (err: any) {
      toast.error('حدث خطأ أثناء إضافة الموظف: ' + err.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('هل تريد حذف هذا الموظف؟')) return
    await db.employees.delete(id)
    syncEngine.enqueueOperation('employees', 'DELETE', { id })
    toast.success('تم حذف الموظف')
  }

  return (
    <div className="space-y-6 pb-20" dir="rtl">
      {/* Header Banner */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-sm transition-colors">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-violet-50 dark:bg-violet-950/50 border border-violet-100 dark:border-violet-800/60 flex items-center justify-center text-violet-600 dark:text-violet-400 shadow-xs">
            <UserCog className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
              الموظفين والصلاحيات
            </h1>
            <p className="text-xs sm:text-sm font-semibold text-slate-500 dark:text-slate-400 mt-0.5">
              إدارة الكاشيرات، المشرفين، رموز PIN للدخول السريع، وصلاحيات الأدوار
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Employees Table (2 Cols) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-sm flex items-center transition-colors">
            <div className="relative w-full max-w-sm">
              <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 w-5 h-5 pointer-events-none" />
              <Input
                placeholder="بحث باسم الموظف أو الهاتف..."
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
                    <th className="py-4 px-6 font-black">اسم الموظف</th>
                    <th className="py-4 px-6 font-black">الدور الوظيفي</th>
                    <th className="py-4 px-6 font-black">الهاتف</th>
                    <th className="py-4 px-6 font-black">رمز PIN</th>
                    <th className="py-4 px-6 w-16"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                  {filteredEmployees.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-20 text-center text-slate-400 dark:text-slate-500">
                        <UserCheck className="w-12 h-12 mx-auto mb-3 opacity-30" />
                        <p className="font-bold text-base text-slate-700 dark:text-slate-300">لا يوجد موظفين مسجلين</p>
                      </td>
                    </tr>
                  ) : (
                    filteredEmployees.map(emp => (
                      <tr key={emp.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                        <td className="py-4 px-6 font-bold text-slate-900 dark:text-white text-sm">{emp.name}</td>
                        <td className="py-4 px-6">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold ${
                            emp.role_id === 'admin' 
                              ? 'bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800'
                              : emp.role_id === 'manager'
                                ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                          }`}>
                            {emp.role_id === 'admin' ? 'مدير فرع' : emp.role_id === 'manager' ? 'مشرف مخزن' : 'كاشير نقطة بيع'}
                          </span>
                        </td>
                        <td className="py-4 px-6 font-mono text-slate-600 dark:text-slate-400 text-xs">{emp.phone || '-'}</td>
                        <td className="py-4 px-6 font-mono text-xs text-slate-500">{emp.pin_code ? '••••' : '-'}</td>
                        <td className="py-4 px-6 text-left">
                          <button 
                            type="button"
                            className="w-8 h-8 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center justify-center transition-colors cursor-pointer"
                            onClick={() => handleDelete(emp.id)}
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

        {/* Add Employee Form (1 Col) */}
        <div>
          <Card className="border-slate-200/90 dark:border-slate-800 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                <Shield className="w-5 h-5 text-violet-600 dark:text-violet-400" />
                إضافة موظف / كاشير جديد
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAddEmployee} className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-600 dark:text-slate-300">اسم الموظف *</Label>
                  <Input
                    placeholder="مثال: كريم السيد"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    className="h-12 text-sm bg-slate-50/80 dark:bg-slate-800/80 rounded-xl font-bold"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-600 dark:text-slate-300">الدور الوظيفي والصلاحيات</Label>
                  <Select value={role} onValueChange={setRole}>
                    <SelectTrigger className="h-12 text-sm font-bold bg-slate-50/80 dark:bg-slate-800/80 rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl shadow-xl dark:bg-slate-900 dark:border-slate-800">
                      <SelectItem value="cashier">كاشير (نقطة البيع فقط)</SelectItem>
                      <SelectItem value="manager">مشرف (المخزن والمبيعات والمشتريات)</SelectItem>
                      <SelectItem value="admin">مدير النظام (صلاحيات كاملة)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-600 dark:text-slate-300">رمز الدخول السريع (PIN)</Label>
                  <Input
                    type="password"
                    maxLength={6}
                    placeholder="4 أو 6 أرقام"
                    value={pinCode}
                    onChange={e => setPinCode(e.target.value)}
                    className="h-12 font-mono text-center text-lg bg-slate-50/80 dark:bg-slate-800/80 rounded-xl tracking-widest"
                    dir="ltr"
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

                <Button 
                  type="submit" 
                  disabled={isSubmitting} 
                  className="w-full h-12 text-sm font-black bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-xl shadow-md shadow-blue-600/25 active:scale-95 transition-all mt-2"
                >
                  <Plus className="ml-2 h-5 w-5" />
                  {isSubmitting ? 'جاري الحفظ...' : 'إضافة الموظف'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
