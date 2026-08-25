'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useStore } from '@/lib/store-context'
import { validateAndConsumeToken } from '@/lib/license-service'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Key, Building2, User, ShieldCheck, ArrowRight, Sparkles, CheckCircle2, Lock } from 'lucide-react'
import { toast } from 'sonner'

export default function StoreActivationPage() {
  const router = useRouter()
  const { activateOfflineSystem } = useStore()

  const [tokenInput, setTokenInput] = useState('')
  const [storeNameInput, setStoreNameInput] = useState('')
  const [ownerNameInput, setOwnerNameInput] = useState('')
  const [isActivating, setIsActivating] = useState(false)

  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault()

    const cleanToken = tokenInput.trim().toUpperCase()
    const cleanStore = storeNameInput.trim()
    const cleanOwner = ownerNameInput.trim()

    if (!cleanToken) {
      toast.error('يرجى إدخال كود التفعيل المستلم من إدارة النظام')
      return
    }
    if (!cleanStore) {
      toast.error('يرجى إدخال اسم المتجر أو الصيدلية')
      return
    }

    try {
      setIsActivating(true)
      const res = await validateAndConsumeToken(cleanToken, cleanStore, cleanOwner)

      if (!res.success) {
        toast.error(res.message)
        return
      }

      // Activate in store context
      activateOfflineSystem(cleanToken, cleanStore, res.businessType)
      toast.success(res.message)

      // Redirect to dashboard
      setTimeout(() => {
        router.push('/dashboard')
      }, 800)
    } catch (err: any) {
      toast.error('حدث خطأ أثناء التفعيل: ' + err.message)
    } finally {
      setIsActivating(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 relative overflow-hidden" dir="rtl">
      {/* Ambient background glows */}
      <div className="absolute top-1/4 -right-20 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -left-20 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-md w-full bg-slate-900/90 border border-slate-800/80 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl space-y-6 relative z-10">
        
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white mx-auto shadow-lg shadow-blue-600/30 border border-blue-400/30">
            <Key className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">
            تفعيل الاشتراك والترخيص
          </h1>
          <p className="text-xs text-slate-400">
            أدخل كود التفعيل (Token) الخاص بك لتشغيل المنظومة وضبط النشاط
          </p>
        </div>

        <form onSubmit={handleActivate} className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <Key className="w-3.5 h-3.5 text-blue-400" />
              كود الترخيص / التفعيل *
            </Label>
            <Input
              placeholder="مثال: ERP-2026-PHARM-Y01-XXXX"
              value={tokenInput}
              onChange={e => setTokenInput(e.target.value)}
              className="h-11 text-xs bg-slate-800/80 border-slate-700 rounded-xl font-mono text-center font-black tracking-widest text-blue-400"
              dir="ltr"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-blue-400" />
              اسم المنشأة أو المحل *
            </Label>
            <Input
              placeholder="مثال: صيدلية الشفاء أو ماركت البركة"
              value={storeNameInput}
              onChange={e => setStoreNameInput(e.target.value)}
              className="h-11 text-xs bg-slate-800/80 border-slate-700 rounded-xl font-bold text-white"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-blue-400" />
              اسم المسؤول أو المالك
            </Label>
            <Input
              placeholder="مثال: د. مصطفى حسام"
              value={ownerNameInput}
              onChange={e => setOwnerNameInput(e.target.value)}
              className="h-11 text-xs bg-slate-800/80 border-slate-700 rounded-xl font-bold text-white"
            />
          </div>

          <Button
            type="submit"
            disabled={isActivating}
            className="w-full h-12 text-sm font-black bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl shadow-lg shadow-blue-600/30 active:scale-95 transition-all mt-2 cursor-pointer"
          >
            <ShieldCheck className="w-4 h-4 ml-1.5" />
            {isActivating ? 'جاري التحقق والتفعيل...' : 'تفعيل المنظومة والبدء'}
          </Button>
        </form>

        <div className="pt-2 border-t border-slate-800 text-center">
          <p className="text-[11px] text-slate-500">
            للحصول على كود التفعيل أو تجديد الاشتراك، يرجى التواصل مع إدارة النظام.
          </p>
        </div>
      </div>
    </div>
  )
}
