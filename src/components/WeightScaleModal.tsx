'use client'

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Scale, Banknote, CheckCircle2, Weight, X } from 'lucide-react'
import { cleanPositivePrice, money } from '@/lib/finance'

interface WeightScaleModalProps {
  isOpen: boolean
  onClose: () => void
  item: {
    id: string
    name: string
    sell_price?: number
    unit_price?: number
    quantity?: number
  } | null
  onConfirm: (quantity: number) => void
}

export function WeightScaleModal({ isOpen, onClose, item, onConfirm }: WeightScaleModalProps) {
  const [mode, setMode] = useState<'weight' | 'money'>('weight')
  const [grams, setGrams] = useState<string>('250')
  const [cashAmount, setCashAmount] = useState<string>('10')

  const pricePerKg = item ? cleanPositivePrice(item.sell_price || item.unit_price || 0) : 0

  useEffect(() => {
    if (item && isOpen) {
      if (item.quantity && item.quantity > 0) {
        setGrams(Math.round(item.quantity * 1000).toString())
      } else {
        setGrams('250') // Default 250g (Quarter Kg)
      }
      setCashAmount('10')
      setMode('weight')
    }
  }, [item, isOpen])

  if (!isOpen || !item) return null

  // Calculations
  const numericGrams = Math.max(1, parseFloat(grams) || 0)
  const kgFromGrams = Math.round((numericGrams / 1000) * 1000) / 1000
  const priceFromGrams = money((numericGrams / 1000) * pricePerKg)

  const numericCash = Math.max(0.5, parseFloat(cashAmount) || 0)
  const kgFromCash = pricePerKg > 0 ? Math.round((numericCash / pricePerKg) * 1000) / 1000 : 0
  const gramsFromCash = Math.round(kgFromCash * 1000)

  const handleQuickWeight = (g: number) => {
    setGrams(g.toString())
    setMode('weight')
  }

  const handleQuickCash = (amt: number) => {
    setCashAmount(amt.toString())
    setMode('money')
  }

  const handleSave = () => {
    if (mode === 'weight') {
      onConfirm(kgFromGrams)
    } else {
      onConfirm(kgFromCash)
    }
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs select-none" dir="rtl">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-150">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center shadow-md">
              <Scale className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-black text-white">{item.name}</h3>
              <p className="text-xs font-bold text-blue-100 font-mono">
                سعر الكيلو: {pricePerKg.toFixed(2)} ج.م / كجم
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-white/80 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Selector Tabs */}
        <div className="p-6 space-y-6">
          <div className="grid grid-cols-2 gap-2 p-1.5 bg-slate-100 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700/80">
            <button
              type="button"
              onClick={() => setMode('weight')}
              className={`flex items-center justify-center gap-2 py-3 rounded-xl font-black text-xs sm:text-sm transition-all cursor-pointer ${
                mode === 'weight'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Weight className="w-4 h-4" />
              <span>البيع بالوزن (جرامات / كجم)</span>
            </button>
            <button
              type="button"
              onClick={() => setMode('money')}
              className={`flex items-center justify-center gap-2 py-3 rounded-xl font-black text-xs sm:text-sm transition-all cursor-pointer ${
                mode === 'money'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Banknote className="w-4 h-4" />
              <span>البيع بمبلغ مالي (مثال: بـ 10 ج)</span>
            </button>
          </div>

          {/* Mode 1: Weight in Grams */}
          {mode === 'weight' && (
            <div className="space-y-5">
              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  أدخل الوزن بالجرام (أو اضغط على أحد الأوزان السريعة):
                </Label>
                <div className="relative">
                  <Input
                    type="number"
                    min="1"
                    step="1"
                    value={grams}
                    onChange={(e) => setGrams(e.target.value)}
                    className="h-14 text-2xl font-black font-mono text-center bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700 rounded-2xl pl-16 text-blue-600 dark:text-blue-400"
                    autoFocus
                  />
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-sm text-slate-400">
                    جرام
                  </span>
                </div>
              </div>

              {/* Quick Weight Buttons */}
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-500 dark:text-slate-400">أوزان شائعة وسريعة:</Label>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { label: 'ثمن كجم (125g)', val: 125 },
                    { label: 'ربع كجم (250g)', val: 250 },
                    { label: 'ثلث كجم (333g)', val: 333 },
                    { label: 'نصف كجم (500g)', val: 500 },
                    { label: 'إلا ربع (750g)', val: 750 },
                    { label: '1 كيلو (1000g)', val: 1000 },
                    { label: '1.5 كجم (1500g)', val: 1500 },
                    { label: '2 كيلو (2000g)', val: 2000 },
                  ].map((btn) => (
                    <button
                      key={btn.val}
                      type="button"
                      onClick={() => handleQuickWeight(btn.val)}
                      className={`p-2.5 rounded-xl border text-xs font-black transition-all cursor-pointer active:scale-95 ${
                        numericGrams === btn.val
                          ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-600/25'
                          : 'bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                      }`}
                    >
                      {btn.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Calculated Summary Card */}
              <div className="p-4 rounded-2xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/60 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-500 dark:text-slate-400">الوزن المحسوب بالكيلوجرام:</p>
                  <p className="text-lg font-black font-mono text-slate-900 dark:text-white">
                    {kgFromGrams.toFixed(3)} كجم ({numericGrams} جم)
                  </p>
                </div>
                <div className="text-left">
                  <p className="text-xs font-bold text-slate-500 dark:text-slate-400">السعر الإجمالي المطلوب:</p>
                  <p className="text-2xl font-black font-mono text-blue-600 dark:text-blue-400">
                    {priceFromGrams.toFixed(2)} ج.م
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Mode 2: Specific Cash Amount */}
          {mode === 'money' && (
            <div className="space-y-5">
              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  المبلغ المطلوب (مثال: العميل يريد جبنة بـ 10 ج):
                </Label>
                <div className="relative">
                  <Input
                    type="number"
                    min="0.5"
                    step="1"
                    value={cashAmount}
                    onChange={(e) => setCashAmount(e.target.value)}
                    className="h-14 text-2xl font-black font-mono text-center bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700 rounded-2xl pl-16 text-emerald-600 dark:text-emerald-400"
                    autoFocus
                  />
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-sm text-slate-400">
                    ج.م
                  </span>
                </div>
              </div>

              {/* Quick Cash Buttons */}
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-500 dark:text-slate-400">مبالغ نقدية شائعة:</Label>
                <div className="grid grid-cols-4 gap-2">
                  {[5, 10, 15, 20, 25, 30, 50, 100].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => handleQuickCash(amt)}
                      className={`p-2.5 rounded-xl border text-xs font-black transition-all cursor-pointer active:scale-95 ${
                        numericCash === amt
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-600/25'
                          : 'bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                      }`}
                    >
                      {amt} ج.م
                    </button>
                  ))}
                </div>
              </div>

              {/* Calculated Summary Card */}
              <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-500 dark:text-slate-400">الوزن الناتج الذي سيُخصم من المخزن:</p>
                  <p className="text-lg font-black font-mono text-slate-900 dark:text-white">
                    {kgFromCash.toFixed(3)} كجم ({gramsFromCash} جم)
                  </p>
                </div>
                <div className="text-left">
                  <p className="text-xs font-bold text-slate-500 dark:text-slate-400">المبلغ المطلوب بدقة:</p>
                  <p className="text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400">
                    {numericCash.toFixed(2)} ج.م
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Action Footer */}
        <div className="p-6 pt-0 flex gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="flex-1 h-14 rounded-2xl font-bold border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 cursor-pointer"
          >
            إلغاء
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            className={`flex-2 h-14 rounded-2xl font-black text-base text-white shadow-lg active:scale-95 transition-all cursor-pointer ${
              mode === 'weight'
                ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-600/30'
                : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/30'
            }`}
          >
            <CheckCircle2 className="w-5 h-5 ml-2" />
            إضافة الصنف بالوزن للفاتورة
          </Button>
        </div>
      </div>
    </div>
  )
}
