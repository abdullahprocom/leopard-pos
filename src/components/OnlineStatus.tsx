'use client'

import { useState, useEffect } from 'react'
import { Wifi, WifiOff } from 'lucide-react'

export function OnlineStatus() {
  const [isOnline, setIsOnline] = useState(true)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    setIsOnline(typeof navigator !== 'undefined' ? navigator.onLine : true)

    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  if (!mounted) {
    return (
      <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/60 shadow-xs">
        <Wifi className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
        <span>متصل بالسحابة</span>
      </div>
    )
  }

  return (
    <div
      className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all shadow-xs ${
        isOnline
          ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/60'
          : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200/80 dark:border-amber-800/60'
      }`}
    >
      {isOnline ? (
        <>
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <Wifi className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
          <span>متصل بالسحابة</span>
        </>
      ) : (
        <>
          <span className="w-2 h-2 rounded-full bg-amber-500" />
          <WifiOff className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
          <span>وضع أوفلاين (محلي)</span>
        </>
      )}
    </div>
  )
}
