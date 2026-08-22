'use client'

import React, { useState, useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/lib/db'
import { useStore } from '@/lib/store-context'
import { formatCurrency } from '@/lib/finance'
import { 
  Tag, 
  Printer, 
  Search, 
  Layers, 
  CheckCircle2, 
  Sliders, 
  Eye,
  Barcode as BarcodeIcon,
  Sparkles
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'

export default function BarcodePrintPage() {
  const { storeId, storeName, isPharma } = useStore()

  const items = useLiveQuery(
    () => db.items.where('store_id').equals(storeId).toArray(),
    [storeId]
  ) || []

  const itemBarcodes = useLiveQuery(() => db.item_barcodes.toArray()) || []

  const [searchQuery, setSearchQuery] = useState('')
  const [selectedItemId, setSelectedItemId] = useState<string>('')
  const [copies, setCopies] = useState<number>(10)
  const [labelSize, setLabelSize] = useState<'38x25' | '50x30' | '80mm'>('38x25')
  const [showStoreName, setShowStoreName] = useState(true)
  const [showPrice, setShowPrice] = useState(true)
  const [showCode, setShowCode] = useState(true)

  // Auto-select first item if available and none selected
  const selectedItem = useMemo(() => {
    if (selectedItemId) {
      return items.find(i => i.id === selectedItemId)
    }
    return items[0]
  }, [items, selectedItemId])

  const selectedBarcode = useMemo(() => {
    if (!selectedItem) return '6221234567890'
    const found = itemBarcodes.find(b => b.item_id === selectedItem.id)
    return found?.barcode || '622' + selectedItem.id.slice(0, 10).replace(/[^0-9]/g, '1').padEnd(10, '0')
  }, [selectedItem, itemBarcodes])

  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return items
    const q = searchQuery.toLowerCase()
    return items.filter(i => 
      i.name.toLowerCase().includes(q) || 
      (i.name_en && i.name_en.toLowerCase().includes(q))
    )
  }, [items, searchQuery])

  const handlePrint = () => {
    if (!selectedItem) {
      toast.error('يرجى اختيار صنف أولاً لطباعة ملصقاته')
      return
    }
    window.print()
  }

  return (
    <div className="space-y-6 pb-16 select-none" dir="rtl">
      {/* Non-printable Controls */}
      <div className="print:hidden space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-xs">
          <div>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
              <Tag className="w-6 h-6 text-blue-500" />
              طباعة وتوليد ملصقات الباركود
            </h1>
            <p className="text-xs sm:text-sm font-semibold text-slate-500 dark:text-slate-400 mt-1">
              طباعة استيكرات الباركود الحرارية للأصناف بحجم مخصص للطابعات الحرارية (Barcode Printers)
            </p>
          </div>

          <Button
            onClick={handlePrint}
            className="h-12 px-6 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-xl shadow-lg shadow-blue-600/30 gap-2 cursor-pointer"
          >
            <Printer className="w-5 h-5" />
            طباعة الاستيكرات الآن ({copies} ملصق)
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Controls & Item Selector */}
          <Card className="bg-slate-900 border-slate-800 text-white rounded-2xl shadow-sm lg:col-span-1">
            <CardHeader>
              <CardTitle className="text-base font-black flex items-center gap-2 text-white">
                <Sliders className="w-4 h-4 text-blue-400" />
                تخصيص الملصق والكمية
              </CardTitle>
              <CardDescription className="text-xs text-slate-400">
                حدد الصنف وعدد النسخ وحجم الاستيكر
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Item Search & Selection */}
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-300">بحث واختيار الصنف</Label>
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3.5" />
                  <Input
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="اكتب اسم الصنف..."
                    className="h-11 pr-9 bg-slate-950/80 border-slate-800 text-white rounded-xl text-xs font-bold"
                  />
                </div>

                <div className="max-h-44 overflow-y-auto space-y-1 mt-2 border border-slate-800 rounded-xl p-1 bg-slate-950/50 custom-scrollbar">
                  {filteredItems.slice(0, 15).map(item => (
                    <div
                      key={item.id}
                      onClick={() => setSelectedItemId(item.id)}
                      className={`p-2 rounded-lg text-xs font-bold flex items-center justify-between cursor-pointer transition-colors ${
                        (selectedItem?.id === item.id)
                          ? 'bg-blue-600 text-white'
                          : 'text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      <span className="truncate">{item.name}</span>
                      <span className="font-mono text-[10px] shrink-0 mr-2">
                        {formatCurrency(item.sell_price)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Number of copies */}
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-300">عدد الاستيكرات للطباعة</Label>
                <Input
                  type="number"
                  min="1"
                  max="500"
                  value={copies}
                  onChange={e => setCopies(Math.max(1, parseInt(e.target.value) || 1))}
                  className="h-11 bg-slate-950/80 border-slate-800 text-white rounded-xl text-base font-black font-mono text-center"
                />
              </div>

              {/* Label size preset */}
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-300">مقاس ورق الاستيكر الحراري</Label>
                <Select value={labelSize} onValueChange={(val: any) => setLabelSize(val)}>
                  <SelectTrigger className="h-11 bg-slate-950/80 border-slate-800 text-white rounded-xl text-xs font-bold">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-800 text-white rounded-xl text-xs">
                    <SelectItem value="38x25">38 × 25 مم (الصيدليات والسوبر ماركت)</SelectItem>
                    <SelectItem value="50x30">50 × 30 مم (الملابس والمحلات)</SelectItem>
                    <SelectItem value="80mm">80 مم (ورق حراري متصل)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Toggle Options */}
              <div className="space-y-2 pt-2 border-t border-slate-800">
                <label className="flex items-center gap-2 text-xs font-bold text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showStoreName}
                    onChange={e => setShowStoreName(e.target.checked)}
                    className="rounded border-slate-700 text-blue-600 focus:ring-blue-500"
                  />
                  إظهار اسم المحل / المنشأة في أعلى الملصق
                </label>
                <label className="flex items-center gap-2 text-xs font-bold text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showPrice}
                    onChange={e => setShowPrice(e.target.checked)}
                    className="rounded border-slate-700 text-blue-600 focus:ring-blue-500"
                  />
                  إظهار سعر البيع
                </label>
                <label className="flex items-center gap-2 text-xs font-bold text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showCode}
                    onChange={e => setShowCode(e.target.checked)}
                    className="rounded border-slate-700 text-blue-600 focus:ring-blue-500"
                  />
                  إظهار أرقام الباركود أسفل الخطوط
                </label>
              </div>
            </CardContent>
          </Card>

          {/* Live Preview Box */}
          <Card className="bg-slate-900 border-slate-800 text-white rounded-2xl shadow-sm lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base font-black flex items-center gap-2 text-white">
                <Eye className="w-4 h-4 text-emerald-400" />
                معاينة شكل الملصق الحراري
              </CardTitle>
              <CardDescription className="text-xs text-slate-400">
                هكذا سيظهر شكل الاستيكر عند إرساله لطابعة الباركود
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center justify-center p-8 bg-slate-950/60 rounded-2xl border border-slate-800/80 min-h-[300px]">
              {selectedItem ? (
                <div className="space-y-6">
                  {/* Single Label Mockup */}
                  <div 
                    className="bg-white text-black p-3 rounded-lg shadow-xl border border-slate-300 flex flex-col items-center justify-between text-center mx-auto transition-all"
                    style={{
                      width: labelSize === '38x25' ? '220px' : labelSize === '50x30' ? '280px' : '320px',
                      minHeight: labelSize === '38x25' ? '140px' : '170px',
                    }}
                  >
                    {showStoreName && (
                      <p className="text-[10px] font-black text-slate-700 truncate w-full border-b border-slate-200 pb-0.5">
                        {storeName}
                      </p>
                    )}
                    
                    <p className="text-xs font-black text-black line-clamp-2 mt-1 leading-tight">
                      {selectedItem.name}
                    </p>

                    {/* Barcode Simulated Visual Lines */}
                    <div className="my-1.5 flex flex-col items-center">
                      <div className="h-9 w-44 flex items-center justify-center gap-0.5 bg-white px-1">
                        {Array.from({ length: 32 }).map((_, i) => (
                          <div
                            key={i}
                            className="h-full bg-black"
                            style={{
                              width: (i % 3 === 0 || i % 7 === 0) ? '3px' : '1.5px',
                              marginRight: (i % 4 === 0) ? '2px' : '1px',
                            }}
                          />
                        ))}
                      </div>
                      {showCode && (
                        <p className="font-mono text-[10px] font-bold tracking-widest text-slate-900 mt-0.5">
                          {selectedBarcode}
                        </p>
                      )}
                    </div>

                    {showPrice && (
                      <div className="w-full flex items-center justify-between border-t border-slate-200 pt-0.5 mt-0.5">
                        <span className="text-[9px] font-bold text-slate-600">السعر:</span>
                        <span className="text-xs font-black text-black font-mono">
                          {formatCurrency(selectedItem.sell_price)}
                        </span>
                      </div>
                    )}
                  </div>

                  <p className="text-xs font-semibold text-slate-400 text-center">
                    سيتم طباعة <strong className="text-white font-mono">{copies}</strong> ملصق لهذا الصنف
                  </p>
                </div>
              ) : (
                <p className="text-slate-500 font-bold text-sm">
                  اختر صنفاً من القائمة الجانبية لمعاينة الباركود
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Printable Area (Only visible when printing) */}
      <div className="hidden print:grid print:grid-cols-2 print:gap-2 text-black bg-white" dir="rtl">
        {selectedItem && Array.from({ length: copies }).map((_, idx) => (
          <div
            key={idx}
            className="p-2 border border-dashed border-slate-400 flex flex-col items-center justify-between text-center break-inside-avoid"
            style={{ minHeight: '120px' }}
          >
            {showStoreName && (
              <p className="text-[9px] font-black text-slate-700 truncate w-full">
                {storeName}
              </p>
            )}
            <p className="text-[11px] font-black text-black line-clamp-1">
              {selectedItem.name}
            </p>
            <div className="my-1 flex flex-col items-center">
              <div className="h-7 w-36 flex items-center justify-center gap-0.5 bg-white">
                {Array.from({ length: 28 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-full bg-black"
                    style={{
                      width: (i % 3 === 0) ? '2.5px' : '1.5px',
                      marginRight: '1px',
                    }}
                  />
                ))}
              </div>
              {showCode && (
                <p className="font-mono text-[8px] font-bold tracking-wider">
                  {selectedBarcode}
                </p>
              )}
            </div>
            {showPrice && (
              <p className="text-[10px] font-black text-black font-mono">
                {formatCurrency(selectedItem.sell_price)}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
