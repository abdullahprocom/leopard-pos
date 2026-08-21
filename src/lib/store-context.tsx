'use client'

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { BusinessType } from './types'
import { DEFAULT_STORE_UUID, DEFAULT_BRANCH_UUID, DEFAULT_USER_UUID, getTenantInfo, TENANT_STORE_MAP } from './sync-engine'
import { ensureDefaultCategories } from './db'

interface StoreContextType {
  storeId: string
  branchId: string
  userId: string
  storeName: string
  businessType: BusinessType
  activationToken: string | null
  isActivated: boolean
  isOnline: boolean
  setStoreId: (id: string) => void
  setBranchId: (id: string) => void
  setUserId: (id: string) => void
  setStoreName: (name: string) => void
  setBusinessType: (type: BusinessType) => Promise<void>
  purgeAndReseedCategories: (type?: BusinessType) => Promise<void>
  activateOfflineSystem: (token: string, name?: string, type?: BusinessType) => void
  // Convenient profile helpers
  isPharma: boolean
  isSupermarket: boolean
  isClothing: boolean
}

const StoreContext = createContext<StoreContextType | undefined>(undefined)

export function StoreProvider({ children }: { children: ReactNode }) {
  const defaultTenant = getTenantInfo('supermarket')
  const [storeId, setStoreId] = useState<string>(defaultTenant.storeId)
  const [branchId, setBranchId] = useState<string>(defaultTenant.branchId)
  const [userId, setUserId] = useState<string>(DEFAULT_USER_UUID)
  const [storeName, setStoreNameState] = useState<string>(defaultTenant.defaultName)
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
      const initialType: BusinessType = savedType || 'supermarket'
      const tenant = getTenantInfo(initialType)

      setBusinessTypeState(initialType)
      setStoreId(tenant.storeId)
      setBranchId(tenant.branchId)

      const savedName = localStorage.getItem(`erp_store_name_${initialType}`) || localStorage.getItem('erp_store_name') || tenant.defaultName
      setStoreNameState(savedName)

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

      // 3. Ensure default categories for the isolated tenant store
      ensureDefaultCategories(tenant.storeId, initialType, false)
    }

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  const setBusinessType = async (type: BusinessType) => {
    const tenant = getTenantInfo(type)
    setBusinessTypeState(type)
    setStoreId(tenant.storeId)
    setBranchId(tenant.branchId)

    const savedName = (typeof window !== 'undefined' && localStorage.getItem(`erp_store_name_${type}`)) || tenant.defaultName
    setStoreNameState(savedName)

    if (typeof window !== 'undefined') {
      localStorage.setItem('erp_business_type', type)
      localStorage.setItem(`erp_store_name_${type}`, savedName)
    }

    // Ensure categories exist strictly for this tenant store
    await ensureDefaultCategories(tenant.storeId, type, false)
  }

  const purgeAndReseedCategories = async (type?: BusinessType) => {
    const targetType = type || businessType
    const tenant = getTenantInfo(targetType)
    await ensureDefaultCategories(tenant.storeId, targetType, true)
  }

  const setStoreName = (name: string) => {
    setStoreNameState(name)
    if (typeof window !== 'undefined') {
      localStorage.setItem(`erp_store_name_${businessType}`, name)
      localStorage.setItem('erp_store_name', name)
    }
  }

  const activateOfflineSystem = (token: string, name?: string, type?: BusinessType) => {
    setActivationToken(token)
    setIsActivated(true)
    if (typeof window !== 'undefined') {
      localStorage.setItem('erp_activation_token', token)
      if (type) {
        setBusinessType(type)
      }
      if (name) {
        setStoreName(name)
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
