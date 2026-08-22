'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { 
  ShieldCheck, 
  Lock, 
  Mail, 
  KeyRound, 
  Eye, 
  EyeOff, 
  Store,
  CheckCircle2,
  LogIn,
  AlertCircle
} from 'lucide-react'
import { useAuth, DEFAULT_ADMIN } from '@/lib/auth-context'
import { useStore } from '@/lib/store-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'

export default function LoginPage() {
  const router = useRouter()
  const { login } = useAuth()
  const { storeName, businessType } = useStore()

  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage('')

    if (!identifier.trim()) {
      setErrorMessage('يرجى إدخال البريد الإلكتروني أو اسم المستخدم')
      return
    }
    if (!password.trim()) {
      setErrorMessage('يرجى إدخال كلمة المرور أو رمز PIN')
      return
    }

    try {
      setIsSubmitting(true)
      const res = await login(identifier.trim(), password.trim())
      if (res.success) {
        toast.success('تم التحقق وتسجيل الدخول بنجاح')
        router.push('/dashboard')
      } else {
        setErrorMessage(res.error || 'بيانات الدخول غير صحيحة')
        toast.error(res.error || 'فشل تسجيل الدخول')
      }
    } catch (err: any) {
      setErrorMessage('حدث خطأ غير متوقع: ' + err.message)
      toast.error('حدث خطأ أثناء الاتصال')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-white flex flex-col justify-center items-center p-4 sm:p-6 select-none" dir="rtl">
      {/* Background ambient glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-blue-600/15 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md z-10 space-y-6">
        {/* Brand & Store Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-3 bg-white/5 border border-white/10 px-5 py-2.5 rounded-2xl backdrop-blur-md shadow-xl">
            <img src="/icon.png" alt="ERP System" className="w-9 h-9 rounded-xl object-cover" />
            <div className="text-right">
              <span className="text-lg font-black tracking-tight text-white">
                منظومة <span className="text-blue-400">ERP المتكاملة</span>
              </span>
              <p className="text-[11px] font-bold text-slate-400">
                {storeName}
              </p>
            </div>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
            تسجيل الدخول للنظام
          </h1>
          <p className="text-xs sm:text-sm font-semibold text-slate-400">
            أدخل البريد الإلكتروني وكلمة المرور للوصول لحسابك وصلاحياتك
          </p>
        </div>

        {/* Commercial Secure Login Form */}
        <Card className="bg-slate-900/90 border-slate-800 shadow-2xl rounded-3xl backdrop-blur-md">
          <CardHeader className="text-center pb-3">
            <CardTitle className="text-base font-black text-white flex items-center justify-center gap-2">
              <Lock className="w-4 h-4 text-blue-400" />
              بوابة الدخول الموحدة
            </CardTitle>
            <CardDescription className="text-xs font-semibold text-slate-400">
              الوصول مشفر ومحمي حسب صلاحيات كل مستخدم
            </CardDescription>
          </CardHeader>
          <CardContent>
            {errorMessage && (
              <div className="mb-4 p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-bold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-1.5 text-right">
                <Label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-blue-400" />
                  البريد الإلكتروني أو اسم المستخدم
                </Label>
                <Input
                  value={identifier}
                  onChange={e => {
                    setIdentifier(e.target.value)
                    setErrorMessage('')
                  }}
                  placeholder="admin@erp.com أو اسم المستخدم"
                  className="h-12 bg-slate-950/80 border-slate-800 text-white rounded-xl text-sm font-bold placeholder:text-slate-600 focus:border-blue-500"
                  autoFocus
                />
              </div>

              <div className="space-y-1.5 text-right">
                <Label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-blue-400" />
                  كلمة المرور / الرمز السري (PIN)
                </Label>
                <div className="relative">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => {
                      setPassword(e.target.value)
                      setErrorMessage('')
                    }}
                    placeholder="••••••••"
                    className="h-12 bg-slate-950/80 border-slate-800 text-white rounded-xl text-sm font-bold pl-10 placeholder:text-slate-600 focus:border-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute left-3 top-3.5 text-slate-400 hover:text-white transition-colors cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full h-12 text-base font-black bg-blue-600 hover:bg-blue-500 text-white rounded-xl shadow-lg shadow-blue-600/30 transition-all cursor-pointer flex items-center justify-center gap-2 mt-2"
              >
                <LogIn className="w-5 h-5" />
                {isSubmitting ? 'جاري التحقق...' : 'تسجيل الدخول'}
              </Button>
            </form>

            {/* Admin Initial Access Note */}
            <div className="mt-5 p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-[11px] text-slate-400 leading-relaxed font-semibold">
              <div className="flex items-center gap-1.5 text-blue-400 font-bold mb-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>بيانات الحساب الرئيسي للنظام:</span>
              </div>
              <p>البريد: <strong className="text-slate-200 font-mono">admin@erp.com</strong> | كلمة المرور: <strong className="text-slate-200 font-mono">admin123</strong></p>
              <p className="text-[10px] text-slate-500 mt-0.5">يمكنك إضافة وتعديل كاشيرات وموظفي الفرع من شاشة "الموظفين والصلاحيات".</p>
            </div>
          </CardContent>
        </Card>

        {/* Security Footer */}
        <div className="text-center text-xs font-bold text-slate-500 flex items-center justify-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-500" />
          نظام محمي ومشفر بالكامل مع عزل تام لصلاحيات كل موظف
        </div>
      </div>
    </div>
  )
}
