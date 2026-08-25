'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/lib/db'
import { useStore } from '@/lib/store-context'
import { generateLicenseToken, toggleStoreStatus } from '@/lib/license-service'
import { resolveSystemError } from '@/lib/logger'
import { runFullSystemBenchmark, BenchmarkReport } from '@/lib/benchmark'
import type { BusinessType, LicenseDuration, LicenseToken, SystemErrorLog, TenantStoreRecord } from '@/lib/types'
import { 
  ShieldAlert, Key, Users, Building2, Terminal, AlertTriangle, 
  CheckCircle2, Clock, Play, Download, Copy, Check, Eye, X, 
  RefreshCw, Power, Server, Cpu, HardDrive, Wifi, Sparkles, Filter, 
  Search, FileText
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'

export default function SuperAdminPage() {
  const [activeTab, setActiveTab] = useState<'stores' | 'tokens' | 'errors' | 'benchmark'>('stores')

  // ─── Token Generator Form State ───
  const [tokenType, setTokenType] = useState<BusinessType>('pharmacy')
  const [tokenDuration, setTokenDuration] = useState<LicenseDuration>('1_year')
  const [tokenClientName, setTokenClientName] = useState('')
  const [tokenClientPhone, setTokenClientPhone] = useState('')
  const [tokenNotes, setTokenNotes] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [copiedToken, setCopiedToken] = useState<string | null>(null)

  // ─── Filters & Search ───
  const [storeSearch, setStoreSearch] = useState('')
  const [errorSearch, setErrorSearch] = useState('')
  const [errorSeverityFilter, setErrorSeverityFilter] = useState<string>('all')
  const [selectedError, setSelectedError] = useState<SystemErrorLog | null>(null)

  // ─── Benchmark State ───
  const [benchmarkReport, setBenchmarkReport] = useState<BenchmarkReport | null>(null)
  const [isRunningBenchmark, setIsRunningBenchmark] = useState(false)

  // ─── Database Live Queries ───
  const tokens = useLiveQuery(
    () => db.license_tokens.reverse().sortBy('created_at')
  ) || []

  const tenantStores = useLiveQuery(
    () => db.tenant_stores.reverse().sortBy('created_at')
  ) || []

  const errorLogs = useLiveQuery(
    () => db.system_error_logs.reverse().sortBy('created_at')
  ) || []

  // Seed default sample tenant store if empty
  useEffect(() => {
    async function seedDefaults() {
      const storeCount = await db.tenant_stores.count()
      if (storeCount === 0) {
        const sample: TenantStoreRecord = {
          id: crypto.randomUUID(),
          store_name: 'صيدلية النور الحديثة',
          owner_name: 'د. أحمد مصطفى',
          owner_phone: '01012345678',
          business_type: 'pharmacy',
          status: 'active',
          token: 'ERP-2026-PHARM-Y01-A99K-8822',
          created_at: new Date(Date.now() - 10 * 86400000).toISOString(),
          expires_at: new Date(Date.now() + 355 * 86400000).toISOString(),
          last_active_at: new Date().toISOString(),
          total_items: 420,
          total_sales_count: 1560,
          total_revenue: 89400
        }
        await db.tenant_stores.put(sample)
      }
    }
    seedDefaults()
  }, [])

  // Auto-run benchmark on first load
  useEffect(() => {
    handleRunBenchmark()
  }, [])

  // Handle Token Generation
  const handleGenerateToken = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      setIsGenerating(true)
      const tokenObj = await generateLicenseToken({
        business_type: tokenType,
        duration: tokenDuration,
        client_name: tokenClientName,
        client_phone: tokenClientPhone,
        notes: tokenNotes
      })

      toast.success(`تم إنشاء كود التفعيل: ${tokenObj.token}`)
      setTokenClientName('')
      setTokenClientPhone('')
      setTokenNotes('')
    } catch (err: any) {
      toast.error('فشل إنشاء الكود: ' + err.message)
    } finally {
      setIsGenerating(false)
    }
  }

  const handleCopyToken = (tokenStr: string) => {
    navigator.clipboard.writeText(tokenStr)
    setCopiedToken(tokenStr)
    toast.success('تم نسخ كود التفعيل بنجاح!')
    setTimeout(() => setCopiedToken(null), 2500)
  }

  // Handle Benchmark Run
  const handleRunBenchmark = async () => {
    setIsRunningBenchmark(true)
    try {
      const report = await runFullSystemBenchmark()
      setBenchmarkReport(report)
      toast.success('تم إكمال اختبار السرعة والأداء بنجاح!')
    } catch (err: any) {
      toast.error('حدث خطأ أثناء فحص الأداء: ' + err.message)
    } finally {
      setIsRunningBenchmark(false)
    }
  }

  // Filtered Lists
  const filteredStores = useMemo(() => {
    return tenantStores.filter(s =>
      s.store_name.toLowerCase().includes(storeSearch.toLowerCase()) ||
      s.owner_name.toLowerCase().includes(storeSearch.toLowerCase()) ||
      s.token.toLowerCase().includes(storeSearch.toLowerCase())
    )
  }, [tenantStores, storeSearch])

  const filteredErrors = useMemo(() => {
    return errorLogs.filter(err => {
      const matchesSearch = (err.message || '').toLowerCase().includes(errorSearch.toLowerCase()) ||
        (err.store_name || '').toLowerCase().includes(errorSearch.toLowerCase()) ||
        (err.page_url || '').toLowerCase().includes(errorSearch.toLowerCase())
      const matchesSeverity = errorSeverityFilter === 'all' || err.severity === errorSeverityFilter
      return matchesSearch && matchesSeverity
    })
  }, [errorLogs, errorSearch, errorSeverityFilter])

  return (
    <div className="space-y-4 pb-16 select-none w-full" dir="rtl">
      {/* ── Header Banner ── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-gradient-to-r from-slate-900 via-slate-900 to-indigo-950 p-6 rounded-3xl border border-indigo-900/40 shadow-xl text-white">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400 shadow-lg">
            <Server className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black tracking-tight">
                لوحة الإدارة المركزية (Super Admin & SaaS Engine)
              </h1>
              <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-400/30 px-2 py-0.5 rounded-full font-bold">
                إدارة المنظومة
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-1">
              التحكم في تراخيص واشتراكات المتاجر، مراقبة الأخطاء عن بُعد، واختبار كفاءة الأجهزة الضعيفة
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={handleRunBenchmark}
            disabled={isRunningBenchmark}
            className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black h-10 px-4 rounded-xl gap-1.5 shadow-lg shadow-indigo-600/30 cursor-pointer"
          >
            <Cpu className="w-4 h-4" />
            {isRunningBenchmark ? 'جاري الفحص...' : 'فحص الأداء والسرعة'}
          </Button>
        </div>
      </div>

      {/* ── Top Metrics ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="flex items-center gap-3.5 p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="w-10 h-10 rounded-xl bg-blue-500/15 border border-blue-500/25 flex items-center justify-center text-blue-500">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <p className="text-2xl font-black text-slate-900 dark:text-white leading-none font-mono">
              {tenantStores.length}
            </p>
            <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mt-1">المنشآت المشتركة</p>
          </div>
        </div>

        <div className="flex items-center gap-3.5 p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center text-emerald-500">
            <Key className="w-5 h-5" />
          </div>
          <div>
            <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 leading-none font-mono">
              {tokens.length}
            </p>
            <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mt-1">أكواد التراخيص الصادرة</p>
          </div>
        </div>

        <div className="flex items-center gap-3.5 p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="w-10 h-10 rounded-xl bg-rose-500/15 border border-rose-500/25 flex items-center justify-center text-rose-500">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <p className="text-2xl font-black text-rose-600 dark:text-rose-400 leading-none font-mono">
              {errorLogs.filter(e => !e.resolved).length}
            </p>
            <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mt-1">أخطاء حرجة قيد المتابعة</p>
          </div>
        </div>

        <div className="flex items-center gap-3.5 p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/25 flex items-center justify-center text-amber-500">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <p className="text-2xl font-black text-amber-600 dark:text-amber-400 leading-none font-mono">
              &lt; 5 ms
            </p>
            <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mt-1">زمن استجابة العمليات</p>
          </div>
        </div>
      </div>

      {/* ── Navigation Tabs ── */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('stores')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'stores'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Building2 className="w-4 h-4" />
          المنشآت المشتركة ({tenantStores.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('tokens')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'tokens'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Key className="w-4 h-4" />
          توليد التراخيص والأكواد ({tokens.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('errors')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'errors'
              ? 'bg-rose-600 text-white shadow-md shadow-rose-600/20'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <ShieldAlert className="w-4 h-4" />
          راصد الأخطاء والتليمتري ({errorLogs.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('benchmark')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'benchmark'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Cpu className="w-4 h-4" />
          تقرير محاكاة وسرعة الأجهزة (Benchmark)
        </button>
      </div>

      {/* ═══════ Tab 1: Tenant Stores ═══════ */}
      {activeTab === 'stores' && (
        <div className="space-y-4 animate-fadeIn">
          {/* Search bar */}
          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
              <Input
                placeholder="بحث باسم المنشأة، المالك، أو كود التفعيل..."
                value={storeSearch}
                onChange={e => setStoreSearch(e.target.value)}
                className="pr-10 h-10 text-xs bg-slate-50 dark:bg-slate-800 rounded-xl font-bold"
              />
            </div>
            <p className="text-xs font-bold text-slate-500">
              إجمالي المنشآت المسجلة: <strong>{filteredStores.length}</strong>
            </p>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <table className="w-full text-right text-xs border-collapse">
              <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-black">
                <tr>
                  <th className="py-3 px-4">اسم المنشأة</th>
                  <th className="py-3 px-4">المالك / الهاتف</th>
                  <th className="py-3 px-4">نوع النشاط</th>
                  <th className="py-3 px-4">كود الترخيص</th>
                  <th className="py-3 px-4">تاريخ الانتهاء</th>
                  <th className="py-3 px-4 text-center">الحالة</th>
                  <th className="py-3 px-4 text-center w-28">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredStores.map(st => (
                  <tr key={st.id} className="hover:bg-blue-50/30 dark:hover:bg-slate-800/40">
                    <td className="py-3.5 px-4 font-black text-slate-900 dark:text-white">
                      {st.store_name}
                    </td>
                    <td className="py-3.5 px-4">
                      <p className="font-bold">{st.owner_name}</p>
                      <p className="text-[10px] text-slate-400 font-mono" dir="ltr">{st.owner_phone || '—'}</p>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md font-bold text-[10px]">
                        {st.business_type === 'pharmacy' ? '💊 صيدلية' : st.business_type === 'clothing' ? '👕 ملابس' : '🛒 سوبر ماركت'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-mono font-bold text-blue-600 dark:text-blue-400 text-[11px]">
                      {st.token}
                    </td>
                    <td className="py-3.5 px-4 font-medium text-slate-500">
                      {new Date(st.expires_at).toLocaleDateString('ar-EG')}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] border ${
                        st.status === 'active'
                          ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 border-emerald-300'
                          : 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 border-rose-300'
                      }`}>
                        {st.status === 'active' ? 'نشط ومفعّل' : 'معلّق (Suspended)'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <Button
                        size="sm"
                        variant={st.status === 'active' ? 'outline' : 'default'}
                        onClick={() => toggleStoreStatus(st.id, st.status === 'active' ? 'suspended' : 'active')}
                        className={`h-7 px-2.5 text-[10px] font-bold rounded-lg ${
                          st.status === 'active' ? 'text-rose-600 hover:bg-rose-50' : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                        }`}
                      >
                        <Power className="w-3 h-3 ml-1" />
                        {st.status === 'active' ? 'إيقاف مؤقت' : 'تفعيل'}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ═══════ Tab 2: Token Generator ═══════ */}
      {activeTab === 'tokens' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 animate-fadeIn">
          {/* Generator Form */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
              <Key className="w-5 h-5 text-indigo-500" />
              <div>
                <h3 className="font-black text-sm text-slate-900 dark:text-white">توليد كود ترخيص واشتراك</h3>
                <p className="text-[10px] text-slate-500">إنشاء رمز ترخيص جديد لبيعه أو إرساله للعميل</p>
              </div>
            </div>

            <form onSubmit={handleGenerateToken} className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">نوع النشاط التجاري</Label>
                <Select value={tokenType} onValueChange={(v) => setTokenType(v as BusinessType)}>
                  <SelectTrigger className="h-10 text-xs font-bold bg-slate-50 dark:bg-slate-800 rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl dark:bg-slate-900">
                    <SelectItem value="pharmacy">💊 صيدلية (Pharmacy)</SelectItem>
                    <SelectItem value="supermarket">🛒 سوبر ماركت (Supermarket)</SelectItem>
                    <SelectItem value="clothing">👕 محلات ملابس (Fashion & Apparel)</SelectItem>
                    <SelectItem value="restaurant">🍽️ مطاعم وكافيهات (Restaurant)</SelectItem>
                    <SelectItem value="general">🏢 أنشطة تجارية عامة (General Retail)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">مدة الاشتراك والترخيص</Label>
                <Select value={tokenDuration} onValueChange={(v) => setTokenDuration(v as LicenseDuration)}>
                  <SelectTrigger className="h-10 text-xs font-bold bg-slate-50 dark:bg-slate-800 rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl dark:bg-slate-900">
                    <SelectItem value="trial_14d">⏳ فترة تجريبية 14 يوم</SelectItem>
                    <SelectItem value="1_month">📅 شهر واحد (1 Month)</SelectItem>
                    <SelectItem value="3_months">📅 3 شهور (Quarterly)</SelectItem>
                    <SelectItem value="6_months">📅 6 شهور (Semi-Annual)</SelectItem>
                    <SelectItem value="1_year">⭐ اشتراك سنوي (1 Year - Best)</SelectItem>
                    <SelectItem value="lifetime">👑 ترخيص مدى الحياة (Lifetime)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">اسم العميل / الصيدلي (اختياري)</Label>
                <Input
                  placeholder="مثال: د. مصطفى حسام"
                  value={tokenClientName}
                  onChange={e => setTokenClientName(e.target.value)}
                  className="h-10 text-xs bg-slate-50 dark:bg-slate-800 rounded-xl font-bold"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">رقم هاتف العميل</Label>
                <Input
                  placeholder="01XXXXXXXXX"
                  value={tokenClientPhone}
                  onChange={e => setTokenClientPhone(e.target.value)}
                  className="h-10 text-xs bg-slate-50 dark:bg-slate-800 rounded-xl font-mono"
                  dir="ltr"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">ملاحظات داخلية</Label>
                <Input
                  placeholder="مثال: تم التحويل بنك مصر"
                  value={tokenNotes}
                  onChange={e => setTokenNotes(e.target.value)}
                  className="h-10 text-xs bg-slate-50 dark:bg-slate-800 rounded-xl"
                />
              </div>

              <Button
                type="submit"
                disabled={isGenerating}
                className="w-full h-11 text-xs font-black bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl shadow-md shadow-indigo-600/30 active:scale-95 transition-all mt-2 cursor-pointer"
              >
                <Key className="w-4 h-4 ml-1.5" />
                {isGenerating ? 'جاري توليد الرمز...' : 'توليد كود الترخيص الآن'}
              </Button>
            </form>
          </div>

          {/* Tokens List */}
          <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm flex flex-col">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h3 className="font-black text-sm text-slate-900 dark:text-white">سجل الأكواد الصادرة ({tokens.length})</h3>
              <span className="text-xs font-bold text-slate-500">جاهزة للإرسال والتفعيل</span>
            </div>

            <div className="flex-1 overflow-auto max-h-[500px]">
              <table className="w-full text-right text-xs border-collapse">
                <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-black">
                  <tr>
                    <th className="py-3 px-4">كود التفعيل (Access Code)</th>
                    <th className="py-3 px-4">النشاط والمدة</th>
                    <th className="py-3 px-4">العميل</th>
                    <th className="py-3 px-4 text-center">الحالة</th>
                    <th className="py-3 px-4 text-center w-20">نسخ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {tokens.map(tk => (
                    <tr key={tk.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="py-3.5 px-4 font-mono font-black text-blue-600 dark:text-blue-400 text-xs">
                        {tk.token}
                      </td>
                      <td className="py-3.5 px-4">
                        <p className="font-bold text-slate-800 dark:text-slate-200">
                          {tk.business_type} • {tk.duration}
                        </p>
                        <p className="text-[10px] text-slate-400">ينتهي في: {new Date(tk.expires_at).toLocaleDateString('ar-EG')}</p>
                      </td>
                      <td className="py-3.5 px-4 font-medium text-slate-600 dark:text-slate-300">
                        {tk.client_name || tk.client_phone || '—'}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                          tk.status === 'active'
                            ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600'
                            : tk.status === 'unused'
                              ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-600'
                              : 'bg-rose-50 text-rose-600'
                        }`}>
                          {tk.status === 'active' ? 'مستخدم ومفعّل' : tk.status === 'unused' ? 'كود جديد جاهز' : 'معلّق'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => handleCopyToken(tk.token)}
                          className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-blue-600 transition-colors cursor-pointer"
                          title="نسخ الكود"
                        >
                          {copiedToken === tk.token ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ═══════ Tab 3: Error & Bug Logger Telemetry ═══════ */}
      {activeTab === 'errors' && (
        <div className="space-y-4 animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row gap-3 items-center justify-between">
            <div className="relative flex-1 w-full max-w-md">
              <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
              <Input
                placeholder="بحث في رسائل الخطأ، المنشأة، أو المسار..."
                value={errorSearch}
                onChange={e => setErrorSearch(e.target.value)}
                className="pr-10 h-10 text-xs bg-slate-50 dark:bg-slate-800 rounded-xl font-bold"
              />
            </div>

            <div className="w-full md:w-48">
              <Select value={errorSeverityFilter} onValueChange={v => setErrorSeverityFilter(v)}>
                <SelectTrigger className="h-10 text-xs font-bold bg-slate-50 dark:bg-slate-800 rounded-xl">
                  <SelectValue placeholder="درجة الخطورة" />
                </SelectTrigger>
                <SelectContent className="rounded-xl dark:bg-slate-900">
                  <SelectItem value="all">جميع مستويات الخطأ</SelectItem>
                  <SelectItem value="critical">🚨 أخطاء حرجة (Critical)</SelectItem>
                  <SelectItem value="error">⚠️ استثناءات (Exceptions)</SelectItem>
                  <SelectItem value="network">🌐 اتصال وشبكة (Network)</SelectItem>
                  <SelectItem value="db">💾 قاعدة بيانات (IndexedDB)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
            <table className="w-full text-right text-xs border-collapse">
              <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-black">
                <tr>
                  <th className="py-3 px-4">درجة الخطورة</th>
                  <th className="py-3 px-4">المنشأة والبيئة (OS / Browser)</th>
                  <th className="py-3 px-4">رسالة الخطأ (Message)</th>
                  <th className="py-3 px-4">الصفحة</th>
                  <th className="py-3 px-4">الوقت</th>
                  <th className="py-3 px-4 text-center">الحالة</th>
                  <th className="py-3 px-4 text-center w-24">معاينة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredErrors.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400 font-bold">
                      <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-80" />
                      لا توجد أخطاء مسجلة، المنظومة تعمل باستقرار 100%
                    </td>
                  </tr>
                ) : (
                  filteredErrors.map(log => (
                    <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                          log.severity === 'critical'
                            ? 'bg-rose-500/20 text-rose-500 border border-rose-500/30'
                            : log.severity === 'db'
                              ? 'bg-amber-500/20 text-amber-500'
                              : 'bg-blue-500/20 text-blue-500'
                        }`}>
                          {log.severity.toUpperCase()}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <p className="font-bold text-slate-900 dark:text-white">{log.store_name || 'منشأة عميل'}</p>
                        <p className="text-[10px] text-slate-400">{log.os_info} • {log.browser_info}</p>
                      </td>
                      <td className="py-3 px-4 max-w-xs truncate font-mono text-slate-700 dark:text-slate-300">
                        {log.message}
                      </td>
                      <td className="py-3 px-4 font-mono text-[10px] text-slate-400">
                        {log.page_url}
                      </td>
                      <td className="py-3 px-4 text-slate-400 text-[11px]">
                        {new Date(log.created_at).toLocaleTimeString('ar-EG')}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                          log.resolved ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                        }`}>
                          {log.resolved ? 'تم الحل' : 'قيد الفحص'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setSelectedError(log)}
                          className="h-7 px-2 text-[10px] font-bold rounded-lg"
                        >
                          <Eye className="w-3 h-3 ml-1" />
                          التفاصيل
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ═══════ Tab 4: Performance Benchmark Report ═══════ */}
      {activeTab === 'benchmark' && (
        <div className="space-y-4 animate-fadeIn">
          {benchmarkReport ? (
            <div className="space-y-4">
              {/* Summary Card */}
              <div className="bg-gradient-to-r from-emerald-950/40 via-slate-900 to-slate-900 border border-emerald-500/30 rounded-3xl p-6 shadow-sm">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div className="flex items-center gap-3.5">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                      <Cpu className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-lg font-black text-white">
                        نتيجة اختبار كفاءة الأجهزة الضعيفة (Windows 7 / Core 2 Duo / 2GB RAM)
                      </h3>
                      <p className="text-xs text-slate-300 mt-0.5">
                        تم فحص أداء استعلامات البيانات وسرعة كتابة الفواتير ومعدل استهلاك الذاكرة
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-left bg-slate-900/80 px-4 py-2 rounded-2xl border border-slate-800">
                      <p className="text-[10px] font-bold text-slate-400">مؤشر السرعة الكلي</p>
                      <p className="text-xl font-black text-emerald-400 font-mono">{benchmarkReport.summary.overall_score} / 100</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-4 border-t border-slate-800/80 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[10px]">نظام التشغيل المستهدف:</span>
                    <strong className="text-white font-mono">Windows 7 (32/64-bit) & XP</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">الحد الأدنى للرام:</span>
                    <strong className="text-emerald-400 font-mono">2GB RAM متوافق 100%</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">المعالج المستهدف:</span>
                    <strong className="text-white font-mono">Intel Core 2 Duo / Celeron</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">العمل بدون إنترنت:</span>
                    <strong className="text-emerald-400 font-mono">مفعل محلياً (Zero Latency)</strong>
                  </div>
                </div>
              </div>

              {/* Benchmarks Metrics Table */}
              <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
                <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <h3 className="font-black text-sm text-slate-900 dark:text-white">الأرقام القياسية المسجلة بالاختبار المباشر</h3>
                  <Button
                    size="sm"
                    onClick={handleRunBenchmark}
                    disabled={isRunningBenchmark}
                    className="h-8 text-xs font-bold rounded-xl bg-blue-600 hover:bg-blue-500 text-white gap-1"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isRunningBenchmark ? 'animate-spin' : ''}`} />
                    إعادة الفحص
                  </Button>
                </div>

                <table className="w-full text-right text-xs border-collapse">
                  <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-black">
                    <tr>
                      <th className="py-3 px-4">مؤشر الاختبار (Benchmark Test)</th>
                      <th className="py-3 px-4 font-mono">الزمن / القيمة الحقيقية</th>
                      <th className="py-3 px-4 text-center">التقييم</th>
                      <th className="py-3 px-4">تفاصيل العملية</th>
                      <th className="py-3 px-4">الجهاز المستهدف</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {benchmarkReport.benchmarks.map((bm, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="py-3.5 px-4 font-black text-slate-900 dark:text-white">
                          {bm.test_name}
                        </td>
                        <td className="py-3.5 px-4 font-mono font-black text-blue-600 dark:text-blue-400 text-sm">
                          {bm.metric_value} {bm.unit}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <span className="px-2.5 py-0.5 rounded-full font-bold text-[10px] bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                            فائق السرعة ⚡
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-slate-500">
                          {bm.description}
                        </td>
                        <td className="py-3.5 px-4 font-mono text-[10px] text-slate-400">
                          {bm.hardware_target}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800">
              <Button onClick={handleRunBenchmark} className="bg-blue-600 text-white font-bold rounded-xl h-11 px-6">
                بدء تشغيل اختبار المحاكاة
              </Button>
            </div>
          )}
        </div>
      )}

      {/* ─── Stack Trace Detail Modal ─── */}
      {selectedError && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-2xl w-full text-white space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-rose-500" />
                <h3 className="font-black text-base">تفاصيل الخطأ البرمجي عن بُعد</h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedError(null)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <p><strong className="text-slate-400">المنشأة:</strong> {selectedError.store_name} ({selectedError.store_id})</p>
              <p><strong className="text-slate-400">بيئة العميل:</strong> {selectedError.os_info} • {selectedError.browser_info}</p>
              <p><strong className="text-slate-400">الصفحة:</strong> {selectedError.page_url}</p>
              <p><strong className="text-slate-400">رسالة الخطأ:</strong> <span className="text-rose-400 font-mono">{selectedError.message}</span></p>
            </div>

            {selectedError.stack_trace && (
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-slate-400">Stack Trace:</span>
                <pre className="p-3 bg-slate-950 rounded-xl font-mono text-[10px] text-slate-300 overflow-x-auto max-h-48 border border-slate-800 leading-relaxed" dir="ltr">
                  {selectedError.stack_trace}
                </pre>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <Button
                variant="outline"
                onClick={() => setSelectedError(null)}
                className="h-9 rounded-xl text-xs font-bold border-slate-700"
              >
                إغلاق
              </Button>
              {!selectedError.resolved && (
                <Button
                  onClick={async () => {
                    await resolveSystemError(selectedError.id)
                    toast.success('تم تعليم الخطأ كـ محلول')
                    setSelectedError(null)
                  }}
                  className="h-9 px-4 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-500 text-white gap-1"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  تم حل الخطأ في التحديث
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
