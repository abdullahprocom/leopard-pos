'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/lib/db'
import { generateLicenseToken, toggleStoreStatus } from '@/lib/license-service'
import { resolveSystemError, logSystemError } from '@/lib/logger'
import type { BusinessType, LicenseDuration, LicenseToken, SystemErrorLog, TenantStoreRecord, ErrorSeverity } from '@/lib/types'
import { 
  ShieldAlert, Key, Building2, Terminal, AlertTriangle, 
  CheckCircle2, Clock, Download, Copy, Check, Eye, X, 
  Power, Server, Search, FileText, CheckCircle, Bug,
  Activity, Laptop, RefreshCw, Trash2, ArrowUpRight
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'

// Export error logs to CSV
function exportErrorsToCSV(logs: SystemErrorLog[]) {
  if (logs.length === 0) {
    toast.error('لا توجد سجلات أخطاء للتصدير')
    return
  }
  const headers = ['معرف الخطأ', 'اسم المتجر', 'درجة الخطورة', 'الرسالة', 'الصفحة', 'نظام العميل', 'المتصفح', 'الوقت', 'الحالة']
  const rows = logs.map(l => [
    l.id.slice(0, 8),
    l.store_name || 'متجر غير محدد',
    l.severity,
    (l.message || '').replace(/"/g, '""'),
    l.page_url,
    l.os_info || '—',
    l.browser_info || '—',
    new Date(l.created_at).toLocaleString('ar-EG'),
    l.resolved ? 'تم الحل' : 'قيد الفحص'
  ])
  const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n')
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = `system_error_logs_${new Date().toISOString().slice(0, 10)}.csv`
  link.click()
  toast.success('تم تصدير تقرير الأخطاء بنجاح')
}

export default function SuperAdminPage() {
  const [activeTab, setActiveTab] = useState<'errors' | 'stores' | 'tokens'>('errors')

  // ─── Token Generator Form State ───
  const [tokenType, setTokenType] = useState<BusinessType>('pharmacy')
  const [tokenDuration, setTokenDuration] = useState<LicenseDuration>('1_year')
  const [tokenClientName, setTokenClientName] = useState('')
  const [tokenClientPhone, setTokenClientPhone] = useState('')
  const [tokenNotes, setTokenNotes] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [copiedToken, setCopiedToken] = useState<string | null>(null)

  // ─── Errors & Telemetry Filter State ───
  const [errorSearch, setErrorSearch] = useState('')
  const [errorSeverityFilter, setErrorSeverityFilter] = useState<string>('all')
  const [errorStatusFilter, setErrorStatusFilter] = useState<'all' | 'unresolved' | 'resolved'>('all')
  const [selectedError, setSelectedError] = useState<SystemErrorLog | null>(null)

  // ─── Stores Search State ───
  const [storeSearch, setStoreSearch] = useState('')

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

  // Seed sample data if database is fresh
  useEffect(() => {
    async function seedDefaults() {
      const storeCount = await db.tenant_stores.count()
      if (storeCount === 0) {
        const sampleStore: TenantStoreRecord = {
          id: 'store-demo-01',
          store_name: 'صيدلية النور الحديثة',
          owner_name: 'د. أحمد مصطفى',
          owner_phone: '01012345678',
          business_type: 'pharmacy',
          status: 'active',
          token: 'ERP-2026-PHARM-Y01-A99K-8822',
          created_at: new Date(Date.now() - 12 * 86400000).toISOString(),
          expires_at: new Date(Date.now() + 353 * 86400000).toISOString(),
          last_active_at: new Date().toISOString(),
          total_items: 520,
          total_sales_count: 1840,
          total_revenue: 124500
        }
        await db.tenant_stores.put(sampleStore)
      }

      const logCount = await db.system_error_logs.count()
      if (logCount === 0) {
        const sampleLogs: SystemErrorLog[] = [
          {
            id: 'err-sample-01',
            store_id: 'store-demo-01',
            store_name: 'صيدلية النور الحديثة',
            user_role: 'cashier',
            severity: 'error',
            message: 'TypeError: Cannot read properties of undefined (reading "barcode")',
            stack_trace: 'TypeError: Cannot read properties of undefined (reading "barcode")\n    at handleScanBarcode (pos/page.tsx:142:18)\n    at HTMLInputElement.onKeyDown (pos/page.tsx:210:9)',
            page_url: '/dashboard/pos',
            browser_info: 'Chrome 80.0',
            os_info: 'Windows 7 (Legacy)',
            is_online: true,
            resolved: false,
            created_at: new Date(Date.now() - 35 * 60000).toISOString()
          },
          {
            id: 'err-sample-02',
            store_id: '00000000-0000-0000-0001-000000000001',
            store_name: 'سوبر ماركت الهدى',
            user_role: 'admin',
            severity: 'network',
            message: 'SyncEngine: Offline deferred batch write - network timeout',
            stack_trace: 'FetchError: Failed to fetch Supabase sync endpoint\n    at SyncEngine.processQueue (sync-engine.ts:208:14)',
            page_url: '/dashboard/items',
            browser_info: 'Firefox 95.0',
            os_info: 'Windows 10',
            is_online: false,
            resolved: true,
            resolved_at: new Date(Date.now() - 10 * 60000).toISOString(),
            resolved_by: 'Super Admin Support',
            created_at: new Date(Date.now() - 180 * 60000).toISOString()
          }
        ]
        for (const log of sampleLogs) {
          await db.system_error_logs.put(log)
        }
      }
    }
    seedDefaults()
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

  // Filtered Telemetry Logs
  const filteredErrors = useMemo(() => {
    return errorLogs.filter(err => {
      const q = errorSearch.toLowerCase()
      const matchesSearch = (err.message || '').toLowerCase().includes(q) ||
        (err.store_name || '').toLowerCase().includes(q) ||
        (err.page_url || '').toLowerCase().includes(q) ||
        (err.os_info || '').toLowerCase().includes(q)
      
      const matchesSeverity = errorSeverityFilter === 'all' || err.severity === errorSeverityFilter
      const matchesStatus = errorStatusFilter === 'all' || 
        (errorStatusFilter === 'unresolved' && !err.resolved) ||
        (errorStatusFilter === 'resolved' && err.resolved)

      return matchesSearch && matchesSeverity && matchesStatus
    })
  }, [errorLogs, errorSearch, errorSeverityFilter, errorStatusFilter])

  // Filtered Stores
  const filteredStores = useMemo(() => {
    return tenantStores.filter(s =>
      s.store_name.toLowerCase().includes(storeSearch.toLowerCase()) ||
      s.owner_name.toLowerCase().includes(storeSearch.toLowerCase()) ||
      s.token.toLowerCase().includes(storeSearch.toLowerCase())
    )
  }, [tenantStores, storeSearch])

  // Unresolved Errors Count
  const unresolvedCount = errorLogs.filter(e => !e.resolved).length

  return (
    <div className="space-y-4 pb-16 select-none w-full" dir="rtl">
      {/* ── Header Banner ── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-gradient-to-r from-slate-900 via-slate-900 to-indigo-950 p-5 rounded-3xl border border-indigo-900/40 shadow-xl text-white">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400 shadow-lg">
            <Server className="w-6 h-6" />
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
            <p className="text-xs text-slate-300 mt-0.5">
              نظام تتبع الأخطاء والتليمتري الصامت للمتاجر، وإدارة التراخيص والاشتراكات
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={() => exportErrorsToCSV(filteredErrors)}
            variant="outline"
            className="border-indigo-800/80 bg-slate-900/80 text-indigo-300 hover:text-white text-xs font-bold h-10 px-4 rounded-xl gap-1.5 cursor-pointer"
          >
            <Download className="w-4 h-4" />
            تصدير تقرير الأخطاء (CSV)
          </Button>
        </div>
      </div>

      {/* ── Top Metrics ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Unresolved Errors */}
        <div 
          onClick={() => { setActiveTab('errors'); setErrorStatusFilter('unresolved') }}
          className="flex items-center gap-3.5 p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs cursor-pointer hover:border-rose-400 transition-colors"
        >
          <div className="w-10 h-10 rounded-xl bg-rose-500/15 border border-rose-500/25 flex items-center justify-center text-rose-500">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <p className="text-2xl font-black text-rose-600 dark:text-rose-400 leading-none font-mono">
              {unresolvedCount}
            </p>
            <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mt-1">أخطاء حرجة قيد المتابعة</p>
          </div>
        </div>

        {/* Subscribed Stores */}
        <div 
          onClick={() => setActiveTab('stores')}
          className="flex items-center gap-3.5 p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs cursor-pointer hover:border-blue-400 transition-colors"
        >
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

        {/* Active Licenses */}
        <div 
          onClick={() => setActiveTab('tokens')}
          className="flex items-center gap-3.5 p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs cursor-pointer hover:border-emerald-400 transition-colors"
        >
          <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center text-emerald-500">
            <Key className="w-5 h-5" />
          </div>
          <div>
            <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 leading-none font-mono">
              {tokens.filter(t => t.status === 'active').length}
            </p>
            <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mt-1">تراخيص فعالة ونشطة</p>
          </div>
        </div>

        {/* System Stability Score */}
        <div className="flex items-center gap-3.5 p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/15 border border-indigo-500/25 flex items-center justify-center text-indigo-500">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <p className="text-2xl font-black text-indigo-600 dark:text-indigo-400 leading-none font-mono">
              99.8%
            </p>
            <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mt-1">معدل استقرار المنظومة</p>
          </div>
        </div>
      </div>

      {/* ── Navigation Tabs ── */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('errors')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'errors'
              ? 'bg-rose-600 text-white shadow-md shadow-rose-600/20'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Bug className="w-4 h-4" />
          راصد الأخطاء والتليمتري الصامت ({errorLogs.length})
          {unresolvedCount > 0 && (
            <span className="bg-white text-rose-600 font-mono text-[10px] px-1.5 py-0.2 rounded-full font-black">
              {unresolvedCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('stores')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
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
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'tokens'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Key className="w-4 h-4" />
          توليد التراخيص والأكواد ({tokens.length})
        </button>
      </div>

      {/* ═══════ Tab 1: Silent Error & Bug Logger ═══════ */}
      {activeTab === 'errors' && (
        <div className="space-y-4 animate-fadeIn">
          {/* Search & Filters */}
          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row gap-3 items-center justify-between">
            <div className="relative flex-1 w-full max-w-md">
              <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
              <Input
                placeholder="بحث باسم المتجر، رسالة الخطأ، المسار، أو نظام التشغيل..."
                value={errorSearch}
                onChange={e => setErrorSearch(e.target.value)}
                className="pr-10 h-10 text-xs bg-slate-50 dark:bg-slate-800 rounded-xl font-bold"
              />
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto">
              <div className="w-44">
                <Select value={errorSeverityFilter} onValueChange={v => setErrorSeverityFilter(v)}>
                  <SelectTrigger className="h-10 text-xs font-bold bg-slate-50 dark:bg-slate-800 rounded-xl">
                    <SelectValue placeholder="نوع الخطأ" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl dark:bg-slate-900">
                    <SelectItem value="all">جميع الأنواع</SelectItem>
                    <SelectItem value="critical">🚨 أخطاء حرجة (Critical)</SelectItem>
                    <SelectItem value="error">⚠️ استثناءات (Exceptions)</SelectItem>
                    <SelectItem value="network">🌐 شبكة ومزامنة (Network)</SelectItem>
                    <SelectItem value="db">💾 قاعدة بيانات (DB)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="w-36">
                <Select value={errorStatusFilter} onValueChange={(v: any) => setErrorStatusFilter(v)}>
                  <SelectTrigger className="h-10 text-xs font-bold bg-slate-50 dark:bg-slate-800 rounded-xl">
                    <SelectValue placeholder="الحالة" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl dark:bg-slate-900">
                    <SelectItem value="all">جميع الحالات</SelectItem>
                    <SelectItem value="unresolved">🔴 قيد المتابعة</SelectItem>
                    <SelectItem value="resolved">🟢 تم الحل</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Real-time Telemetry Errors Table */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="font-black text-sm text-slate-900 dark:text-white flex items-center gap-2">
                  <Bug className="w-4 h-4 text-rose-500" />
                  سجل الأخطاء والتليمتري الوارد من المتاجر ({filteredErrors.length})
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  يتم رصد وحفظ هذه الأخطاء تلقائياً من أجهزة العملاء لتمكين الدعم الفني من حلها مسبقاً
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs border-collapse min-w-[850px]">
                <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-black">
                  <tr>
                    <th className="py-3 px-4">اسم المتجر والفرع</th>
                    <th className="py-3 px-4">نوع الخطأ</th>
                    <th className="py-3 px-4">رسالة الخطأ البرمجي</th>
                    <th className="py-3 px-4">الصفحة / المسار</th>
                    <th className="py-3 px-4">بيئة العميل (OS & Browser)</th>
                    <th className="py-3 px-4">وقت الحدوث</th>
                    <th className="py-3 px-4 text-center">الحالة</th>
                    <th className="py-3 px-4 text-center w-24">معاينة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredErrors.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-16 text-center text-slate-400 font-bold">
                        <CheckCircle className="w-10 h-10 text-emerald-500 mx-auto mb-2 opacity-80" />
                        <p className="text-sm text-slate-800 dark:text-slate-200">لا توجد أخطاء مسجلة مطابقة للبحث</p>
                        <p className="text-xs text-slate-400 mt-1">المنظومة تعمل باستقرار تام عبر كافة المتاجر</p>
                      </td>
                    </tr>
                  ) : (
                    filteredErrors.map(log => (
                      <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="py-3.5 px-4 font-black text-slate-900 dark:text-white">
                          <p>{log.store_name || 'متجر غير معروف'}</p>
                          <p className="text-[10px] text-slate-400 font-mono font-normal">{log.store_id.slice(0, 13)}...</p>
                        </td>

                        <td className="py-3.5 px-4">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full font-bold text-[10px] border ${
                            log.severity === 'critical'
                              ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30'
                              : log.severity === 'db'
                                ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30'
                                : log.severity === 'network'
                                  ? 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border-cyan-500/30'
                                  : 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30'
                          }`}>
                            {log.severity === 'critical' ? 'حرج' : log.severity === 'db' ? 'قاعدة بيانات' : log.severity === 'network' ? 'شبكة ومزامنة' : 'استثناء'}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 max-w-xs truncate font-mono text-slate-800 dark:text-slate-200">
                          {log.message}
                        </td>

                        <td className="py-3.5 px-4 font-mono text-[11px] text-blue-600 dark:text-blue-400">
                          {log.page_url}
                        </td>

                        <td className="py-3.5 px-4 text-slate-500 text-[11px]">
                          <p className="font-bold text-slate-700 dark:text-slate-300">{log.os_info || 'Windows'}</p>
                          <p className="text-[10px] text-slate-400">{log.browser_info || 'Browser'}</p>
                        </td>

                        <td className="py-3.5 px-4 text-slate-500 text-[11px] font-mono">
                          {new Date(log.created_at).toLocaleString('ar-EG', {
                            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                          })}
                        </td>

                        <td className="py-3.5 px-4 text-center">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full font-bold text-[10px] border ${
                            log.resolved 
                              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 border-emerald-300 dark:border-emerald-800' 
                              : 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 border-rose-300 dark:border-rose-800 animate-pulse'
                          }`}>
                            {log.resolved ? 'تم الحل' : 'قيد الفحص'}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 text-center">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setSelectedError(log)}
                            className="h-7 px-2.5 text-[10px] font-bold rounded-lg gap-1 border-slate-200 dark:border-slate-700"
                          >
                            <Eye className="w-3 h-3" />
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
        </div>
      )}

      {/* ═══════ Tab 2: Subscribed Stores ═══════ */}
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

          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
            <table className="w-full text-right text-xs border-collapse">
              <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-black">
                <tr>
                  <th className="py-3 px-4">اسم المنشأة</th>
                  <th className="py-3 px-4">المالك / الهاتف</th>
                  <th className="py-3 px-4">نوع النشاط</th>
                  <th className="py-3 px-4">كود الترخيص (Token)</th>
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
                          st.status === 'active' ? 'text-rose-600 hover:bg-rose-50 border-rose-200' : 'bg-emerald-600 hover:bg-emerald-500 text-white'
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

      {/* ═══════ Tab 3: Token Generator ═══════ */}
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

      {/* ─── Stack Trace Detail Modal ─── */}
      {selectedError && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-2xl w-full text-white space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-rose-500" />
                <h3 className="font-black text-base">تفاصيل تقرير التليمتري والخطأ البرمجي</h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedError(null)}
                className="text-slate-400 hover:text-white p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs bg-slate-950 p-4 rounded-2xl border border-slate-800">
              <div>
                <span className="text-slate-400 block text-[10px]">المنشأة والمتجر:</span>
                <strong className="text-white font-bold">{selectedError.store_name}</strong>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">معرف المنشأة (Store ID):</span>
                <strong className="text-slate-300 font-mono text-[10px]">{selectedError.store_id}</strong>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">بيئة ونظام جهاز العميل:</span>
                <strong className="text-indigo-400 font-bold">{selectedError.os_info} • {selectedError.browser_info}</strong>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">الصفحة التي حدث بها الخطأ:</span>
                <strong className="text-blue-400 font-mono">{selectedError.page_url}</strong>
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-xs font-bold text-slate-300">رسالة الخطأ:</span>
              <div className="p-3 bg-rose-950/30 border border-rose-800/40 rounded-xl text-rose-300 font-mono text-xs">
                {selectedError.message}
              </div>
            </div>

            {selectedError.stack_trace && (
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-slate-400">تتبع الكود البرمجي (Stack Trace):</span>
                <pre className="p-3 bg-slate-950 rounded-xl font-mono text-[10px] text-slate-300 overflow-x-auto max-h-44 border border-slate-800 leading-relaxed" dir="ltr">
                  {selectedError.stack_trace}
                </pre>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <Button
                variant="outline"
                onClick={() => setSelectedError(null)}
                className="h-9 rounded-xl text-xs font-bold border-slate-700 text-slate-300"
              >
                إغلاق
              </Button>
              {!selectedError.resolved && (
                <Button
                  onClick={async () => {
                    await resolveSystemError(selectedError.id)
                    toast.success('تم تسجيل حل الخطأ وتحديث حالة البلاغ')
                    setSelectedError(null)
                  }}
                  className="h-9 px-4 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-500 text-white gap-1.5 shadow-md shadow-emerald-600/30 cursor-pointer"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  تم معالجة المشكلة في التحديث
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
