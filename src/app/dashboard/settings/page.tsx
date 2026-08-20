'use client'

import { useState, useEffect } from 'react'
import { db } from '@/lib/db'
import { syncEngine } from '@/lib/sync-engine'
import { toast } from 'sonner'
import { Save, Store, Printer, RefreshCw, Database, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export default function SettingsPage() {
  const [storeName, setStoreName] = useState('سوبر ماركت الفهد')
  const [currency, setCurrency] = useState('EGP')
  const [taxRate, setTaxRate] = useState('0')
  const [printerPaperSize, setPrinterPaperSize] = useState('80mm')
  const [receiptFooter, setReceiptFooter] = useState('شكراً لزيارتكم - نتمنى لكم يوماً سعيداً')
  const [isSaving, setIsSaving] = useState(false)
  const [syncStatus, setSyncStatus] = useState({ pending: 0, synced: 0, failed: 0 })

  useEffect(() => {
    async function loadSettings() {
      const store = await db.stores.toCollection().first()
      if (store) {
        setStoreName(store.name || 'سوبر ماركت الفهد')
        setCurrency(store.currency || 'EGP')
        setTaxRate(String(store.tax_rate || 0))
      }
      const status = await syncEngine.getSyncStatus()
      setSyncStatus(status)
    }
    loadSettings()
  }, [])

  const handleSaveStoreSettings = async () => {
    try {
      setIsSaving(true)
      const existing = await db.stores.toCollection().first()
      const now = new Date().toISOString()

      const storeData = {
        id: existing?.id || 'default',
        owner_id: existing?.owner_id || 'default-owner',
        name: storeName.trim(),
        business_type: 'supermarket',
        status: 'active' as const,
        currency,
        tax_rate: parseFloat(taxRate) || 0,
        created_at: existing?.created_at || now,
        updated_at: now,
      }

      await db.stores.put(storeData)
      syncEngine.enqueueOperation('stores', 'UPDATE', storeData)

      // Save printer settings in localStorage
      localStorage.setItem('leopard_printer_size', printerPaperSize)
      localStorage.setItem('leopard_receipt_footer', receiptFooter)

      toast.success('تم حفظ الإعدادات بنجاح')
    } catch (err: any) {
      toast.error('حدث خطأ أثناء الحفظ: ' + err.message)
    } finally {
      setIsSaving(false)
    }
  }

  const handleManualSync = async () => {
    toast.info('جاري فحص المزامنة مع السحابة...')
    await syncEngine.processQueue()
    const status = await syncEngine.getSyncStatus()
    setSyncStatus(status)
    toast.success('تم الانتهاء من المزامنة بنجاح')
  }

  return (
    <div className="space-y-6 pb-20" dir="rtl">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-sm transition-colors">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
            إعدادات النظام
          </h1>
          <p className="text-xs sm:text-sm font-semibold text-slate-500 dark:text-slate-400 mt-0.5">
            تخصيص بيانات المنشأة، الطابعات الحرارية، والربط السحابي
          </p>
        </div>

        <Button 
          onClick={handleSaveStoreSettings} 
          size="lg" 
          disabled={isSaving} 
          className="w-full sm:w-auto h-12 px-8 text-sm font-black bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-xl shadow-md shadow-blue-600/25 active:scale-95 transition-all"
        >
          <Save className="h-5 w-5 ml-2" />
          {isSaving ? 'جاري الحفظ...' : 'حفظ الإعدادات'}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Store Profile Card */}
        <Card className="border-slate-200/90 dark:border-slate-800 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-slate-900 dark:text-white">
              <Store className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              بيانات المنشأة والسوبر ماركت
            </CardTitle>
            <CardDescription>الاسم الذي يظهر في ترويسة الفواتير والإيصالات</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-600 dark:text-slate-300">اسم المتجر / السوبر ماركت</Label>
              <Input 
                value={storeName} 
                onChange={e => setStoreName(e.target.value)} 
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
                  onChange={e => setTaxRate(e.target.value)} 
                  className="h-12 font-bold font-mono bg-slate-50/80 dark:bg-slate-800/80 rounded-xl text-center" 
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Thermal Printer Card */}
        <Card className="border-slate-200/90 dark:border-slate-800 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-slate-900 dark:text-white">
              <Printer className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              إعدادات الطابعة الحرارية
            </CardTitle>
            <CardDescription>مقاس ورق الفاتورة والتذييل المطبوع</CardDescription>
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

        {/* Database & Cloud Sync Card */}
        <Card className="lg:col-span-2 border-slate-200/90 dark:border-slate-800 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-slate-900 dark:text-white">
              <Database className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              حالة المزامنة السحابية (Offline-First)
            </CardTitle>
            <CardDescription>مراقبة العمليات المحلية المعلقة والترحيل إلى Supabase</CardDescription>
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

            <Button 
              onClick={handleManualSync} 
              variant="outline" 
              size="lg" 
              className="gap-2 font-bold h-12 rounded-xl text-sm border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <RefreshCw className="h-4 w-4 ml-1 text-blue-600 dark:text-blue-400" />
              فحص ومزامنة فورية الآن
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
