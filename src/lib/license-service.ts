// Leopard POS - SaaS Licensing & Access Token Engine
// Generates, manages, and validates access tokens for store owners

import { db } from './db'
import { syncEngine } from './sync-engine'
import type { LicenseToken, LicenseDuration, BusinessType, TenantStoreRecord } from './types'

// Generate a clean commercial license key
export function createFormattedTokenKey(type: BusinessType, duration: LicenseDuration): string {
  const prefixMap: Record<BusinessType, string> = {
    pharmacy: 'PHARM',
    supermarket: 'SUPER',
    clothing: 'FASH',
    restaurant: 'REST',
    general: 'CORP'
  }

  const durationMap: Record<LicenseDuration, string> = {
    trial_14d: 'T14D',
    '1_month': 'M01',
    '3_months': 'M03',
    '6_months': 'M06',
    '1_year': 'Y01',
    lifetime: 'LIFE'
  }

  const randomSegment1 = Math.random().toString(36).substring(2, 6).toUpperCase()
  const randomSegment2 = Math.random().toString(36).substring(2, 6).toUpperCase()
  const year = new Date().getFullYear()

  return `ERP-${year}-${prefixMap[type] || 'PRO'}-${durationMap[duration]}-${randomSegment1}-${randomSegment2}`
}

// Calculate expiration ISO date based on duration
export function calculateTokenExpiration(duration: LicenseDuration): string {
  const now = new Date()
  switch (duration) {
    case 'trial_14d':
      now.setDate(now.getDate() + 14)
      break
    case '1_month':
      now.setMonth(now.getMonth() + 1)
      break
    case '3_months':
      now.setMonth(now.getMonth() + 3)
      break
    case '6_months':
      now.setMonth(now.getMonth() + 6)
      break
    case '1_year':
      now.setFullYear(now.getFullYear() + 1)
      break
    case 'lifetime':
      now.setFullYear(now.getFullYear() + 100)
      break
  }
  return now.toISOString()
}

// Super Admin: Generate a new License Access Token
export async function generateLicenseToken(params: {
  business_type: BusinessType
  duration: LicenseDuration
  client_name?: string
  client_phone?: string
  max_devices?: number
  notes?: string
}): Promise<LicenseToken> {
  const tokenKey = createFormattedTokenKey(params.business_type, params.duration)
  const expiresAt = calculateTokenExpiration(params.duration)

  const tokenRecord: LicenseToken = {
    id: crypto.randomUUID(),
    token: tokenKey,
    business_type: params.business_type,
    duration: params.duration,
    status: 'unused',
    client_name: params.client_name?.trim(),
    client_phone: params.client_phone?.trim(),
    created_at: new Date().toISOString(),
    expires_at: expiresAt,
    max_devices: params.max_devices || 3,
    notes: params.notes?.trim()
  }

  await db.license_tokens.put(tokenRecord)
  syncEngine.enqueueOperation('license_tokens', 'INSERT', tokenRecord as any)

  return tokenRecord
}

// Client Side: Validate and consume token upon store activation
export async function validateAndConsumeToken(
  tokenString: string,
  storeName: string,
  ownerName: string = 'المدير'
): Promise<{ success: boolean; message: string; businessType?: BusinessType; tokenRecord?: LicenseToken }> {
  const cleanKey = tokenString.trim().toUpperCase()

  // 1. Check local Dexie tokens table
  let tokenObj = await db.license_tokens.where('token').equals(cleanKey).first()

  // 2. Allow offline master bypass token for dev/emergency if needed
  if (!tokenObj && cleanKey.startsWith('ERP-MASTER-')) {
    tokenObj = {
      id: crypto.randomUUID(),
      token: cleanKey,
      business_type: 'supermarket',
      duration: '1_year',
      status: 'unused',
      created_at: new Date().toISOString(),
      expires_at: calculateTokenExpiration('1_year'),
      max_devices: 5
    }
  }

  if (!tokenObj) {
    return { success: false, message: 'كود التفعيل غير صحيح أو غير موجود في قاعدة بيانات المنظومة' }
  }

  if (tokenObj.status === 'suspended') {
    return { success: false, message: 'تم تعليق هذا الترخيص من قبل إدارة النظام، يرجى التواصل مع الدعم الفني' }
  }

  if (tokenObj.status === 'expired' || new Date(tokenObj.expires_at) < new Date()) {
    return { success: false, message: 'هذا الترخيص منتهي الصلاحية، يرجى تجديد الاشتراك' }
  }

  // 3. Mark as active & register store
  const activatedRecord: LicenseToken = {
    ...tokenObj,
    status: 'active',
    activated_at: new Date().toISOString(),
    client_name: ownerName || tokenObj.client_name
  }
  await db.license_tokens.put(activatedRecord)
  syncEngine.enqueueOperation('license_tokens', 'UPDATE', activatedRecord as any)

  // 4. Register tenant store in super admin registry
  const tenantRecord: TenantStoreRecord = {
    id: crypto.randomUUID(),
    store_name: storeName.trim(),
    owner_name: ownerName.trim(),
    business_type: tokenObj.business_type,
    status: 'active',
    token: cleanKey,
    created_at: new Date().toISOString(),
    expires_at: tokenObj.expires_at,
    last_active_at: new Date().toISOString()
  }
  await db.tenant_stores.put(tenantRecord)
  syncEngine.enqueueOperation('tenant_stores', 'INSERT', tenantRecord as any)

  return {
    success: true,
    message: 'تم تفعيل المتجر والترخيص بنجاح',
    businessType: tokenObj.business_type,
    tokenRecord: activatedRecord
  }
}

// Super Admin: Suspend or activate tenant store
export async function toggleStoreStatus(storeId: string, targetStatus: 'active' | 'suspended'): Promise<void> {
  const store = await db.tenant_stores.get(storeId)
  if (store) {
    const updated: TenantStoreRecord = {
      ...store,
      status: targetStatus,
      last_active_at: new Date().toISOString()
    }
    await db.tenant_stores.put(updated)
    syncEngine.enqueueOperation('tenant_stores', 'UPDATE', updated as any)
  }
}
