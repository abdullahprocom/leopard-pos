'use client'

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { BusinessType } from './types'
import { DEFAULT_STORE_UUID, DEFAULT_BRANCH_UUID, DEFAULT_USER_UUID } from './sync-engine'
import { ensureDefaultCategories } from './db'

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
  purgeAndReseedCategories: (type?: BusinessType) => Promise<void>
  activateOfflineSystem: (token: string, name?: string, type?: BusinessType) => void
  // Convenient profile helpers
  isPharma: boolean
  isSupermarket: boolean
  isClothing: boolean
}

const StoreContext = createContext<StoreContextType | undefined>(undefined)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [storeId, setStoreId] = useState<string | null>(DEFAULT_STORE_UUID)
  const [branchId, setBranchId] = useState<string | null>(DEFAULT_BRANCH_UUID)
  const [userId, setUserId] = useState<string | null>(DEFAULT_USER_UUID)
  const [storeName, setStoreNameState] = useState<string>('ERP Supermarket')
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
      const savedType = (localStorage.getItem('erp_business_type') || localStorage.getItem('apr_business_type')) as BusinessType | null
      if (savedType) {
        setBusinessTypeState(savedType)
      }

      const savedName = localStorage.getItem('erp_store_name') || localStorage.getItem('apr_store_name')
      if (savedName) {
        setStoreNameState(savedName)
      }

      const savedToken = localStorage.getItem('erp_activation_token') || localStorage.getItem('apr_activation_token')
      if (savedToken) {
        setActivationToken(savedToken)
        setIsActivated(true)
      } else {
        // Auto-generate local offline development token
        const devToken = 'ERP-OFFLINE-ACT-998822'
        localStorage.setItem('erp_activation_token', devToken)
        setActivationToken(devToken)
        setIsActivated(true)
      }

      // 3. Ensure default categories for the loaded business profile
      const currentType = savedType || 'supermarket'
      ensureDefaultCategories(DEFAULT_STORE_UUID, currentType)
    }

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  const setBusinessType = async (type: BusinessType) => {
    setBusinessTypeState(type)
    if (typeof window !== 'undefined') {
      localStorage.setItem('erp_business_type', type)
    }
    // Automatically purge mismatched categories and re-seed with the new profile
    await ensureDefaultCategories(storeId || DEFAULT_STORE_UUID, type, true)
  }

  const purgeAndReseedCategories = async (type?: BusinessType) => {
    const targetType = type || businessType
    await ensureDefaultCategories(storeId || DEFAULT_STORE_UUID, targetType, true)
  }

  const setStoreName = (name: string) => {
    setStoreNameState(name)
    if (typeof window !== 'undefined') {
      localStorage.setItem('erp_store_name', name)
    }
  }

  const activateOfflineSystem = (token: string, name?: string, type?: BusinessType) => {
    setActivationToken(token)
    setIsActivated(true)
    if (typeof window !== 'undefined') {
      localStorage.setItem('erp_activation_token', token)
      if (name) {
        setStoreNameState(name)
        localStorage.setItem('erp_store_name', name)
      }
      if (type) {
        setBusinessTypeState(type)
        localStorage.setItem('erp_business_type', type)
        ensureDefaultCategories(storeId || DEFAULT_STORE_UUID, type, true)
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
        purgeAndReseedCategories,
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
