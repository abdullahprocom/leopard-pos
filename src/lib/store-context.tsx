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
  setStoreName: (name: string, type?: BusinessType) => void
  setBusinessType: (type: BusinessType, customName?: string) => Promise<void>
  purgeAndReseedCategories: (type?: BusinessType) => Promise<void>
  activateOfflineSystem: (token: string, name?: string, type?: BusinessType) => void
  // Convenient profile helpers
  isPharma: boolean
  isSupermarket: boolean
  isClothing: boolean
}

const StoreContext = createContext<StoreContextType | undefined>(undefined)

function sanitizeStoreName(type: BusinessType, rawName?: string | null): string {
  const tenant = getTenantInfo(type)
  if (!rawName || typeof rawName !== 'string' || !rawName.trim()) {
    return tenant.defaultName
  }
  const clean = rawName.trim()
  
  // Guard against legacy cross-tenant name bleed
  if (type === 'pharmacy' && (clean.includes('ملابس') || clean.includes('بوتيك') || clean.includes('سوبر ماركت'))) {
    return tenant.defaultName
  }
  if (type === 'clothing' && (clean.includes('صيدلية') || clean.includes('سوبر ماركت') || clean.includes('ماركت'))) {
    return tenant.defaultName
  }
  if (type === 'supermarket' && (clean.includes('صيدلية') || clean.includes('ملابس') || clean.includes('بوتيك'))) {
    return tenant.defaultName
  }
  if (type === 'restaurant' && (clean.includes('صيدلية') || clean.includes('ملابس') || clean.includes('بوتيك'))) {
    return tenant.defaultName
  }
  if (type === 'general' && (clean.includes('صيدلية') || clean.includes('ملابس') || clean.includes('بوتيك') || clean.includes('سوبر ماركت'))) {
    return tenant.defaultName
  }

  return clean
}

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

      // Strict per-tenant store name with self-healing validator
      const rawStoredName = localStorage.getItem(`erp_store_name_${initialType}`)
      const cleanName = sanitizeStoreName(initialType, rawStoredName)
      setStoreNameState(cleanName)
      localStorage.setItem(`erp_store_name_${initialType}`, cleanName)
      localStorage.removeItem('erp_store_name')

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

  const setBusinessType = async (type: BusinessType, customName?: string) => {
    const tenant = getTenantInfo(type)
    setBusinessTypeState(type)
    setStoreId(tenant.storeId)
    setBranchId(tenant.branchId)

    const rawName = customName || (typeof window !== 'undefined' ? localStorage.getItem(`erp_store_name_${type}`) : null)
    const finalName = sanitizeStoreName(type, rawName)
    setStoreNameState(finalName)

    if (typeof window !== 'undefined') {
      localStorage.setItem('erp_business_type', type)
      localStorage.setItem(`erp_store_name_${type}`, finalName)
      localStorage.removeItem('erp_store_name')
    }

    // Ensure categories exist strictly for this tenant store
    await ensureDefaultCategories(tenant.storeId, type, false)
  }

  const purgeAndReseedCategories = async (type?: BusinessType) => {
    const targetType = type || businessType
    const tenant = getTenantInfo(targetType)
    await ensureDefaultCategories(tenant.storeId, targetType, true)
  }

  const setStoreName = (name: string, type?: BusinessType) => {
    const targetType = type || businessType
    const clean = sanitizeStoreName(targetType, name)
    setStoreNameState(clean)
    if (typeof window !== 'undefined') {
      localStorage.setItem(`erp_store_name_${targetType}`, clean)
      localStorage.removeItem('erp_store_name')
    }
  }

  const activateOfflineSystem = (token: string, name?: string, type?: BusinessType) => {
    setActivationToken(token)
    setIsActivated(true)
    if (typeof window !== 'undefined') {
      localStorage.setItem('erp_activation_token', token)
      if (type) {
        setBusinessType(type, name)
      } else if (name) {
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
