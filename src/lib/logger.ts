// Leopard POS - Centralized Telemetry & Error Logging Engine
// Captures client-side bugs, runtime exceptions, DB failures, and sends to Super Admin Dashboard

import { db } from './db'
import { syncEngine, DEFAULT_STORE_UUID } from './sync-engine'
import type { SystemErrorLog, ErrorSeverity } from './types'

// Helper: Detect client OS and browser information for low-end device diagnosis
export function getClientEnvironmentInfo() {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return { browser: 'Server', os: 'Server', userAgent: 'Node' }
  }

  const ua = navigator.userAgent
  let os = 'Unknown OS'
  if (ua.indexOf('Windows NT 10.0') !== -1) os = 'Windows 10/11'
  else if (ua.indexOf('Windows NT 6.3') !== -1) os = 'Windows 8.1'
  else if (ua.indexOf('Windows NT 6.2') !== -1) os = 'Windows 8'
  else if (ua.indexOf('Windows NT 6.1') !== -1) os = 'Windows 7 (Legacy)'
  else if (ua.indexOf('Windows NT 5.1') !== -1) os = 'Windows XP (Legacy)'
  else if (ua.indexOf('Mac') !== -1) os = 'macOS'
  else if (ua.indexOf('Android') !== -1) os = 'Android'
  else if (ua.indexOf('iPhone') !== -1 || ua.indexOf('iPad') !== -1) os = 'iOS'
  else if (ua.indexOf('Linux') !== -1) os = 'Linux'

  let browser = 'Unknown Browser'
  if (ua.indexOf('Firefox') !== -1) browser = 'Firefox'
  else if (ua.indexOf('Edg') !== -1) browser = 'Edge'
  else if (ua.indexOf('Chrome') !== -1) browser = 'Chrome'
  else if (ua.indexOf('Safari') !== -1) browser = 'Safari'
  else if (ua.indexOf('MSIE') !== -1 || ua.indexOf('Trident/') !== -1) browser = 'Internet Explorer'

  const memory = (navigator as any).deviceMemory ? `${(navigator as any).deviceMemory} GB RAM` : 'Unknown RAM'

  return {
    browser: `${browser}`,
    os: `${os} (${memory})`,
    userAgent: ua,
    screen: `${window.innerWidth}x${window.innerHeight}`
  }
}

interface LogOptions {
  severity?: ErrorSeverity
  storeId?: string
  storeName?: string
  userId?: string
  userRole?: string
  componentStack?: string
  extraContext?: Record<string, any>
}

// Log error to local Dexie + background sync
export async function logSystemError(
  error: Error | string | unknown,
  options: LogOptions = {}
): Promise<SystemErrorLog | null> {
  try {
    const env = getClientEnvironmentInfo()
    const isOnline = typeof window !== 'undefined' ? navigator.onLine : true
    const currentStoreId = options.storeId || (typeof localStorage !== 'undefined' ? localStorage.getItem('erp_store_id') : null) || DEFAULT_STORE_UUID
    const currentStoreName = options.storeName || (typeof localStorage !== 'undefined' ? localStorage.getItem('erp_store_name_supermarket') : null) || 'منشأة العميل'

    let message = 'Unknown System Error'
    let stackTrace: string | undefined = undefined

    if (error instanceof Error) {
      message = error.message
      stackTrace = error.stack
    } else if (typeof error === 'string') {
      message = error
    } else if (error && typeof error === 'object') {
      message = (error as any).message || JSON.stringify(error)
      stackTrace = (error as any).stack
    }

    const logEntry: SystemErrorLog = {
      id: crypto.randomUUID(),
      store_id: currentStoreId,
      store_name: currentStoreName,
      user_id: options.userId,
      user_role: options.userRole,
      severity: options.severity || 'error',
      message: message.slice(0, 1000),
      stack_trace: stackTrace ? stackTrace.slice(0, 2500) : undefined,
      component_stack: options.componentStack ? options.componentStack.slice(0, 1500) : undefined,
      page_url: typeof window !== 'undefined' ? window.location.pathname + window.location.search : '/',
      user_agent: env.userAgent,
      browser_info: env.browser,
      os_info: env.os,
      is_online: isOnline,
      resolved: false,
      created_at: new Date().toISOString()
    }

    // Save to Dexie
    await db.system_error_logs.put(logEntry)

    // Enqueue for super-admin sync
    syncEngine.enqueueOperation('system_error_logs', 'INSERT', logEntry as any)

    return logEntry
  } catch (loggingErr) {
    // Fail silently so logger never crashes host app
    console.error('Failed to log system telemetry error:', loggingErr)
    return null
  }
}

// Global window event listener initialization for automatic silent bug capturing
export function initGlobalErrorListeners() {
  if (typeof window === 'undefined') return

  // Prevent duplicate listeners
  if ((window as any).__ERP_LOGGER_INITIALIZED__) return
  ;(window as any).__ERP_LOGGER_INITIALIZED__ = true

  // 1. Unhandled JavaScript Runtime Errors
  window.addEventListener('error', (event) => {
    logSystemError(event.error || event.message, {
      severity: 'critical',
      extraContext: { filename: event.filename, lineno: event.lineno, colno: event.colno }
    })
  })

  // 2. Unhandled Promise Rejections (e.g. network/Dexie/fetch failures)
  window.addEventListener('unhandledrejection', (event) => {
    logSystemError(event.reason || 'Unhandled Promise Rejection', {
      severity: event.reason?.name === 'DexieError' ? 'db' : 'network'
    })
  })
}

// Super Admin resolver action
export async function resolveSystemError(logId: string, resolvedBy: string = 'Super Admin'): Promise<void> {
  const log = await db.system_error_logs.get(logId)
  if (log) {
    const updated: SystemErrorLog = {
      ...log,
      resolved: true,
      resolved_at: new Date().toISOString(),
      resolved_by: resolvedBy
    }
    await db.system_error_logs.put(updated)
    syncEngine.enqueueOperation('system_error_logs', 'UPDATE', updated as any)
  }
}
