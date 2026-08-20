'use client'

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { BusinessType } from './types'

interface StoreContextType {
  storeId: string | null
  branchId: string | null
  userId: string | null
  storeName: string
  businessType: BusinessType
  activationToken: string | null
  isActivated: boolean
  isOnline: boolean
  setStoreId: (id: string | null) => void
  setBranchId: (id: string | null) => void
  setUserId: (id: string | null) => void
  setStoreName: (name: string) => void
  setBusinessType: (type: BusinessType) => void
  activateOfflineSystem: (token: string, name?: string, type?: BusinessType) => void
  // Convenient profile helpers
  isPharma: boolean
  isSupermarket: boolean
  isClothing: boolean
}

const StoreContext = createContext<StoreContextType | undefined>(undefined)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [storeId, setStoreId] = useState<string | null>('default-store-001')
  const [branchId, setBranchId] = useState<string | null>('default-branch-001')
  const [userId, setUserId] = useState<string | null>('admin-cashier-001')
  const [storeName, setStoreNameState] = useState<string>('APR Supermarket')
  const [businessType, setBusinessTypeState] = useState<BusinessType>('supermarket')
  const [activationToken, setActivationToken] = useState<string | null>(null)
  const [isActivated, setIsActivated] = useState<boolean>(true)
  const [isOnline, setIsOnline] = useState<boolean>(true)

  useEffect(() => {
    // 1. Set initial online status
    setIsOnline(typeof window !== 'undefined' ? navigator.onLine : true)

    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // 2. Load stored business profile & activation token from localStorage
    if (typeof window !== 'undefined') {
      const savedType = localStorage.getItem('apr_business_type') as BusinessType | null
      if (savedType) {
        setBusinessTypeState(savedType)
      }

      const savedName = localStorage.getItem('apr_store_name')
      if (savedName) {
        setStoreNameState(savedName)
      }

      const savedToken = localStorage.getItem('apr_activation_token')
      if (savedToken) {
        setActivationToken(savedToken)
        setIsActivated(true)
      } else {
        // Auto-generate local offline development token
        const devToken = 'APR-OFFLINE-ACT-998822'
        localStorage.setItem('apr_activation_token', devToken)
        setActivationToken(devToken)
        setIsActivated(true)
      }
    }

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  const setBusinessType = (type: BusinessType) => {
    setBusinessTypeState(type)
    if (typeof window !== 'undefined') {
      localStorage.setItem('apr_business_type', type)
    }
  }

  const setStoreName = (name: string) => {
    setStoreNameState(name)
    if (typeof window !== 'undefined') {
      localStorage.setItem('apr_store_name', name)
    }
  }

  const activateOfflineSystem = (token: string, name?: string, type?: BusinessType) => {
    setActivationToken(token)
    setIsActivated(true)
    if (typeof window !== 'undefined') {
      localStorage.setItem('apr_activation_token', token)
      if (name) {
        setStoreNameState(name)
        localStorage.setItem('apr_store_name', name)
      }
      if (type) {
        setBusinessTypeState(type)
        localStorage.setItem('apr_business_type', type)
      }
    }
  }

  return (
    <StoreContext.Provider
      value={{
        storeId,
        branchId,
        userId,
        storeName,
        businessType,
        activationToken,
        isActivated,
        isOnline,
        setStoreId,
        setBranchId,
        setUserId,
        setStoreName,
        setBusinessType,
        activateOfflineSystem,
        isPharma: businessType === 'pharmacy',
        isSupermarket: businessType === 'supermarket' || businessType === 'general',
        isClothing: businessType === 'clothing',
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
