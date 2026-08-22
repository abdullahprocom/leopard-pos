'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Calculator, X, Copy, Check, Delete } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

interface CalculatorModalProps {
  isOpen: boolean
  onClose: () => void
}

export function CalculatorModal({ isOpen, onClose }: CalculatorModalProps) {
  const [display, setDisplay] = useState('0')
  const [equation, setEquation] = useState('')
  const [copied, setCopied] = useState(false)

  const handleClear = () => {
    setDisplay('0')
    setEquation('')
  }

  const handleBackspace = () => {
    if (display.length > 1) {
      setDisplay(display.slice(0, -1))
    } else {
      setDisplay('0')
    }
  }

  const handleDigit = (digit: string) => {
    if (display === '0' && digit !== '.') {
      setDisplay(digit)
    } else if (digit === '.' && display.includes('.')) {
      return
    } else {
      setDisplay(display + digit)
    }
  }

  const handleOperator = (op: string) => {
    setEquation(`${display} ${op} `)
    setDisplay('0')
  }

  const handleEquals = () => {
    if (!equation) return
    try {
      const fullExpression = equation + display
      // Safe sanitized eval for basic math only
      const sanitized = fullExpression.replace(/[^0-9+\-*/.% ]/g, '')
      // eslint-disable-next-line no-eval
      const result = Function(`'use strict'; return (${sanitized})`)()
      const formatted = Number.isFinite(result) ? String(Math.round(result * 10000) / 10000) : 'خطأ'
      setEquation(`${fullExpression} =`)
      setDisplay(formatted)
    } catch {
      setDisplay('خطأ')
    }
  }

  const handleCopy = () => {
    if (display && display !== 'خطأ') {
      navigator.clipboard.writeText(display)
      setCopied(true)
      toast.success(`تم نسخ الرقم (${display}) إلى الحافظة`)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  // Keyboard shortcut listener
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isOpen) return

      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault()
        handleDigit(e.key)
      } else if (e.key === '.') {
        e.preventDefault()
        handleDigit('.')
      } else if (['+', '-', '*', '/'].includes(e.key)) {
        e.preventDefault()
        handleOperator(e.key)
      } else if (e.key === 'Enter' || e.key === '=') {
        e.preventDefault()
        handleEquals()
      } else if (e.key === 'Backspace') {
        e.preventDefault()
        handleBackspace()
      } else if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    },
    [isOpen, display, equation, onClose]
  )

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/70 backdrop-blur-xs transition-opacity" 
        onClick={onClose}
      />

      {/* Modal Dialog Card */}
      <div 
        className="relative w-full max-w-sm bg-slate-900 border border-slate-800 text-white rounded-3xl p-6 shadow-2xl z-10 animate-in fade-in zoom-in-95 duration-200" 
        dir="ltr"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3" dir="rtl">
          <div className="text-base font-black flex items-center gap-2 text-blue-400">
            <Calculator className="w-5 h-5 text-blue-500" />
            <span>الآلة الحاسبة السريعة (F4)</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Display Screen */}
        <div className="bg-slate-950/80 rounded-2xl p-4 border border-slate-800 text-right mt-3 space-y-1">
          <p className="text-xs font-mono text-slate-500 min-h-[1.25rem] truncate">{equation}</p>
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
              title="نسخ الناتج"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            </button>
            <span className="text-3xl font-black font-mono tracking-wider text-emerald-400 truncate">
              {display}
            </span>
          </div>
        </div>

        {/* Keypad Grid */}
        <div className="grid grid-cols-4 gap-2.5 mt-4">
          <Button
            type="button"
            onClick={handleClear}
            variant="outline"
            className="h-12 text-base font-bold bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border-rose-500/30 rounded-2xl cursor-pointer"
          >
            C
          </Button>
          <Button
            type="button"
            onClick={handleBackspace}
            variant="outline"
            className="h-12 text-base font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700 rounded-2xl cursor-pointer"
          >
            <Delete className="w-5 h-5" />
          </Button>
          <Button
            type="button"
            onClick={() => handleOperator('%')}
            variant="outline"
            className="h-12 text-base font-bold bg-slate-800 hover:bg-slate-700 text-blue-400 border-slate-700 rounded-2xl cursor-pointer"
          >
            %
          </Button>
          <Button
            type="button"
            onClick={() => handleOperator('/')}
            className="h-12 text-lg font-black bg-blue-600 hover:bg-blue-500 text-white rounded-2xl cursor-pointer"
          >
            ÷
          </Button>

          {/* Row 2 */}
          <Button
            type="button"
            onClick={() => handleDigit('7')}
            variant="outline"
            className="h-12 text-lg font-bold bg-slate-800/60 hover:bg-slate-800 text-white border-slate-700/60 rounded-2xl cursor-pointer"
          >
            7
          </Button>
          <Button
            type="button"
            onClick={() => handleDigit('8')}
            variant="outline"
            className="h-12 text-lg font-bold bg-slate-800/60 hover:bg-slate-800 text-white border-slate-700/60 rounded-2xl cursor-pointer"
          >
            8
          </Button>
          <Button
            type="button"
            onClick={() => handleDigit('9')}
            variant="outline"
            className="h-12 text-lg font-bold bg-slate-800/60 hover:bg-slate-800 text-white border-slate-700/60 rounded-2xl cursor-pointer"
          >
            9
          </Button>
          <Button
            type="button"
            onClick={() => handleOperator('*')}
            className="h-12 text-lg font-black bg-blue-600 hover:bg-blue-500 text-white rounded-2xl cursor-pointer"
          >
            ×
          </Button>

          {/* Row 3 */}
          <Button
            type="button"
            onClick={() => handleDigit('4')}
            variant="outline"
            className="h-12 text-lg font-bold bg-slate-800/60 hover:bg-slate-800 text-white border-slate-700/60 rounded-2xl cursor-pointer"
          >
            4
          </Button>
          <Button
            type="button"
            onClick={() => handleDigit('5')}
            variant="outline"
            className="h-12 text-lg font-bold bg-slate-800/60 hover:bg-slate-800 text-white border-slate-700/60 rounded-2xl cursor-pointer"
          >
            5
          </Button>
          <Button
            type="button"
            onClick={() => handleDigit('6')}
            variant="outline"
            className="h-12 text-lg font-bold bg-slate-800/60 hover:bg-slate-800 text-white border-slate-700/60 rounded-2xl cursor-pointer"
          >
            6
          </Button>
          <Button
            type="button"
            onClick={() => handleOperator('-')}
            className="h-12 text-lg font-black bg-blue-600 hover:bg-blue-500 text-white rounded-2xl cursor-pointer"
          >
            -
          </Button>

          {/* Row 4 */}
          <Button
            type="button"
            onClick={() => handleDigit('1')}
            variant="outline"
            className="h-12 text-lg font-bold bg-slate-800/60 hover:bg-slate-800 text-white border-slate-700/60 rounded-2xl cursor-pointer"
          >
            1
          </Button>
          <Button
            type="button"
            onClick={() => handleDigit('2')}
            variant="outline"
            className="h-12 text-lg font-bold bg-slate-800/60 hover:bg-slate-800 text-white border-slate-700/60 rounded-2xl cursor-pointer"
          >
            2
          </Button>
          <Button
            type="button"
            onClick={() => handleDigit('3')}
            variant="outline"
            className="h-12 text-lg font-bold bg-slate-800/60 hover:bg-slate-800 text-white border-slate-700/60 rounded-2xl cursor-pointer"
          >
            3
          </Button>
          <Button
            type="button"
            onClick={() => handleOperator('+')}
            className="h-12 text-lg font-black bg-blue-600 hover:bg-blue-500 text-white rounded-2xl cursor-pointer"
          >
            +
          </Button>

          {/* Row 5 */}
          <Button
            type="button"
            onClick={() => handleDigit('0')}
            variant="outline"
            className="h-12 text-lg font-bold bg-slate-800/60 hover:bg-slate-800 text-white border-slate-700/60 rounded-2xl cursor-pointer"
          >
            0
          </Button>
          <Button
            type="button"
            onClick={() => handleDigit('.')}
            variant="outline"
            className="h-12 text-lg font-bold bg-slate-800/60 hover:bg-slate-800 text-white border-slate-700/60 rounded-2xl cursor-pointer"
          >
            .
          </Button>
          <Button
            type="button"
            onClick={handleEquals}
            className="col-span-2 h-12 text-xl font-black bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl shadow-lg shadow-emerald-600/30 cursor-pointer"
          >
            =
          </Button>
        </div>
      </div>
    </div>
  )
}
