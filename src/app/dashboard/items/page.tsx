'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/lib/db'
import { useStore } from '@/lib/store-context'
import { DEFAULT_STORE_UUID } from '@/lib/sync-engine'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Plus, Search, Package, PackageSearch, Tag, ArrowUpRight } from 'lucide-react'

export default function ItemsPage() {
  const router = useRouter()
  const { storeId } = useStore()
  const currentStoreId = storeId || DEFAULT_STORE_UUID
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')

  // Fetch categories strictly for current store
  const categories = useLiveQuery(
    () => db.categories.where('store_id').equals(currentStoreId).sortBy('sort_order'),
    [currentStoreId]
  ) || []

  // Fetch items and stock balances strictly for current store
  const itemsData = useLiveQuery(async () => {
    let items = await db.items.where('store_id').equals(currentStoreId).sortBy('created_at')
    
    // Filter by search query
    if (searchQuery) {
      const lowerQuery = searchQuery.toLowerCase()
      items = items.filter(item => (item.search_text || item.name || '').toLowerCase().includes(lowerQuery))
    }
    
    // Filter by category
    if (selectedCategory && selectedCategory !== 'all') {
      items = items.filter(item => item.category_id === selectedCategory)
    }

    // Fetch stock balances strictly for this store
    const stockBalances = await db.stock_balances.where('store_id').equals(currentStoreId).toArray()
    const stockMap = new Map<string, number>()
    stockBalances.forEach(sb => {
      stockMap.set(sb.item_id, (stockMap.get(sb.item_id) || 0) + sb.quantity)
    })

    // Fetch barcodes for display
    const allBarcodes = await db.item_barcodes.where('store_id').equals(currentStoreId).toArray()
    const barcodeMap = new Map<string, string[]>()
    allBarcodes.forEach(b => {
      if (!barcodeMap.has(b.item_id)) {
        barcodeMap.set(b.item_id, [])
      }
      barcodeMap.get(b.item_id)!.push(b.barcode)
    })

    return items.map(item => ({
      ...item,
      current_stock: stockMap.get(item.id) || 0,
      barcodes: barcodeMap.get(item.id) || []
    })).reverse()
  }, [searchQuery, selectedCategory]) || []

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header Banner with Soft UI Depth */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-sm transition-colors">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/50 border border-blue-100 dark:border-blue-800/60 flex items-center justify-center text-blue-600 dark:text-blue-400 shadow-xs">
            <Package className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
              الأصناف والمخزون
            </h1>
            <p className="text-xs sm:text-sm font-semibold text-slate-500 dark:text-slate-400 mt-0.5">
              إدارة كتالوج المنتجات، الباركودات المتعددة، ومستويات التعبئة
            </p>
          </div>
        </div>

        <Link href="/dashboard/items/new">
          <Button size="lg" className="w-full sm:w-auto h-12 px-6 text-sm font-black bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-xl shadow-md shadow-blue-600/25 hover:shadow-lg hover:shadow-blue-600/35 hover:-translate-y-0.5 active:scale-95 transition-all duration-200">
            <Plus className="w-5 h-5 ml-2" />
            إضافة منتج جديد
          </Button>
        </Link>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-sm flex flex-col md:flex-row gap-4 items-center transition-colors">
        <div className="relative flex-1 w-full">
          <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 w-5 h-5 pointer-events-none" />
          <Input 
            type="text"
            placeholder="ابحث بالاسم، الباركود، أو كود الصنف SKU..."
            className="pr-12 h-12 text-sm text-slate-900 dark:text-slate-100 bg-slate-50/80 dark:bg-slate-800/80 border-slate-200/90 dark:border-slate-700 rounded-xl focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium placeholder:text-slate-400 dark:placeholder:text-slate-500"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="w-full md:w-64 shrink-0">
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="h-12 text-sm font-bold text-slate-800 dark:text-slate-200 bg-slate-50/80 dark:bg-slate-800/80 border-slate-200/90 dark:border-slate-700 rounded-xl">
              <SelectValue placeholder="تصفية حسب التصنيف" />
            </SelectTrigger>
            <SelectContent className="rounded-xl shadow-xl dark:bg-slate-900 dark:border-slate-800">
              <SelectItem value="all">جميع التصنيفات</SelectItem>
              {categories.map(cat => (
                <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Modern Data Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-sm overflow-hidden transition-colors">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-right border-collapse">
            <thead className="bg-slate-50/90 dark:bg-slate-800/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-extrabold text-xs tracking-wider">
              <tr>
                <th className="py-4 px-6 font-black">اسم المنتج</th>
                <th className="py-4 px-6 font-black">الباركود / SKU</th>
                <th className="py-4 px-6 font-black">سعر الشراء</th>
                <th className="py-4 px-6 font-black">سعر البيع</th>
                <th className="py-4 px-6 font-black text-center">المخزون الحالي</th>
                <th className="py-4 px-6 font-black text-center">الحالة</th>
                <th className="py-4 px-6 w-16"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 bg-white dark:bg-slate-900">
              {itemsData.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-20 text-center">
                    <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center mx-auto mb-4 text-slate-400 dark:text-slate-500">
                      <PackageSearch className="w-8 h-8 opacity-60" />
                    </div>
                    <p className="text-base font-black text-slate-800 dark:text-slate-200">لا توجد منتجات مطابقة للبحث</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
                      ابدأ بإضافة أول صنف لمخزنك بالضغط على الزر أدناه
                    </p>
                    <div className="mt-5">
                      <Link href="/dashboard/items/new">
                        <Button size="sm" className="h-10 px-5 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-xs">
                          <Plus className="w-4 h-4 ml-1.5" />
                          إضافة أول منتج الآن
                        </Button>
                      </Link>
                    </div>
                  </td>
                </tr>
              ) : (
                itemsData.map(item => {
                  const isLowStock = item.manage_inventory && item.current_stock <= (item.low_stock_alert || 0)
                  
                  return (
                    <tr 
                      key={item.id} 
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/60 cursor-pointer transition-colors duration-150 group"
                      onClick={() => router.push(`/dashboard/items/${item.id}`)}
                    >
                      {/* Name & Subtitle */}
                      <td className="py-4 px-6">
                        <div className="font-extrabold text-sm text-slate-900 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors flex items-center gap-2">
                          <span>{item.name}</span>
                          {item.allow_decimal && (
                            <span className="text-[10px] bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800/80 px-2 py-0.5 rounded-md font-bold">
                              ⚖️ ميزان (كجم)
                            </span>
                          )}
                          {item.prescription_required && (
                            <span className="text-[10px] bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800/80 px-2 py-0.5 rounded-md font-bold">
                              💊 روشتة طبية
                            </span>
                          )}
                          {(item.size || item.color) && (
                            <span className="text-[10px] bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-800/80 px-2 py-0.5 rounded-md font-bold">
                              👕 {[item.brand, item.size, item.color].filter(Boolean).join(' - ')}
                            </span>
                          )}
                        </div>
                        {item.active_ingredient && (
                          <div className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                            مادة فعالة: {item.active_ingredient}
                          </div>
                        )}
                        {item.name_en && (
                          <div className="text-[11px] font-medium text-slate-400 dark:text-slate-500 mt-0.5">{item.name_en}</div>
                        )}
                        {item.category_id && (
                          <div className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 px-2 py-0.5 rounded-md mt-1.5">
                            <Tag className="w-3 h-3 text-slate-400 dark:text-slate-500" />
                            {categories.find(c => c.id === item.category_id)?.name || 'بدون تصنيف'}
                          </div>
                        )}
                      </td>

                      {/* Barcode & SKU */}
                      <td className="py-4 px-6">
                        <div className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300">{item.sku || '-'}</div>
                        {item.barcodes.length > 0 && (
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 font-mono font-semibold">
                            {item.barcodes[0]}
                            {item.barcodes.length > 1 && (
                              <span className="mr-1 text-blue-600 dark:text-blue-400 font-black">
                                (+{item.barcodes.length - 1})
                              </span>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Buy Price */}
                      <td className="py-4 px-6 font-bold text-slate-600 dark:text-slate-400 font-mono text-sm">
                        {item.buy_price.toFixed(2)} <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500">ج.م</span>
                      </td>

                      {/* Sell Price */}
                      <td className="py-4 px-6 font-black text-blue-600 dark:text-blue-400 font-mono text-base">
                        {item.sell_price.toFixed(2)} <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500">{item.allow_decimal ? 'ج.م / كجم' : 'ج.م'}</span>
                      </td>

                      {/* Stock Pill */}
                      <td className="py-4 px-6 text-center">
                        {item.manage_inventory !== false ? (
                          <span 
                            className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-black shadow-2xs ${
                              isLowStock
                                ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                                : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                            }`}
                          >
                            {item.current_stock} {item.allow_decimal ? 'كجم' : (item.unit || 'قطعة')}
                          </span>
                        ) : (
                          <span className="text-slate-400 dark:text-slate-500 text-xs font-medium">غير متتبع</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-4 px-6 text-center">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-bold border ${
                          item.status === 'active' 
                            ? 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700' 
                            : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                        }`}>
                          {item.status === 'active' ? 'نشط' : (item.status === 'inactive' ? 'غير نشط' : 'مؤرشف')}
                        </span>
                      </td>

                      {/* Arrow Icon */}
                      <td className="py-4 px-6 text-left">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 dark:text-slate-500 group-hover:bg-blue-600 group-hover:text-white dark:group-hover:bg-blue-500 transition-all duration-200 shadow-2xs">
                          <ArrowUpRight className="w-4 h-4" />
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
