'use client'

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'

interface StoreContextType {
  storeId: string | null
  branchId: string | null
  userId: string | null
  isOnline: boolean
  setStoreId: (id: string | null) => void
  setBranchId: (id: string | null) => void
  setUserId: (id: string | null) => void
}

const StoreContext = createContext<StoreContextType | undefined>(undefined)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [storeId, setStoreId] = useState<string | null>(null)
  const [branchId, setBranchId] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [isOnline, setIsOnline] = useState<boolean>(true)

  useEffect(() => {
    // Set initial online status
    setIsOnline(typeof window !== 'undefined' ? navigator.onLine : true)

    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  return (
    <StoreContext.Provider
      value={{
        storeId,
        branchId,
        userId,
        isOnline,
        setStoreId,
        setBranchId,
        setUserId,
      }}
    >
      {children}
    </StoreContext.Provider>
  )
}

export function useStore() {
  const context = useContext(StoreContext)
  if (context === undefined) {
    throw new Error('useStore must be used within a StoreProvider')
  }
  return context
}
