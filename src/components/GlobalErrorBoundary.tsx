'use client'

import React, { Component, ErrorInfo, ReactNode } from 'react'
import { logSystemError } from '@/lib/logger'
import { Button } from '@/components/ui/button'
import { AlertTriangle, RefreshCw, Home, ShieldAlert } from 'lucide-react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
  errorId: string | null
}

export class GlobalErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
    errorId: null
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null, errorId: null }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo })

    // Report silently to Centralized Super Admin Error Logger
    logSystemError(error, {
      severity: 'critical',
      componentStack: errorInfo.componentStack || undefined
    }).then((logged) => {
      if (logged) {
        this.setState({ errorId: logged.id })
      }
    })
  }

  private handleReload = () => {
    if (typeof window !== 'undefined') {
      window.location.reload()
    }
  }

  private handleGoHome = () => {
    if (typeof window !== 'undefined') {
      window.location.href = '/dashboard'
    }
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4" dir="rtl">
          <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 text-center space-y-5 shadow-2xl">
            <div className="w-16 h-16 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-500 mx-auto">
              <ShieldAlert className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <h2 className="text-xl font-black text-white">حدث خطأ غير متوقع في الواجهة</h2>
              <p className="text-xs text-slate-400 leading-relaxed">
                تم تسجيل تفاصيل هذا الخطأ وإرسالها تلقائياً لفريق الدعم الفني لمراجعته وحله عن بُعد.
              </p>
              {this.state.errorId && (
                <p className="text-[10px] font-mono text-blue-400 bg-blue-950/40 py-1 px-2 rounded-lg border border-blue-900/40 inline-block">
                  معرّف التقرير: {this.state.errorId.slice(0, 8)}
                </p>
              )}
            </div>

            <div className="flex gap-2 justify-center pt-2">
              <Button
                onClick={this.handleReload}
                className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs h-10 px-4 rounded-xl gap-1.5 shadow-md shadow-blue-600/25 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                إعادة تحميل الصفحة
              </Button>
              <Button
                variant="outline"
                onClick={this.handleGoHome}
                className="border-slate-700 text-slate-300 hover:text-white font-bold text-xs h-10 px-4 rounded-xl gap-1.5 cursor-pointer"
              >
                <Home className="w-3.5 h-3.5" />
                لوحة التحكم
              </Button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
