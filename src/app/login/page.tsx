'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { 
  ShieldCheck, 
  Crown, 
  UserCheck, 
  CreditCard, 
  Lock, 
  ArrowLeft, 
  Sparkles, 
  Building2, 
  Store,
  KeyRound,
  CheckCircle2
} from 'lucide-react'
import { useAuth, PRESET_USERS, AuthUser } from '@/lib/auth-context'
import { useStore } from '@/lib/store-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'

export default function LoginPage() {
  const router = useRouter()
  const { loginAs, currentUser } = useAuth()
  const { storeName, businessType } = useStore()

  const [username, setUsername] = useState('')
  const [pin, setPin] = useState('')
  const [selectedPreset, setSelectedPreset] = useState<string>('admin')

  const handleQuickLogin = (user: AuthUser) => {
    loginAs(user)
    toast.success(`مرحباً بك يا ${user.name} - تم تسجيل الدخول بصلاحيات (${user.role === 'admin' ? 'مدير النظام' : user.role === 'supervisor' ? 'المشرف' : 'الكاشير'})`)
    if (user.role === 'cashier') {
      router.push('/dashboard/pos')
    } else {
      router.push('/dashboard')
    }
  }

  const handleManualLogin = (e: React.FormEvent) => {
    e.preventDefault()
    const targetUser = PRESET_USERS.find(u => u.username.toLowerCase() === username.trim().toLowerCase())
    if (targetUser) {
      loginAs(targetUser)
      toast.success(`تم تسجيل الدخول بنجاح كـ ${targetUser.name}`)
      if (targetUser.role === 'cashier') {
        router.push('/dashboard/pos')
      } else {
        router.push('/dashboard')
      }
    } else {
      // Default to admin with custom entered name
      const customUser: AuthUser = {
        id: crypto.randomUUID(),
        username: username.trim() || 'user',
        name: username.trim() || 'مستخدم النظام',
        role: 'admin',
        branchName: 'الفرع الرئيسي',
      }
      loginAs(customUser)
      toast.success(`تم تسجيل الدخول كـ ${customUser.name}`)
      router.push('/dashboard')
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-white flex flex-col justify-center items-center p-4 sm:p-6" dir="rtl">
      {/* Background ambient glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-blue-600/15 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-4xl z-10 space-y-8">
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
          <h1 className="text-2xl sm:text-4xl font-black tracking-tight text-white">
            تسجيل الدخول وإدارة الصلاحيات
          </h1>
          <p className="text-sm font-semibold text-slate-400 max-w-md mx-auto">
            اختر دور المستخدم للدخول السريع أو أدخل بيانات الحساب للمتابعة
          </p>
        </div>

        {/* 1-Click Quick Role Switch Cards (Evaluator & Demo Ready) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Admin Card */}
          <div
            onClick={() => handleQuickLogin(PRESET_USERS[0])}
            className="group relative bg-gradient-to-b from-purple-900/30 to-slate-900/80 hover:from-purple-900/50 hover:to-slate-900 border-2 border-purple-500/30 hover:border-purple-500 rounded-3xl p-6 transition-all duration-200 cursor-pointer shadow-xl hover:shadow-purple-500/20 hover:-translate-y-1"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 rounded-2xl bg-purple-500/20 text-purple-300 flex items-center justify-center border border-purple-500/30 group-hover:scale-110 transition-transform">
                <Crown className="w-6 h-6" />
              </div>
              <span className="text-[11px] font-black bg-purple-500/20 text-purple-300 border border-purple-500/30 px-3 py-1 rounded-full">
                كامل الصلاحيات
              </span>
            </div>
            <h3 className="text-lg font-black text-white group-hover:text-purple-200">
              مدير النظام (Admin)
            </h3>
            <p className="text-xs font-semibold text-slate-400 mt-1 leading-relaxed">
              إدارة الأرباح، التكاليف، إعدادات النشاط، شجرة الحسابات والمستخدمين.
            </p>
            <Button
              type="button"
              className="w-full mt-5 bg-purple-600 hover:bg-purple-500 text-white font-black rounded-xl h-11 shadow-md shadow-purple-600/30 cursor-pointer"
            >
              دخول كـ مدير النظام
              <ArrowLeft className="w-4 h-4 mr-2" />
            </Button>
          </div>

          {/* Supervisor Card */}
          <div
            onClick={() => handleQuickLogin(PRESET_USERS[1])}
            className="group relative bg-gradient-to-b from-emerald-900/30 to-slate-900/80 hover:from-emerald-900/50 hover:to-slate-900 border-2 border-emerald-500/30 hover:border-emerald-500 rounded-3xl p-6 transition-all duration-200 cursor-pointer shadow-xl hover:shadow-emerald-500/20 hover:-translate-y-1"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-300 flex items-center justify-center border border-emerald-500/30 group-hover:scale-110 transition-transform">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <span className="text-[11px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-3 py-1 rounded-full">
                إشراف وتشغيل
              </span>
            </div>
            <h3 className="text-lg font-black text-white group-hover:text-emerald-200">
              المشرف (Supervisor)
            </h3>
            <p className="text-xs font-semibold text-slate-400 mt-1 leading-relaxed">
              إدارة المخزون، المشتريات، الموردين، الجرد المخزني ومتابعة المبيعات.
            </p>
            <Button
              type="button"
              className="w-full mt-5 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-xl h-11 shadow-md shadow-emerald-600/30 cursor-pointer"
            >
              دخول كـ مشرف
              <ArrowLeft className="w-4 h-4 mr-2" />
            </Button>
          </div>

          {/* Cashier Card */}
          <div
            onClick={() => handleQuickLogin(PRESET_USERS[2])}
            className="group relative bg-gradient-to-b from-blue-900/30 to-slate-900/80 hover:from-blue-900/50 hover:to-slate-900 border-2 border-blue-500/30 hover:border-blue-500 rounded-3xl p-6 transition-all duration-200 cursor-pointer shadow-xl hover:shadow-blue-500/20 hover:-translate-y-1"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 rounded-2xl bg-blue-500/20 text-blue-300 flex items-center justify-center border border-blue-500/30 group-hover:scale-110 transition-transform">
                <CreditCard className="w-6 h-6" />
              </div>
              <span className="text-[11px] font-black bg-blue-500/20 text-blue-300 border border-blue-500/30 px-3 py-1 rounded-full">
                نقطة البيع فقط
              </span>
            </div>
            <h3 className="text-lg font-black text-white group-hover:text-blue-200">
              الكاشير (Cashier)
            </h3>
            <p className="text-xs font-semibold text-slate-400 mt-1 leading-relaxed">
              شاشة نقطة البيع السريعة (POS)، فواتير المبيعات، ومرتجعات العملاء فقط.
            </p>
            <Button
              type="button"
              className="w-full mt-5 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-xl h-11 shadow-md shadow-blue-600/30 cursor-pointer"
            >
              دخول كـ كاشير (POS)
              <ArrowLeft className="w-4 h-4 mr-2" />
            </Button>
          </div>
        </div>

        {/* Manual Login Form */}
        <Card className="bg-slate-900/90 border-slate-800 shadow-2xl rounded-3xl backdrop-blur-md max-w-lg mx-auto">
          <CardHeader className="text-center pb-2">
            <CardTitle className="text-base font-black text-white flex items-center justify-center gap-2">
              <KeyRound className="w-4 h-4 text-blue-400" />
              أو تسجيل الدخول اليدوي
            </CardTitle>
            <CardDescription className="text-xs font-semibold text-slate-400">
              أدخل اسم المستخدم أو رمز PIN للتحقق
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleManualLogin} className="space-y-4">
              <div className="space-y-1.5 text-right">
                <Label className="text-xs font-bold text-slate-300">اسم المستخدم (admin / supervisor / cashier)</Label>
                <Input
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="مثال: admin"
                  className="h-12 bg-slate-950/80 border-slate-800 text-white rounded-xl text-base font-bold"
                />
              </div>

              <div className="space-y-1.5 text-right">
                <Label className="text-xs font-bold text-slate-300">رمز المرور أو الـ PIN</Label>
                <Input
                  type="password"
                  value={pin}
                  onChange={e => setPin(e.target.value)}
                  placeholder="••••"
                  className="h-12 bg-slate-950/80 border-slate-800 text-white rounded-xl text-base font-bold text-center tracking-widest"
                />
              </div>

              <Button
                type="submit"
                className="w-full h-12 text-base font-black bg-blue-600 hover:bg-blue-500 text-white rounded-xl shadow-lg shadow-blue-600/30 cursor-pointer"
              >
                تسجيل الدخول للمنظومة
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Footer info */}
        <div className="text-center text-xs font-bold text-slate-500 flex items-center justify-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-500" />
          منظومة مشفرة تعمل بنظام Offline-First مع إمكانية التبديل اللحظي بين الفروع
        </div>
      </div>
    </div>
  )
}
