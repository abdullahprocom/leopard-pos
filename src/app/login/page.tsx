'use client'

import React, { useState } from 'react'
import Link from 'next/link'
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
  const { login } = useAuth()
  const { storeName, businessType } = useStore()

  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
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

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col lg:flex-row-reverse select-none" dir="rtl">
      
      {/* Login Authentication Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-10 lg:p-14 bg-gradient-to-b from-slate-950 via-[#0a1222] to-slate-950 min-h-screen relative overflow-hidden">
        
        {/* Ambient Glow */}
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-blue-600/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-indigo-600/15 rounded-full blur-3xl pointer-events-none" />

        <div className="w-full max-w-xl bg-[#0b162c]/95 dark:bg-[#0b162c]/95 backdrop-blur-2xl rounded-[2.5rem] shadow-[0_25px_80px_rgba(0,0,0,0.65)] border border-slate-700/70 p-8 sm:p-12 lg:p-14 space-y-8 relative z-10">
          
          {/* Header with Icon Badge */}
          <div className="text-right space-y-3">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white shadow-xl shadow-blue-600/30 ring-4 ring-blue-500/10 mb-2">
              <Lock className="w-7 h-7" />
            </div>
            
            <div>
              <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
                تسجيل الدخول
              </h1>
              <p className="text-sm sm:text-base font-bold text-slate-400 mt-2">
                سجل دخولك الآن للوصول إلى لوحة التحكم والعمليات.
              </p>
            </div>
          </div>

          {/* Error Alert Box */}
          {errorMessage && (
            <div className="p-4 rounded-2xl bg-rose-950/40 border border-rose-800/80 text-rose-300 text-sm font-bold flex items-center gap-3 animate-shake">
              <AlertCircle className="w-5 h-5 shrink-0 text-rose-400" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleLoginSubmit} className="space-y-6">
            
            {/* Identifier Input */}
            <div className="space-y-2.5 text-right">
              <Label className="text-sm font-black text-slate-200 flex items-center gap-2">
                <User className="w-4 h-4 text-blue-400" />
                <span>البريد الإلكتروني أو اسم المستخدم</span>
              </Label>
              <div className="relative">
                <Input
                  type="text"
                  value={identifier}
                  onChange={e => {
                    setIdentifier(e.target.value)
                    setErrorMessage('')
                  }}
                  placeholder="أدخل البريد أو اسم المستخدم..."
                  className="h-14 sm:h-15 bg-[#0f1f3d] border-slate-700 text-white rounded-2xl text-base font-bold px-4 pl-12 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 shadow-inner placeholder:text-slate-500 transition-all"
                  autoFocus
                />
                <div className="absolute left-4 top-4 sm:top-4.5 text-slate-400 pointer-events-none">
                  <Mail className="w-5 h-5" />
                </div>
              </div>
            </div>

            {/* Password Input */}
            <div className="space-y-2.5 text-right">
              <Label className="text-sm font-black text-slate-200 flex items-center gap-2">
                <Lock className="w-4 h-4 text-blue-400" />
                <span>كلمة المرور</span>
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
                  className="h-14 sm:h-15 bg-[#0f1f3d] border-slate-700 text-white rounded-2xl text-base font-bold px-4 pr-4 pl-12 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 shadow-inner font-mono placeholder:text-slate-500 transition-all tracking-wider"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute left-4 top-4 sm:top-4.5 text-slate-400 hover:text-white transition-colors cursor-pointer p-0.5"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* Forgot Password Link */}
            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                onClick={() => toast.info('يرجى مراجعة مدير النظام لإعادة تعيين بيانات الحساب أو كلمة المرور.')}
                className="text-xs sm:text-sm font-black text-blue-400 hover:text-blue-300 transition-colors cursor-pointer"
              >
                نسيت كلمة المرور؟
              </button>
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-14 sm:h-15 text-lg font-black bg-gradient-to-r from-blue-600 via-blue-500 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-2xl shadow-xl shadow-blue-600/35 hover:shadow-blue-600/50 hover:scale-[1.01] active:scale-[0.98] transition-all cursor-pointer mt-3"
            >
              {isSubmitting ? 'جاري تسجيل الدخول...' : 'تسجيل الدخول'}
            </Button>
          </form>

          {/* Enterprise Security Note & Activation Link */}
          <div className="pt-4 border-t border-slate-800 space-y-2.5">
            <div className="flex items-center justify-center gap-2 text-xs sm:text-sm font-black text-slate-400 bg-slate-900/80 border border-slate-800 py-3 px-4 rounded-2xl">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>منظومة إدارية مغلقة ومحمية — يتم منح الصلاحيات عبر الإدارة</span>
            </div>

            <div className="text-center">
              <Link
                href="/activate"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-400 hover:text-indigo-300 transition-colors"
              >
                <span>🔑 لديك كود تفعيل وترخيص جديد؟ اضغط هنا لتفعيل متجرك</span>
              </Link>
            </div>
          </div>

        </div>
      </div>

      {/* Brand Showcase Panel */}
      <div className="w-full lg:w-1/2 bg-gradient-to-br from-[#0c234a] via-[#0f2d5e] to-[#071329] text-white flex flex-col items-center justify-between p-8 sm:p-12 lg:p-16 text-center border-t lg:border-t-0 lg:border-r border-blue-900/40 relative overflow-hidden">
        
        {/* Background Decorative Rings */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Top/Center Branding Content */}
        <div className="w-full max-w-lg my-auto space-y-8 relative z-10">
          
          {/* Logo Circular Badge with glowing outline */}
          <div className="w-32 h-32 sm:w-36 sm:h-36 rounded-full bg-gradient-to-tr from-blue-600/30 to-indigo-500/30 border-2 border-white/30 backdrop-blur-xl flex items-center justify-center mx-auto shadow-2xl shadow-blue-500/30 ring-8 ring-white/10">
            {getBusinessIcon()}
          </div>

          <div className="space-y-3">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-white">
              منظومة الإدارة الشاملة
            </h2>
            <p className="text-base sm:text-lg font-bold text-blue-200/90">
              نظام إدارة الأنشطة التجارية المتكامل والمستقل
            </p>
          </div>

          {/* Floating Feature Card */}
          <div className="bg-white/10 border border-white/20 backdrop-blur-xl rounded-3xl p-7 max-w-md mx-auto shadow-2xl text-right space-y-2.5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/40 border border-blue-400/40 flex items-center justify-center text-blue-200 shadow-md">
                <Sparkles className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-black text-white">
                نظام إدارة متطور وموثوق
              </h3>
            </div>
            <p className="text-sm font-semibold text-blue-100/90 leading-relaxed">
              الجيل القادم من حلول نقاط البيع وإدارة العمليات، صمم خصيصاً ليناسب احتياجاتك بدقة وسرعة وأمان فائق.
            </p>
          </div>

        </div>

        {/* Bottom Security / Trust Badges */}
        <div className="w-full pt-8 flex flex-wrap items-center justify-center gap-8 text-sm font-black text-blue-200 border-t border-white/10 relative z-10">
          <span className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            تشفير Enterprise
          </span>
          <span className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-amber-400" />
            أداء فائق
          </span>
          <span className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-cyan-400" />
            هجين (سحابي / محلي)
          </span>
        </div>

      </div>

    </div>
  )
}
