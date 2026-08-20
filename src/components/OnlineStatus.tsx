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
      <div className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-slate-400 font-medium">
        <span className="w-2 h-2 rounded-full bg-emerald-500" />
        <Wifi className="w-3.5 h-3.5 opacity-70" />
      </div>
    )
  }

  return (
    <div
      className="flex items-center gap-2 px-2.5 py-1 text-xs font-medium text-slate-400 hover:text-slate-200 transition-colors"
      title={isOnline ? 'متصل بالسيرفر والمزامنة السحابية' : 'يعمل محلياً (أوفلاين)'}
    >
      <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`} />
      {isOnline ? (
        <span className="text-slate-400 font-mono text-[11px]">Sync OK</span>
      ) : (
        <span className="text-amber-400 font-mono text-[11px]">Offline</span>
      )}
    </div>
  )
}
