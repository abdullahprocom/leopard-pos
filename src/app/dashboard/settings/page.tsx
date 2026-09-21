'use client'

import { useState, useEffect } from 'react'
import { 
  db, 
  resetStoreEntireData, 
  resetTransactionsKeepItems, 
  resetTransactionsKeepPricing, 
  deleteStoreSalesInvoices 
} from '@/lib/db'
import { syncEngine, DEFAULT_STORE_UUID, DEFAULT_USER_UUID, getTenantInfo } from '@/lib/sync-engine'
import { useStore } from '@/lib/store-context'
import { useAuth } from '@/lib/auth-context'
import { BusinessType } from '@/lib/types'
import { toast } from 'sonner'
import { Save, Store, Printer, RefreshCw, Database, ShieldCheck, Key, Layers, CheckCircle2, Trash2, Lock, AlertTriangle, ShieldAlert, RotateCcw, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export default function SettingsPage() {
  const { role } = useAuth()
  const { 
    storeId, 
    branchId, 
    storeName, 
    setStoreName, 
    businessType, 
    setBusinessType, 
    purgeAndReseedCategories, 
    activationToken, 
    activateOfflineSystem, 
    isActivated 
  } = useStore()

  // Protect sensitive settings: Only admin can access
  if (role !== 'admin') {
    return (
      <div className="p-8 text-center" dir="rtl">
        <div className="inline-flex p-4 rounded-2xl bg-amber-500/10 text-amber-500 mb-4">
          <ShieldAlert className="w-10 h-10" />
        </div>
        <h2 className="text-xl font-black text-slate-900 dark:text-white">غير مصرح بالدخول</h2>
        <p className="text-sm text-slate-500 mt-2 font-semibold">
          صفحة الإعدادات وتصفير البيانات مخصصة لمدير النظام العام (Admin) فقط.
        </p>
      </div>
    )
  }

  const [localStoreName, setLocalStoreName] = useState(storeName || '')
  const [localBusinessType, setLocalBusinessType] = useState<BusinessType>(businessType)
  const [currency, setCurrency] = useState('EGP')
  const [taxRate, setTaxRate] = useState('0')
  const [printerPaperSize, setPrinterPaperSize] = useState('80mm')
  const [receiptFooter, setReceiptFooter] = useState('شكراً لزيارتكم - نتمنى لكم يوماً سعيداً')
  const [inputToken, setInputToken] = useState(activationToken || '')
  const [isSaving, setIsSaving] = useState(false)
  const [syncStatus, setSyncStatus] = useState({ pending: 0, synced: 0, failed: 0 })

  // 3-Tier Reset Modals
  const [isResetTier1ModalOpen, setIsResetTier1ModalOpen] = useState(false) // Full Factory Reset
  const [isResetTier2ModalOpen, setIsResetTier2ModalOpen] = useState(false) // Reset Transactions Keep Items
  const [isResetTier3ModalOpen, setIsResetTier3ModalOpen] = useState(false) // Reset Transactions Keep Pricing
  const [isResetSalesModalOpen, setIsResetSalesModalOpen] = useState(false) // Quick Sales Invoices Reset
  const [isExecutingReset, setIsExecutingReset] = useState(false)

  // Tier 1: Full Factory Reset
  const handleExecuteResetTier1 = async () => {
    try {
      setIsExecutingReset(true)
      const tenant = getTenantInfo(localBusinessType)
      await resetStoreEntireData(tenant.storeId, localBusinessType)
      toast.success('تم تنفيذ التدمير الشامل وإعادة ضبط المصنع كأن المنظومة جديدة تماماً!')
      setIsResetTier1ModalOpen(false)
      setTimeout(() => window.location.reload(), 800)
    } catch (err: any) {
      console.error(err)
      toast.error('حدث خطأ أثناء ضبط المصنع: ' + err.message)
    } finally {
      setIsExecutingReset(false)
    }
  }

  // Tier 2: Reset Transactions Keep Items Structure
  const handleExecuteResetTier2 = async () => {
    try {
      setIsExecutingReset(true)
      const tenant = getTenantInfo(localBusinessType)
      await resetTransactionsKeepItems(tenant.storeId)
      toast.success('تم تصفير الحسابات والعمليات مع الحفاظ على هيكل الأصناف والباركودات!')
      setIsResetTier2ModalOpen(false)
      setTimeout(() => window.location.reload(), 800)
    } catch (err: any) {
      console.error(err)
      toast.error('حدث خطأ أثناء تصفير الحركات: ' + err.message)
    } finally {
      setIsExecutingReset(false)
    }
  }

  // Tier 3: Reset Transactions Keep Pricing
  const handleExecuteResetTier3 = async () => {
    try {
      setIsExecutingReset(true)
      const tenant = getTenantInfo(localBusinessType)
      await resetTransactionsKeepPricing(tenant.storeId)
      toast.success('تم تصفير الحركات مع الحفاظ الكامل على الأصناف والباركودات والأسعار!')
      setIsResetTier3ModalOpen(false)
      setTimeout(() => window.location.reload(), 800)
    } catch (err: any) {
      console.error(err)
      toast.error('حدث خطأ أثناء تصفير الحركات: ' + err.message)
    } finally {
      setIsExecutingReset(false)
    }
  }

  // Quick Sales Reset
  const handleExecuteResetSales = async () => {
    try {
      setIsExecutingReset(true)
      const tenant = getTenantInfo(localBusinessType)
      await deleteStoreSalesInvoices(tenant.storeId)
      toast.success('تم مسح وتصفير جميع فواتير المبيعات بنجاح!')
      setIsResetSalesModalOpen(false)
      setTimeout(() => window.location.reload(), 800)
    } catch (err: any) {
      console.error(err)
      toast.error('حدث خطأ أثناء مسح الفواتير: ' + err.message)
    } finally {
      setIsExecutingReset(false)
    }
  }

  useEffect(() => {
    async function loadSettings() {
      const tenant = getTenantInfo(businessType)
      const store = await db.stores.where('id').equals(tenant.storeId).first()
      const currentName = store?.name || (typeof window !== 'undefined' && localStorage.getItem(`erp_store_name_${businessType}`)) || tenant.defaultName
      setLocalStoreName(currentName)
      setLocalBusinessType(businessType)
      setCurrency(store?.currency || 'EGP')
      setTaxRate(String(store?.tax_rate || 0))

      const savedPrinter = localStorage.getItem('apr_printer_size') || '80mm'
      const savedFooter = localStorage.getItem('apr_receipt_footer') || 'شكراً لزيارتكم - منظومة APR System'
      setPrinterPaperSize(savedPrinter)
      setReceiptFooter(savedFooter)
      
      const status = await syncEngine.getSyncStatus()
      setSyncStatus(status)
      if (status.failed > 0 || status.pending > 0) {
        await syncEngine.processQueue()
        const refreshedStatus = await syncEngine.getSyncStatus()
        setSyncStatus(refreshedStatus)
      }
    }
    loadSettings()

    const unsubscribe = syncEngine.subscribe((status) => {
      setSyncStatus(status)
    })
    return () => {
      unsubscribe()
    }
  }, [storeName, businessType])

  const handleSaveAllSettings = async () => {
    try {
      setIsSaving(true)
      const tenant = getTenantInfo(localBusinessType)
      const existing = await db.stores.where('id').equals(tenant.storeId).first()
      const now = new Date().toISOString()
      const finalName = localStoreName.trim() || tenant.defaultName

      const storeData = {
        id: tenant.storeId,
        owner_id: existing?.owner_id || DEFAULT_USER_UUID,
        name: finalName,
        business_type: localBusinessType,
        status: 'active' as const,
        currency,
        tax_rate: Math.max(0, parseFloat(taxRate) || 0),
        created_at: existing?.created_at || now,
        updated_at: now,
      }

      await db.stores.put(storeData)
      syncEngine.enqueueOperation('stores', 'UPDATE', storeData)

      // Update global context & local storage (dynamically switches active tenant store)
      await setBusinessType(localBusinessType, finalName)

      // Save printer settings in localStorage
      localStorage.setItem('apr_printer_size', printerPaperSize)
      localStorage.setItem('apr_receipt_footer', receiptFooter)

      // Update activation token if modified
      if (inputToken.trim()) {
        activateOfflineSystem(inputToken.trim(), finalName, localBusinessType)
      }

      toast.success('تم حفظ وتطبيق نشاط المتجر وتحديث الاسم وعزل البيانات بنجاح')
    } catch (err: any) {
      toast.error('حدث خطأ أثناء الحفظ: ' + err.message)
    } finally {
      setIsSaving(false)
    }
  }

  const handleManualSync = async () => {
    toast.info('جاري فحص المزامنة المحلية وتصفية الطابور...')
    await syncEngine.processQueue()
    const status = await syncEngine.getSyncStatus()
    setSyncStatus(status)
    toast.success('تم الانتهاء من فحص وتصفية المزامنة بنجاح')
  }

  const handleClearFailed = async () => {
    await syncEngine.clearAllOperations()
    const status = await syncEngine.getSyncStatus()
    setSyncStatus(status)
    toast.success('تم مسح وتنظيف طابور العمليات بنجاح')
  }

  return (
    <div className="space-y-6 pb-24 select-none" dir="rtl">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-sm transition-colors">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
            إعدادات منظومة ERP المحاسبية
          </h1>
          <p className="text-xs sm:text-sm font-semibold text-slate-500 dark:text-slate-400 mt-0.5">
            تخصيص نوع النشاط التجاري، التوثيق والترخيص الأوفلاين، الطابعات، والربط السحابي
          </p>
        </div>

        <Button 
          onClick={handleSaveAllSettings} 
          size="lg" 
          disabled={isSaving} 
          className="w-full sm:w-auto h-12 px-8 text-sm font-black bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-xl shadow-md shadow-blue-600/25 active:scale-95 transition-all cursor-pointer"
        >
          <Save className="h-5 w-5 ml-2" />
          {isSaving ? 'جاري الحفظ...' : 'حفظ الإعدادات'}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* 1. Business Profile Card */}
        <Card className="border-slate-200/90 dark:border-slate-800 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-slate-900 dark:text-white">
              <Layers className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              تخصيص نوع النشاط التجاري (Dynamic Profile)
            </CardTitle>
            <CardDescription>
              يتحكم تلقائياً في إظهار أو إخفاء حقول الإدخال حسب طبيعة عملك (إخفاء بيانات الصيدليات لسوبر ماركت)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-600 dark:text-slate-300">طبيعة ونوع النشاط</Label>
              <Select 
                value={localBusinessType} 
                onValueChange={async (val) => {
                  const newType = val as BusinessType
                  setLocalBusinessType(newType)
                  const tenant = getTenantInfo(newType)
                  const storeInDb = await db.stores.where('id').equals(tenant.storeId).first()
                  const savedName = storeInDb?.name || (typeof window !== 'undefined' && localStorage.getItem(`erp_store_name_${newType}`)) || tenant.defaultName
                  setLocalStoreName(savedName)
                }}
              >
                <SelectTrigger className="h-12 text-sm font-bold bg-slate-50/80 dark:bg-slate-800/80 rounded-xl">
                  <SelectValue placeholder="اختر نوع النشاط">
                    {localBusinessType === 'supermarket' ? 'سوبر ماركت وبقالة (باركود متعدد + عبوات وتجزئة + ميزان)' :
                     localBusinessType === 'pharmacy' ? 'صيدلية ومستلزمات طبية (المادة الفعالة وتواريخ الصلاحية)' :
                     localBusinessType === 'clothing' ? 'محلات ملابس وأحذية (مقاسات وألوان)' :
                     'تجارة عامة ومخازن (قطع ومخزون وسريال)'}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="rounded-xl shadow-xl dark:bg-slate-900 dark:border-slate-800">
                  <SelectItem value="supermarket">سوبر ماركت وبقالة (باركود متعدد + عبوات وتجزئة + ميزان)</SelectItem>
                  <SelectItem value="general">تجارة عامة ومخازن (قطع ومخزون وسريال)</SelectItem>
                  <SelectItem value="pharmacy">صيدلية ومستلزمات طبية (المادة الفعالة وتواريخ الصلاحية)</SelectItem>
                  <SelectItem value="clothing">محلات ملابس وأحذية (مقاسات وألوان)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="p-4 rounded-xl bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/50 text-xs leading-relaxed text-blue-900 dark:text-blue-200 font-medium">
              {localBusinessType === 'supermarket' && (
                <span>✅ <strong>ملف السوبر ماركت مفعل:</strong> تم إخفاء كافة الحقول غير المناسبة (كالروشتة والمادة الفعالة) والاعتماد على تعدد الباركود، المستويات التعبوية، وتفعيل أوزان الميزان.</span>
              )}
              {localBusinessType === 'general' && (
                <span>✅ <strong>ملف التجارة العامة مفعل:</strong> نظام محاسبي نقي للأصناف والقطع وإدارة المشتريات والمبيعات والمخازن.</span>
              )}
              {localBusinessType === 'pharmacy' && (
                <span>💊 <strong>ملف الصيدليات مفعل:</strong> إظهار الاسم العلمي، المادة الفعالة، والتشغيلات وتواريخ الصلاحية وتصنيفات الأدوية.</span>
              )}
              {localBusinessType === 'clothing' && (
                <span>👕 <strong>ملف الملابس مفعل:</strong> دعم جدول المقاسات والألوان والباركود المتعدد وتصنيفات الموضة.</span>
              )}
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={async () => {
                await purgeAndReseedCategories(localBusinessType)
                toast.success(`تم تطهير وإعادة تهيئة تصنيفات (${localBusinessType}) بنجاح`)
              }}
              className="w-full h-11 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 font-bold text-xs hover:bg-blue-50 dark:hover:bg-blue-950/40 cursor-pointer"
            >
              <RefreshCw className="w-4 h-4 ml-2 text-blue-600" />
              تطهير وإعادة تهيئة التصنيفات الافتراضية للنشاط المختار
            </Button>
          </CardContent>
        </Card>

        {/* 2. Store Profile Card */}
        <Card className="border-slate-200/90 dark:border-slate-800 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-slate-900 dark:text-white">
              <Store className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              بيانات المنشأة والفواتير
            </CardTitle>
            <CardDescription>الاسم الذي يظهر في ترويسة الفواتير والإيصالات</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold text-slate-600 dark:text-slate-300">اسم المنشأة / المحل</Label>
                <button
                  type="button"
                  onClick={() => {
                    const defaultName = getTenantInfo(localBusinessType).defaultName
                    setLocalStoreName(defaultName)
                    toast.info(`تم استعادة الاسم الافتراضي: ${defaultName}`)
                  }}
                  className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                >
                  استعادة الاسم الافتراضي
                </button>
              </div>
              <Input 
                value={localStoreName} 
                onChange={e => setLocalStoreName(e.target.value)} 
                className="h-12 text-base font-bold bg-slate-50/80 dark:bg-slate-800/80 rounded-xl" 
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-600 dark:text-slate-300">العملة الافتراضية</Label>
                <Select value={currency} onValueChange={setCurrency}>
                  <SelectTrigger className="h-12 text-sm font-bold bg-slate-50/80 dark:bg-slate-800/80 rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl shadow-xl dark:bg-slate-900 dark:border-slate-800">
                    <SelectItem value="EGP">جنيه مصري (EGP)</SelectItem>
                    <SelectItem value="SAR">ريال سعودي (SAR)</SelectItem>
                    <SelectItem value="USD">دولار أمريكي (USD)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-600 dark:text-slate-300">نسبة الضريبة (%)</Label>
                <Input 
                  type="number" 
                  min="0" 
                  value={taxRate} 
                  onChange={e => setTaxRate(Math.max(0, parseFloat(e.target.value) || 0).toString())} 
                  className="h-12 font-bold font-mono bg-slate-50/80 dark:bg-slate-800/80 rounded-xl text-center" 
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 3. Offline Activation & License Token Card */}
        <Card className="border-slate-200/90 dark:border-slate-800 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-slate-900 dark:text-white">
              <Key className="h-5 w-5 text-amber-500" />
              التوثيق والتفعيل الأوفلاين (Offline Token)
            </CardTitle>
            <CardDescription>
              تفعيل المنظومة محلياً للعمل دون انقطاع ودون الحاجة لاتصال مستمر بالإنترنت
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-600 dark:text-slate-300">رمز التفعيل والترخيص المحلي (Activation Token)</Label>
              <Input 
                value={inputToken} 
                onChange={e => setInputToken(e.target.value)} 
                className="h-12 font-mono text-sm bg-slate-50/80 dark:bg-slate-800/80 rounded-xl"
                placeholder="APR-ACT-XXXX-XXXX"
              />
            </div>

            <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-500" />
                <div>
                  <p className="text-xs font-bold text-slate-900 dark:text-white">حالة الترخيص للجهاز</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">يعمل أوفلاين مع تخزين محلي آمن في IndexedDB</p>
                </div>
              </div>
              <span className="text-xs font-black px-3 py-1 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-lg">
                {isActivated ? 'مرخص ونشط' : 'قيد التفعيل'}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* 4. Thermal Printer Card */}
        <Card className="border-slate-200/90 dark:border-slate-800 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-slate-900 dark:text-white">
              <Printer className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              إعدادات الطابعة الحرارية
            </CardTitle>
            <CardDescription>مقاس ورق الفاتورة والتذييل المطبوع في إيصال الكاشير</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-600 dark:text-slate-300">مقاس ورق الطابعة الحرارية</Label>
              <Select value={printerPaperSize} onValueChange={setPrinterPaperSize}>
                <SelectTrigger className="h-12 text-sm font-bold bg-slate-50/80 dark:bg-slate-800/80 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl shadow-xl dark:bg-slate-900 dark:border-slate-800">
                  <SelectItem value="80mm">طابعة كاشير عريضة (80mm - القياسية)</SelectItem>
                  <SelectItem value="58mm">طابعة كاشير صغيرة (58mm - المحمولة)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-600 dark:text-slate-300">تذييل الفاتورة (رسالة الشكر أسفل الإيصال)</Label>
              <Input 
                value={receiptFooter} 
                onChange={e => setReceiptFooter(e.target.value)} 
                className="h-12 text-sm bg-slate-50/80 dark:bg-slate-800/80 rounded-xl" 
              />
            </div>
          </CardContent>
        </Card>

        {/* 5. Database & Cloud Sync Card */}
        <Card className="lg:col-span-2 border-slate-200/90 dark:border-slate-800 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-slate-900 dark:text-white">
              <Database className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              حالة المزامنة السحابية (Offline-First Engine)
            </CardTitle>
            <CardDescription>مراقبة العمليات المحلية المعلقة وترحيلها التلقائي إلى Supabase</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-5 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200/90 dark:border-slate-700">
                <p className="text-xs font-bold text-slate-500 dark:text-slate-400">عمليات بانتظار المزامنة</p>
                <p className="text-3xl font-black text-amber-600 dark:text-amber-400 font-mono mt-1">{syncStatus.pending}</p>
              </div>

              <div className="p-5 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200/90 dark:border-slate-700">
                <p className="text-xs font-bold text-slate-500 dark:text-slate-400">تمت مزامنتها بنجاح</p>
                <p className="text-3xl font-black text-emerald-600 dark:text-emerald-400 font-mono mt-1">{syncStatus.synced}</p>
              </div>

              <div className="p-5 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200/90 dark:border-slate-700">
                <p className="text-xs font-bold text-slate-500 dark:text-slate-400">فشلت المزامنة</p>
                <p className="text-3xl font-black text-rose-600 dark:text-rose-400 font-mono mt-1">{syncStatus.failed}</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button 
                onClick={handleManualSync} 
                variant="outline" 
                size="lg" 
                className="gap-2 font-bold h-12 rounded-xl text-sm border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <RefreshCw className="h-4 w-4 ml-1 text-blue-600 dark:text-blue-400" />
                فحص ومزامنة فورية الآن
              </Button>

              {syncStatus.failed > 0 && (
                <Button 
                  onClick={handleClearFailed} 
                  variant="outline" 
                  size="lg" 
                  className="gap-2 font-bold h-12 rounded-xl text-sm border-rose-300 dark:border-rose-800 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                >
                  <Trash2 className="h-4 w-4 ml-1" />
                  مسح العمليات العالقة ({syncStatus.failed})
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* 6. Danger Zone: 3-Tier Database Reset & System Purge */}
        <Card className="lg:col-span-2 border-rose-200 dark:border-rose-900/50 bg-rose-50/20 dark:bg-rose-950/10 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
              <ShieldAlert className="h-5 w-5 text-rose-600 dark:text-rose-400" />
              منطقة العمليات الحساسة ونظام تصفير البيانات ثلاثي المستويات (3-Tier Purge)
            </CardTitle>
            <CardDescription className="text-slate-600 dark:text-slate-400">
              خيارات متدرجة لتصفير النظام قبل تسليمه للعميل أو لبدء سنة مالية جديدة بأمان تام
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">

            {/* Quick Option: Sales Invoices Only */}
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4 flex-wrap">
              <div>
                <p className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <Trash2 className="w-4 h-4 text-slate-500" />
                  مسح فواتير المبيعات فقط
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  حذف كافة فواتير المبيعات مع الإبقاء على المخزون والأصناف والمشتريات والعملاء
                </p>
              </div>

              <Button
                type="button"
                onClick={() => setIsResetSalesModalOpen(true)}
                variant="outline"
                className="font-bold text-xs h-11 px-5 rounded-xl cursor-pointer border-slate-300 dark:border-slate-700"
              >
                تصفير المبيعات فقط
              </Button>
            </div>

            {/* Tier 3: Reset Transactions Keep Pricing */}
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-800/80 flex items-center justify-between gap-4 flex-wrap">
              <div>
                <p className="text-sm font-black text-amber-600 dark:text-amber-400 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-600 flex items-center justify-center text-xs font-black">3</span>
                  المستوى الثالث: تصفير الحركات مع الحفاظ على التكويد والأسعار
                </p>
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                  ✅ <strong>يُبقي:</strong> أسماء الأصناف، الباركودات، الوحدات، التصنيفات، وأسعار الشراء والبيع الثابتة. <br />
                  ❌ <strong>يحذف:</strong> فواتير البيع والشراء، والورديات، وحركات المخزن، ويصفر رصيد المخزون إلى 0.
                </p>
              </div>

              <Button
                type="button"
                onClick={() => setIsResetTier3ModalOpen(true)}
                className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs h-11 px-5 rounded-xl cursor-pointer shadow-md shadow-amber-600/20"
              >
                تصفير الحركات (بقاء الأسعار)
              </Button>
            </div>

            {/* Tier 2: Reset Transactions Keep Items Structure */}
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-orange-300 dark:border-orange-800/80 flex items-center justify-between gap-4 flex-wrap">
              <div>
                <p className="text-sm font-black text-orange-600 dark:text-orange-400 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-orange-500/20 text-orange-600 flex items-center justify-center text-xs font-black">2</span>
                  المستوى الثاني: تصفير الحسابات مع إبقاء هيكل الأصناف
                </p>
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                  ✅ <strong>يُبقي:</strong> أسماء الأصناف، الباركودات، الوحدات، التصنيفات، وبيانات العملاء والموردين. <br />
                  ❌ <strong>يحذف:</strong> كافة العمليات المالية والفواتير والورديات ويصفر الأسعار والأرصدة إلى 0.
                </p>
              </div>

              <Button
                type="button"
                onClick={() => setIsResetTier2ModalOpen(true)}
                className="bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs h-11 px-5 rounded-xl cursor-pointer shadow-md shadow-orange-600/20"
              >
                تصفير شامل (بقاء الأصناف)
              </Button>
            </div>

            {/* Tier 1: Full Factory Reset */}
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-rose-400 dark:border-rose-800 flex items-center justify-between gap-4 flex-wrap">
              <div>
                <p className="text-sm font-black text-rose-600 dark:text-rose-400 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400" />
                  المستوى الأول: تدمير شامل وإعادة ضبط المصنع (Factory Reset)
                </p>
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                  مسح كامل لكافة الأصناف والمخزون والفواتير والعملاء والموردين والموظفين — المنظومة تعود كأنها مثبتة حديثاً
                </p>
              </div>

              <Button
                type="button"
                onClick={() => setIsResetTier1ModalOpen(true)}
                className="bg-rose-600 hover:bg-rose-700 text-white font-black text-xs h-11 px-5 rounded-xl cursor-pointer shadow-lg shadow-rose-600/30"
              >
                تدمير شامل (Factory Reset)
              </Button>
            </div>

          </CardContent>
        </Card>

      </div>

      {/* Modal: Tier 1 Full Factory Reset */}
      {isResetTier1ModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border-2 border-rose-500 rounded-3xl p-6 w-full max-w-lg shadow-2xl space-y-5 text-right" dir="rtl">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-lg font-black text-rose-600 dark:text-rose-400 flex items-center gap-2">
                <AlertTriangle className="w-6 h-6 text-rose-600 dark:text-rose-400 animate-bounce" />
                المستوى 1: تدمير شامل وضبط المصنع (Factory Reset)
              </h3>
              <button
                type="button"
                onClick={() => setIsResetTier1ModalOpen(false)}
                className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 space-y-2 text-xs font-bold text-rose-950 dark:text-rose-200 leading-relaxed">
              <p className="text-sm font-black text-rose-600 dark:text-rose-400">⚠️ تحذير نهائي لا يمكن التراجع عنه:</p>
              <p>سيتم مسح قاعدة البيانات بالكامل وإعادة المنظومة كأنها طازجة تماماً:</p>
              <ul className="list-disc list-inside space-y-1 text-slate-700 dark:text-slate-300 font-semibold">
                <li>سيتم مسح كافة الأصناف والباركودات ووحدات القياس.</li>
                <li>سيتم تصفير المخزون بالكامل وحركات كشف الحساب.</li>
                <li>سيتم حذف كافة فواتير المبيعات والمشتريات والمصروفات والورديات.</li>
                <li>سيتم حذف حسابات العملاء والموردين والموظفين.</li>
              </ul>
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                disabled={isExecutingReset}
                onClick={() => setIsResetTier1ModalOpen(false)}
                className="flex-1 h-12 rounded-xl text-sm font-bold border-slate-300 dark:border-slate-700"
              >
                إلغاء وتراجع
              </Button>
              <Button
                type="button"
                disabled={isExecutingReset}
                onClick={handleExecuteResetTier1}
                className="flex-1 h-12 rounded-xl text-sm font-black bg-rose-600 hover:bg-rose-700 text-white shadow-lg shadow-rose-600/30"
              >
                {isExecutingReset ? 'جاري التدمير والتهيئة...' : 'نعم، مسح شامل لكل شيء'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Tier 2 Reset Keep Items */}
      {isResetTier2ModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border-2 border-orange-500 rounded-3xl p-6 w-full max-w-lg shadow-2xl space-y-5 text-right" dir="rtl">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-lg font-black text-orange-600 dark:text-orange-400 flex items-center gap-2">
                <AlertTriangle className="w-6 h-6 text-orange-500" />
                المستوى 2: تصفير الحسابات مع إبقاء هيكل الأصناف
              </h3>
              <button
                type="button"
                onClick={() => setIsResetTier2ModalOpen(false)}
                className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 rounded-2xl bg-orange-50 dark:bg-orange-950/40 border border-orange-200 dark:border-orange-900 space-y-2 text-xs font-bold text-orange-950 dark:text-orange-200 leading-relaxed">
              <p className="text-sm font-black text-orange-600 dark:text-orange-400">⚠️ ماذا سيحدث في هذا المستوى:</p>
              <p>سيتم تصفير كافة العمليات المالية والحسابية مع الإبقاء على الأصناف:</p>
              <ul className="list-disc list-inside space-y-1 text-slate-700 dark:text-slate-300 font-semibold">
                <li>✅ تبقى أسماء الأصناف والباركودات والوحدات والتصنيفات.</li>
                <li>❌ تُحذف جميع فواتير البيع والشراء والورديات وسجلات المخزن.</li>
                <li>❌ يتم تصفير أرصدة المخزون إلى صفر، وتصفير أسعار الشراء والبيع لتحديدها لاحقاً.</li>
                <li>❌ يتم تصفير أرصدة العملاء والموردين.</li>
              </ul>
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                disabled={isExecutingReset}
                onClick={() => setIsResetTier2ModalOpen(false)}
                className="flex-1 h-12 rounded-xl text-sm font-bold border-slate-300 dark:border-slate-700"
              >
                إلغاء وتراجع
              </Button>
              <Button
                type="button"
                disabled={isExecutingReset}
                onClick={handleExecuteResetTier2}
                className="flex-1 h-12 rounded-xl text-sm font-black bg-orange-600 hover:bg-orange-700 text-white shadow-lg shadow-orange-600/30"
              >
                {isExecutingReset ? 'جاري التصفير...' : 'تأكيد تصفير الحسابات'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Tier 3 Reset Keep Pricing */}
      {isResetTier3ModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border-2 border-amber-500 rounded-3xl p-6 w-full max-w-lg shadow-2xl space-y-5 text-right" dir="rtl">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-lg font-black text-amber-600 dark:text-amber-400 flex items-center gap-2">
                <Trash2 className="w-6 h-6 text-amber-500" />
                المستوى 3: تصفير الحركات مع الحفاظ على التكويد والأسعار
              </h3>
              <button
                type="button"
                onClick={() => setIsResetTier3ModalOpen(false)}
                className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 space-y-2 text-xs font-bold text-amber-950 dark:text-amber-200 leading-relaxed">
              <p className="text-sm font-black text-amber-600 dark:text-amber-400">ℹ️ الوضع المثالي لبدء سنة مالية جديدة أو تسليم المنظومة بعد التكويد:</p>
              <ul className="list-disc list-inside space-y-1 text-slate-700 dark:text-slate-300 font-semibold">
                <li>✅ <strong>الحفاظ الكامل</strong> على أسماء الأصناف، الباركود، الوحدات، وأسعار الشراء والبيع الثابتة.</li>
                <li>❌ حذف كافة فواتير المبيعات، المشتريات، المرتجعات، والورديات.</li>
                <li>❌ تصفير أرصدة المخزون بالكامل (تصبح 0) لتسجيل رصيد أول مدة جديد.</li>
                <li>❌ تصفير أرصدة العملاء والموردين.</li>
              </ul>
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                disabled={isExecutingReset}
                onClick={() => setIsResetTier3ModalOpen(false)}
                className="flex-1 h-12 rounded-xl text-sm font-bold border-slate-300 dark:border-slate-700"
              >
                إلغاء وتراجع
              </Button>
              <Button
                type="button"
                disabled={isExecutingReset}
                onClick={handleExecuteResetTier3}
                className="flex-1 h-12 rounded-xl text-sm font-black bg-amber-600 hover:bg-amber-700 text-white shadow-lg shadow-amber-600/30"
              >
                {isExecutingReset ? 'جاري التصفير...' : 'تأكيد تصفير الحركات'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Sales Invoices Reset Confirmation */}
      {isResetSalesModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border-2 border-slate-400 rounded-3xl p-6 w-full max-w-lg shadow-2xl space-y-5 text-right" dir="rtl">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-lg font-black text-slate-800 dark:text-slate-200 flex items-center gap-2">
                <Trash2 className="w-6 h-6 text-slate-500" />
                تأكيد حذف وتصفير سجل فواتير المبيعات
              </h3>
              <button
                type="button"
                onClick={() => setIsResetSalesModalOpen(false)}
                className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 rounded-2xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-2 text-xs font-bold text-slate-900 dark:text-slate-200 leading-relaxed">
              <p className="text-sm font-black text-slate-700 dark:text-slate-300">⚠️ تأكيد مسح الفواتير:</p>
              <p>سيتم حذف كافة فواتير المبيعات المسجلة وتصفير إحصائيات المبيعات، مع الحفاظ على الأصناف والمخزون الحالي دون تغيير.</p>
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                disabled={isExecutingReset}
                onClick={() => setIsResetSalesModalOpen(false)}
                className="flex-1 h-12 rounded-xl text-sm font-bold border-slate-300 dark:border-slate-700"
              >
                إلغاء وتراجع
              </Button>
              <Button
                type="button"
                disabled={isExecutingReset}
                onClick={handleExecuteResetSales}
                className="flex-1 h-12 rounded-xl text-sm font-black bg-slate-800 hover:bg-slate-700 text-white shadow-lg"
              >
                {isExecutingReset ? 'جاري المسح...' : 'نعم، امسح الفواتير'}
              </Button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
