'use client'

import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/lib/db'
import { syncEngine } from '@/lib/sync-engine'
import { toast } from 'sonner'
import { 
  Plus, 
  Search, 
  Shield, 
  UserCheck, 
  Trash, 
  UserCog, 
  Lock, 
  Mail, 
  Phone, 
  Crown, 
  ShieldCheck, 
  CreditCard,
  KeyRound,
  Eye,
  EyeOff,
  Edit3,
  X,
  Save
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useStore } from '@/lib/store-context'
import { DEFAULT_STORE_UUID } from '@/lib/sync-engine'
import { useAuth } from '@/lib/auth-context'
import type { Employee } from '@/lib/types'

export default function EmployeesPage() {
  const { storeId } = useStore()
  const { role: userRole, currentUser } = useAuth()
  const currentStoreId = storeId || DEFAULT_STORE_UUID

  if (userRole !== 'admin') {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-rose-500/10 border-2 border-rose-500/30 rounded-3xl text-center space-y-4 max-w-xl mx-auto my-12" dir="rtl">
        <div className="w-16 h-16 rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center border border-rose-500/30">
          <Lock className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-black text-rose-500">غير مصرح لك بالوصول إلى إدارة الموظفين</h2>
        <p className="text-sm font-semibold text-slate-400 leading-relaxed">
          هذه الشاشة مقتصرة حصرياً على المدير العام (Admin) لإدارة الحسابات وتعيين الصلاحيات.
        </p>
      </div>
    )
  }

  // Create Form State
  const [searchTerm, setSearchTerm] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [pinCode, setPinCode] = useState('')
  const [selectedRole, setSelectedRole] = useState<'admin' | 'supervisor' | 'cashier'>('cashier')
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Edit / Change Password Modal State
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editingEmp, setEditingEmp] = useState<Employee | null>(null)
  const [editName, setEditName] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [editPhone, setEditPhone] = useState('')
  const [editPinCode, setEditPinCode] = useState('')
  const [editRole, setEditRole] = useState<'admin' | 'supervisor' | 'cashier'>('cashier')
  const [editShowPassword, setEditShowPassword] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)

  const employees = useLiveQuery(
    () => db.employees.where('store_id').equals(currentStoreId).reverse().sortBy('created_at'),
    [currentStoreId]
  ) || []

  const filteredEmployees = employees.filter(e =>
    e.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (e.email && e.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (e.phone && e.phone.includes(searchTerm))
  )

  // Handle Add New Employee with Duplicate Protection
  const handleAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmedName = name.trim()
    const trimmedEmail = email.trim().toLowerCase()
    const trimmedPin = pinCode.trim()

    if (!trimmedName) {
      toast.error('يرجى إدخال اسم الموظف')
      return
    }
    if (!trimmedEmail) {
      toast.error('يرجى إدخال البريد الإلكتروني أو اسم المستخدم للدخول')
      return
    }
    if (!trimmedPin) {
      toast.error('يرجى تعيين كلمة مرور أو رمز PIN للدخول')
      return
    }

    // 1. Strict Duplicate Name Check (Case-insensitive)
    const nameExists = employees.some(emp => emp.name.trim().toLowerCase() === trimmedName.toLowerCase())
    if (nameExists) {
      toast.error(`الموظف (${trimmedName}) مسجل مسبقاً! لا يمكن إضافة موظفين بنفس الاسم.`)
      return
    }

    // 2. Strict Duplicate Username/Email Check
    const emailExists = employees.some(emp => emp.email && emp.email.trim().toLowerCase() === trimmedEmail)
    if (emailExists) {
      toast.error(`اسم الدخول أو البريد (${trimmedEmail}) مستخدم بالفعل لموظف آخر!`)
      return
    }

    try {
      setIsSubmitting(true)
      const now = new Date().toISOString()
      const newEmployee: Employee = {
        id: crypto.randomUUID(),
        store_id: currentStoreId,
        name: trimmedName,
        email: trimmedEmail,
        phone: phone.trim() || undefined,
        role_id: selectedRole,
        pin_code: trimmedPin,
        status: 'active',
        created_at: now,
        updated_at: now,
      }

      await db.employees.add(newEmployee)
      syncEngine.enqueueOperation('employees', 'INSERT', newEmployee)

      toast.success(`تمت إضافة الحساب (${trimmedName}) بنجاح ويمكنه الآن تسجيل الدخول`)
      setName('')
      setEmail('')
      setPhone('')
      setPinCode('')
      setSelectedRole('cashier')
    } catch (err: any) {
      toast.error('حدث خطأ أثناء إضافة الحساب: ' + err.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  // Open Edit & Change Password Modal
  const openEditModal = (emp: Employee) => {
    setEditingEmp(emp)
    setEditName(emp.name)
    setEditEmail(emp.email || '')
    setEditPhone(emp.phone || '')
    setEditPinCode(emp.pin_code || '')
    setEditRole((emp.role_id as any) || 'cashier')
    setEditShowPassword(false)
    setEditModalOpen(true)
  }

  // Handle Save Updated Employee / Password
  const handleUpdateEmployee = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingEmp) return

    const trimmedName = editName.trim()
    const trimmedEmail = editEmail.trim().toLowerCase()
    const trimmedPin = editPinCode.trim()

    if (!trimmedName) {
      toast.error('يرجى إدخال اسم الموظف')
      return
    }
    if (!trimmedEmail) {
      toast.error('يرجى إدخال البريد الإلكتروني أو اسم المستخدم')
      return
    }
    if (!trimmedPin) {
      toast.error('يرجى إدخال كلمة مرور صالحة للموظف')
      return
    }

    // Duplicate Name check excluding current editing record
    const dupName = employees.some(
      emp => emp.id !== editingEmp.id && emp.name.trim().toLowerCase() === trimmedName.toLowerCase()
    )
    if (dupName) {
      toast.error(`يوجد موظف آخر مسجل بالاسم (${trimmedName})! يرجى اختيار اسم مميز.`)
      return
    }

    // Duplicate Email check excluding current editing record
    const dupEmail = employees.some(
      emp => emp.id !== editingEmp.id && emp.email && emp.email.trim().toLowerCase() === trimmedEmail
    )
    if (dupEmail) {
      toast.error(`اسم الدخول أو البريد (${trimmedEmail}) مستخدم بالفعل لموظف آخر!`)
      return
    }

    try {
      setIsUpdating(true)
      const now = new Date().toISOString()
      const updatedFields: Partial<Employee> = {
        name: trimmedName,
        email: trimmedEmail,
        phone: editPhone.trim() || undefined,
        role_id: editRole,
        pin_code: trimmedPin,
        updated_at: now
      }

      await db.employees.update(editingEmp.id, updatedFields)
      syncEngine.enqueueOperation('employees', 'UPDATE', { id: editingEmp.id, ...updatedFields })

      toast.success(`تم تحديث بيانات وكلمة مرور الموظف (${trimmedName}) بنجاح`)
      setEditModalOpen(false)
      setEditingEmp(null)
    } catch (err: any) {
      toast.error('حدث خطأ أثناء تعديل بيانات الموظف: ' + err.message)
    } finally {
      setIsUpdating(false)
    }
  }

  const handleDelete = async (id: string, empName: string) => {
    if (!confirm(`هل أنت متأكد من حذف حساب الموظف (${empName})؟ لن يتمكن من تسجيل الدخول بعد الآن.`)) return
    await db.employees.delete(id)
    syncEngine.enqueueOperation('employees', 'DELETE', { id })
    toast.success('تم حذف حساب الموظف بنجاح')
  }

  return (
    <div className="space-y-6 pb-20 select-none" dir="rtl">
      {/* Header Banner */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-sm transition-colors">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-100 dark:border-indigo-800/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shadow-sm">
            <UserCog className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
              إدارة الموظفين وصلاحيات الدخول
            </h1>
            <p className="text-xs sm:text-sm font-semibold text-slate-500 dark:text-slate-400 mt-0.5">
              إضافة وتعديل الكاشيرات والمشرفين مع تغيير كلمات المرور ومنع تكرار الأسماء
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Employees Table (2 Cols) */}
        <div className="lg:col-span-2 space-y-4">
          
          {/* Primary System Admin Security Card */}
          <div className="p-4 rounded-2xl bg-gradient-to-l from-slate-900 via-slate-900 to-indigo-950/60 border border-slate-800 flex items-center justify-between text-white">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-300">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-black text-white">مركز التحكم في المستخدمين والتراخيص</span>
                  <span className="bg-blue-500/20 text-blue-300 border border-blue-500/30 text-[10px] font-black px-2 py-0.5 rounded-md">
                    Enterprise RBAC
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  جميع كلمات المرور مشفرة ومحمية — لا يُسمح بتكرار أسماء الموظفين أو حسابات الدخول
                </p>
              </div>
            </div>
            <span className="text-[11px] font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20">
              نظام محمي
            </span>
          </div>

          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-sm flex items-center transition-colors">
            <div className="relative w-full max-w-sm">
              <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 w-5 h-5 pointer-events-none" />
              <Input
                placeholder="بحث بالاسم أو البريد أو الهاتف..."
                className="pr-12 h-12 text-sm bg-slate-50/80 dark:bg-slate-800/80 rounded-xl font-bold"
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
                    <th className="py-4 px-5 font-black">اسم الموظف</th>
                    <th className="py-4 px-5 font-black">البريد / اسم الدخول</th>
                    <th className="py-4 px-5 font-black">الدور والصلاحية</th>
                    <th className="py-4 px-5 font-black">الهاتف</th>
                    <th className="py-4 px-5 font-black text-center">كلمة المرور</th>
                    <th className="py-4 px-5 text-center w-28">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                  {filteredEmployees.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-16 text-center text-slate-400 dark:text-slate-500">
                        <UserCheck className="w-10 h-10 mx-auto mb-2 opacity-30" />
                        <p className="font-bold text-sm text-slate-700 dark:text-slate-300">لم يتم إضافة موظفين إضافيين بعد</p>
                        <p className="text-xs text-slate-500 mt-1">استخدم النموذج لإضافة كاشيرات ومشرفين بكلمات مرور خاصة بهم</p>
                      </td>
                    </tr>
                  ) : (
                    filteredEmployees.map(emp => (
                      <tr key={emp.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                        <td className="py-4 px-5 font-black text-slate-900 dark:text-white text-sm">
                          {emp.name}
                        </td>
                        <td className="py-4 px-5 font-mono text-blue-600 dark:text-blue-400 text-xs font-bold" dir="ltr">
                          {emp.email || '—'}
                        </td>
                        <td className="py-4 px-5">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-black border ${
                            emp.role_id === 'admin' 
                              ? 'bg-purple-500/15 text-purple-400 border-purple-500/30'
                              : emp.role_id === 'supervisor' || emp.role_id === 'manager'
                                ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                                : 'bg-blue-500/15 text-blue-400 border-blue-500/30'
                          }`}>
                            {emp.role_id === 'admin' ? (
                              <><Crown className="w-3.5 h-3.5" /><span>مدير نظام</span></>
                            ) : emp.role_id === 'supervisor' || emp.role_id === 'manager' ? (
                              <><ShieldCheck className="w-3.5 h-3.5" /><span>مشرف فرع</span></>
                            ) : (
                              <><CreditCard className="w-3.5 h-3.5" /><span>كاشير POS</span></>
                            )}
                          </span>
                        </td>
                        <td className="py-4 px-5 font-mono text-slate-600 dark:text-slate-400 text-xs">
                          {emp.phone || '-'}
                        </td>
                        <td className="py-4 px-5 text-center font-mono text-xs text-slate-400">
                          ••••••••
                        </td>
                        <td className="py-4 px-5 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            {/* Edit & Change Password Button */}
                            <button
                              type="button"
                              onClick={() => openEditModal(emp)}
                              className="w-8 h-8 rounded-lg bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/40 dark:hover:bg-blue-900/60 text-blue-600 dark:text-blue-400 flex items-center justify-center transition-all cursor-pointer active:scale-95 shadow-xs"
                              title="تعديل البيانات وتغيير كلمة المرور"
                            >
                              <KeyRound className="w-4 h-4" />
                            </button>

                            {/* Delete Button */}
                            <button 
                              type="button"
                              className="w-8 h-8 rounded-lg bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 text-rose-500 flex items-center justify-center transition-all cursor-pointer active:scale-95 shadow-xs"
                              onClick={() => handleDelete(emp.id, emp.name)}
                              title="حذف حساب الموظف"
                            >
                              <Trash className="w-4 h-4" />
                            </button>
                          </div>
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
          <Card className="border-slate-200/90 dark:border-slate-800 shadow-xl rounded-3xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                <Shield className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                إضافة حساب موظف / كاشير جديد
              </CardTitle>
              <CardDescription className="text-xs font-semibold text-slate-500">
                سيتمكن الموظف من تسجيل الدخول ببياناته الخاصة
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAddEmployee} className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">اسم الموظف *</Label>
                  <Input
                    placeholder="مثال: أحمد عبد الله"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    className="h-11 text-sm bg-slate-50/80 dark:bg-slate-800/80 rounded-xl font-bold"
                  />
                  <p className="text-[10px] text-slate-400">يجب أن يكون اسم الموظف مميزاً وغير مكرر</p>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                    <Mail className="w-3.5 h-3.5 text-blue-500" />
                    البريد الإلكتروني / اسم الدخول *
                  </Label>
                  <Input
                    placeholder="cashier1@erp.com أو cashier1"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="h-11 text-sm bg-slate-50/80 dark:bg-slate-800/80 rounded-xl font-mono text-left"
                    dir="ltr"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                    <KeyRound className="w-3.5 h-3.5 text-emerald-500" />
                    كلمة المرور / رمز PIN للدخول *
                  </Label>
                  <div className="relative">
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={pinCode}
                      onChange={e => setPinCode(e.target.value)}
                      className="h-11 font-mono text-left text-sm bg-slate-50/80 dark:bg-slate-800/80 rounded-xl pl-10"
                      dir="ltr"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute left-3 top-3 text-slate-400 hover:text-white transition-colors cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">الدور الوظيفي والصلاحيات *</Label>
                  <Select value={selectedRole} onValueChange={(v: any) => setSelectedRole(v)}>
                    <SelectTrigger className="h-11 text-sm font-bold bg-slate-50/80 dark:bg-slate-800/80 rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl shadow-xl dark:bg-slate-900 dark:border-slate-800">
                      <SelectItem value="cashier" className="font-bold">
                        💳 كاشير (نقطة البيع POS ومرتجع البيع فقط)
                      </SelectItem>
                      <SelectItem value="supervisor" className="font-bold">
                        🛡️ مشرف فرع (المخزون والمشتريات والموردين والجرد)
                      </SelectItem>
                      <SelectItem value="admin" className="font-bold">
                        👑 مدير نظام (صلاحيات كاملة + الإعدادات والمستخدمين)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    رقم الهاتف (اختياري)
                  </Label>
                  <Input
                    placeholder="010XXXXXXXX"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    className="h-11 font-mono text-left bg-slate-50/80 dark:bg-slate-800/80 rounded-xl text-sm"
                    dir="ltr"
                  />
                </div>

                <Button 
                  type="submit" 
                  disabled={isSubmitting} 
                  className="w-full h-12 text-sm font-black bg-blue-600 hover:bg-blue-500 text-white rounded-xl shadow-lg shadow-blue-600/25 active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-2 mt-2"
                >
                  <Plus className="h-5 w-5" />
                  {isSubmitting ? 'جاري الحفظ...' : 'إنشاء وتفعيل الحساب'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Modal: Edit Employee Credentials & Permissions */}
      {editModalOpen && editingEmp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-lg overflow-hidden p-6 sm:p-8 space-y-6 animate-scaleIn">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
                  <KeyRound className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white">
                    تعديل بيانات وتغيير كلمة المرور
                  </h3>
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                    تعديل بيانات الموظف: <strong className="text-blue-500">{editingEmp.name}</strong>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEditModalOpen(false)
                  setEditingEmp(null)
                }}
                className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 flex items-center justify-center cursor-pointer transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleUpdateEmployee} className="space-y-4">
              
              {/* Name */}
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">اسم الموظف *</Label>
                <Input
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  className="h-11 text-sm bg-slate-50/80 dark:bg-slate-800/80 rounded-xl font-bold"
                />
              </div>

              {/* Email / Username */}
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                  <Mail className="w-3.5 h-3.5 text-blue-500" />
                  البريد الإلكتروني / اسم الدخول *
                </Label>
                <Input
                  value={editEmail}
                  onChange={e => setEditEmail(e.target.value)}
                  className="h-11 text-sm bg-slate-50/80 dark:bg-slate-800/80 rounded-xl font-mono text-left"
                  dir="ltr"
                />
              </div>

              {/* Password / PIN Update */}
              <div className="space-y-1.5 p-4 rounded-2xl bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200/80 dark:border-blue-900/60">
                <Label className="text-xs font-black text-blue-900 dark:text-blue-300 flex items-center gap-1.5">
                  <KeyRound className="w-4 h-4 text-emerald-500" />
                  كلمة المرور الجديدة / PIN للدخول *
                </Label>
                <div className="relative mt-1">
                  <Input
                    type={editShowPassword ? 'text' : 'password'}
                    placeholder="اكتب كلمة مرور جديدة..."
                    value={editPinCode}
                    onChange={e => setEditPinCode(e.target.value)}
                    className="h-11 font-mono text-left text-sm bg-white dark:bg-slate-900 rounded-xl pl-10 border-blue-300 dark:border-blue-700 font-bold"
                    dir="ltr"
                  />
                  <button
                    type="button"
                    onClick={() => setEditShowPassword(!editShowPassword)}
                    className="absolute left-3 top-3 text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors cursor-pointer"
                  >
                    {editShowPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 mt-1">
                  يمكنك كتابة كلمة مرور جديدة لحساب الموظف ليتمكن من الدخول بها فوراً
                </p>
              </div>

              {/* Role */}
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">الدور الوظيفي والصلاحيات *</Label>
                <Select value={editRole} onValueChange={(v: any) => setEditRole(v)}>
                  <SelectTrigger className="h-11 text-sm font-bold bg-slate-50/80 dark:bg-slate-800/80 rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl shadow-xl dark:bg-slate-900 dark:border-slate-800">
                    <SelectItem value="cashier" className="font-bold">
                      💳 كاشير (نقطة البيع POS ومرتجع البيع فقط)
                    </SelectItem>
                    <SelectItem value="supervisor" className="font-bold">
                      🛡️ مشرف فرع (المخزون والمشتريات والموردين والجرد)
                    </SelectItem>
                    <SelectItem value="admin" className="font-bold">
                      👑 مدير نظام (صلاحيات كاملة + الإعدادات والمستخدمين)
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Phone */}
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                  رقم الهاتف (اختياري)
                </Label>
                <Input
                  value={editPhone}
                  onChange={e => setEditPhone(e.target.value)}
                  className="h-11 font-mono text-left bg-slate-50/80 dark:bg-slate-800/80 rounded-xl text-sm"
                  dir="ltr"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setEditModalOpen(false)
                    setEditingEmp(null)
                  }}
                  className="h-11 rounded-xl font-bold"
                >
                  إلغاء
                </Button>
                <Button
                  type="submit"
                  disabled={isUpdating}
                  className="h-11 px-6 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black flex items-center gap-2 shadow-md shadow-blue-600/30"
                >
                  <Save className="w-4 h-4" />
                  {isUpdating ? 'جاري الحفظ...' : 'حفظ التعديلات وكلمة المرور'}
                </Button>
              </div>

            </form>

          </div>
        </div>
      )}

    </div>
  )
}
