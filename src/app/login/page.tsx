'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { 
  ShieldCheck, 
  Lock, 
  Mail, 
  Eye, 
  EyeOff, 
  User, 
  Sparkles,
  Zap,
  Layers,
  CheckCircle,
  AlertCircle,
  Pill,
  ShoppingCart,
  Shirt,
  Building2,
  Utensils
} from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { useStore } from '@/lib/store-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'

export default function LoginPage() {
  const router = useRouter()
  const { login, registerAdmin } = useAuth()
  const { storeName, businessType } = useStore()

  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage('')

    if (!identifier.trim()) {
      setErrorMessage('يرجى إدخال البريد الإلكتروني أو اسم المستخدم')
      return
    }
    if (!password.trim()) {
      setErrorMessage('يرجى إدخال كلمة المرور')
      return
    }

    try {
      setIsSubmitting(true)
      const res = await login(identifier.trim(), password.trim())
      if (res.success) {
        toast.success('تم تسجيل الدخول بنجاح')
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

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage('')

    if (!name.trim() || !identifier.trim() || !password.trim()) {
      setErrorMessage('يرجى ملء جميع الحقول المطلوبة')
      return
    }

    try {
      setIsSubmitting(true)
      const res = await registerAdmin(name.trim(), identifier.trim(), password.trim())
      if (res.success) {
        toast.success('تم إنشاء حساب المسؤول وتسجيل الدخول بنجاح')
        router.push('/dashboard')
      } else {
        setErrorMessage(res.error || 'فشل إنشاء الحساب')
        toast.error(res.error || 'فشل إنشاء الحساب')
      }
    } catch (err: any) {
      setErrorMessage('حدث خطأ أثناء إنشاء الحساب: ' + err.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const getBusinessIcon = () => {
    switch (businessType) {
      case 'pharmacy':
        return <Pill className="w-16 h-16 text-blue-200" />
      case 'clothing':
        return <Shirt className="w-16 h-16 text-blue-200" />
      case 'supermarket':
        return <ShoppingCart className="w-16 h-16 text-blue-200" />
      case 'restaurant':
        return <Utensils className="w-16 h-16 text-blue-200" />
      default:
        return <Building2 className="w-16 h-16 text-blue-200" />
    }
  }

  const getBusinessSubTitle = () => {
    switch (businessType) {
      case 'pharmacy':
        return 'نظام إدارة الصيدليات المتكامل'
      case 'clothing':
        return 'نظام إدارة محلات ومخازن الملابس المتكامل'
      case 'supermarket':
        return 'نظام إدارة السوبر ماركت ونقاط البيع'
      case 'restaurant':
        return 'نظام إدارة المطاعم والكافيهات المتكامل'
      default:
        return 'نظام إدارة المنشآت والأنشطة التجارية المتكامل'
    }
  }

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 flex flex-col lg:flex-row select-none" dir="rtl">
      
      {/* ─── 1. Left Section (White / Light Clean Auth Card) ─── */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12 lg:p-16 order-2 lg:order-1">
        <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-xl shadow-slate-200/50 dark:shadow-none border border-slate-100 dark:border-slate-800 p-8 sm:p-10 space-y-6">
          
          {/* Header */}
          <div className="text-right space-y-1.5">
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
              {mode === 'login' ? 'تسجيل الدخول' : 'إنشاء حساب مسؤول'}
            </h1>
            <p className="text-xs sm:text-sm font-semibold text-slate-500 dark:text-slate-400">
              {mode === 'login' ? 'سجل دخولك الآن للوصول إلى لوحة التحكم.' : 'أدخل بياناتك لإنشاء حساب المدير العام الأول للنظام.'}
            </p>
          </div>

          {/* Error Alert Box */}
          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/60 text-rose-600 dark:text-rose-400 text-xs font-bold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Form */}
          {mode === 'login' ? (
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div className="space-y-1.5 text-right">
                <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  البريد الإلكتروني أو اسم المستخدم
                </Label>
                <div className="relative">
                  <Input
                    type="text"
                    value={identifier}
                    onChange={e => {
                      setIdentifier(e.target.value)
                      setErrorMessage('')
                    }}
                    placeholder="example@domain.com"
                    className="h-12 bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl text-sm font-semibold pl-10 focus:border-blue-500"
                    autoFocus
                  />
                  <div className="absolute left-3.5 top-3.5 text-slate-400 pointer-events-none">
                    <User className="w-5 h-5" />
                  </div>
                </div>
              </div>

              <div className="space-y-1.5 text-right">
                <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  كلمة المرور
                </Label>
                <div className="relative">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => {
                      setPassword(e.target.value)
                      setErrorMessage('')
                    }}
                    placeholder="••••••••••••"
                    className="h-12 bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl text-sm font-semibold pl-10 pr-10 focus:border-blue-500 font-mono"
                  />
                  <div className="absolute right-3.5 top-3.5 text-slate-400 pointer-events-none">
                    <Lock className="w-5 h-5" />
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute left-3.5 top-3.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <div className="text-right">
                <button
                  type="button"
                  onClick={() => toast.info('يمكن للمدير إعادة تعيين كلمات مرور الموظفين من لوحة تحكم الموظفين.')}
                  className="text-xs font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400 hover:underline cursor-pointer"
                >
                  نسيت كلمة المرور؟
                </button>
              </div>

              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full h-12 text-base font-black bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-xl shadow-lg shadow-blue-600/30 transition-all cursor-pointer mt-2"
              >
                {isSubmitting ? 'جاري تسجيل الدخول...' : 'تسجيل الدخول'}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleRegisterSubmit} className="space-y-4">
              <div className="space-y-1.5 text-right">
                <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  اسم المسؤول / المدير الكامل *
                </Label>
                <Input
                  type="text"
                  value={name}
                  onChange={e => {
                    setName(e.target.value)
                    setErrorMessage('')
                  }}
                  placeholder="مثال: المدير العام"
                  className="h-12 bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl text-sm font-semibold focus:border-blue-500"
                  autoFocus
                />
              </div>

              <div className="space-y-1.5 text-right">
                <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  البريد الإلكتروني للدخول *
                </Label>
                <Input
                  type="email"
                  value={identifier}
                  onChange={e => {
                    setIdentifier(e.target.value)
                    setErrorMessage('')
                  }}
                  placeholder="admin@yourdomain.com"
                  className="h-12 bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl text-sm font-semibold focus:border-blue-500 font-mono"
                  dir="ltr"
                />
              </div>

              <div className="space-y-1.5 text-right">
                <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  تعيين كلمة المرور الجديدة *
                </Label>
                <div className="relative">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => {
                      setPassword(e.target.value)
                      setErrorMessage('')
                    }}
                    placeholder="اختر كلمة مرور قوية"
                    className="h-12 bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl text-sm font-semibold pl-10 focus:border-blue-500 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute left-3.5 top-3.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full h-12 text-base font-black bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-xl shadow-lg shadow-blue-600/30 transition-all cursor-pointer mt-2"
              >
                {isSubmitting ? 'جاري الإنشاء...' : 'إنشاء حساب المدير'}
              </Button>
            </form>
          )}

          {/* Toggle Mode */}
          <div className="text-center pt-2 border-t border-slate-100 dark:border-slate-800">
            {mode === 'login' ? (
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                ليس لديك حساب؟{' '}
                <button
                  type="button"
                  onClick={() => {
                    setMode('register')
                    setErrorMessage('')
                  }}
                  className="font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                >
                  إنشاء حساب جديد
                </button>
              </p>
            ) : (
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                لديك حساب بالفعل؟{' '}
                <button
                  type="button"
                  onClick={() => {
                    setMode('login')
                    setErrorMessage('')
                  }}
                  className="font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                >
                  تسجيل الدخول
                </button>
              </p>
            )}
          </div>

        </div>
      </div>

      {/* ─── 2. Right Section (Dark Royal Navy Blue Showcase matching Image 3) ─── */}
      <div className="w-full lg:w-1/2 bg-gradient-to-br from-[#0c234a] via-[#0f2d5e] to-[#0a1936] text-white flex flex-col items-center justify-between p-8 sm:p-12 lg:p-16 text-center order-1 lg:order-2 border-b lg:border-b-0 lg:border-r border-blue-900/40">
        
        {/* Top/Center Branding Content */}
        <div className="w-full max-w-lg my-auto space-y-6">
          
          {/* Logo Circular Badge with glowing outline */}
          <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-full bg-white/10 border-2 border-white/25 backdrop-blur-md flex items-center justify-center mx-auto shadow-2xl shadow-blue-500/20 ring-8 ring-white/5">
            {getBusinessIcon()}
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-white">
              منظومة الإدارة الشاملة
            </h2>
            <p className="text-sm sm:text-base font-semibold text-blue-200">
              {getBusinessSubTitle()}
            </p>
          </div>

          {/* Floating Feature Card */}
          <div className="bg-white/10 border border-white/15 backdrop-blur-md rounded-2xl p-6 max-w-md mx-auto shadow-2xl text-right">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-lg bg-blue-500/30 border border-blue-400/30 flex items-center justify-center text-blue-200">
                <Sparkles className="w-4 h-4" />
              </div>
              <h3 className="text-base font-black text-white">
                {businessType === 'pharmacy' ? 'نظام إدارة الصيدليات المتطور' : 'نظام إدارة المنشآت المتطور'}
              </h3>
            </div>
            <p className="text-xs font-semibold text-blue-100/90 leading-relaxed">
              الجيل القادم من حلول إدارة العمليات، صمم خصيصاً ليناسب احتياجاتك بدقة وسرعة وأمان فائق.
            </p>
          </div>

        </div>

        {/* Bottom Security / Trust Badges */}
        <div className="w-full pt-8 flex flex-wrap items-center justify-center gap-6 text-xs font-bold text-blue-200/80 border-t border-white/10">
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            تشفير Enterprise
          </span>
          <span className="flex items-center gap-1.5">
            <Zap className="w-4 h-4 text-amber-400" />
            أداء فائق
          </span>
          <span className="flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-cyan-400" />
            هجين (سحابي/محلي)
          </span>
        </div>

      </div>

    </div>
  )
}
