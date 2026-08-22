'use client'

import * as React from 'react'
import { cn } from '@/lib/cn'
import { ChevronDown } from 'lucide-react'

interface SelectContextType {
  value: string
  onValueChange?: (value: string) => void
  open: boolean
  setOpen: (open: boolean) => void
}

const SelectContext = React.createContext<SelectContextType | undefined>(undefined)

export interface SelectProps {
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
  children: React.ReactNode
}

export function Select({ value = '', onValueChange, children }: SelectProps) {
  const [open, setOpen] = React.useState(false)
  const [internalValue, setInternalValue] = React.useState(value)

  React.useEffect(() => {
    setInternalValue(value)
  }, [value])

  const handleValueChange = (val: string) => {
    setInternalValue(val)
    onValueChange?.(val)
    setOpen(false)
  }

  return (
    <SelectContext.Provider value={{ value: internalValue, onValueChange: handleValueChange, open, setOpen }}>
      <div className="relative inline-block w-full">{children}</div>
    </SelectContext.Provider>
  )
}

export interface SelectTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {}

export const SelectTrigger = React.forwardRef<HTMLButtonElement, SelectTriggerProps>(
  ({ className, children, ...props }, ref) => {
    const context = React.useContext(SelectContext)
    if (!context) throw new Error('SelectTrigger must be used within Select')

    return (
      <button
        ref={ref}
        type="button"
        onClick={() => context.setOpen(!context.open)}
        className={cn(
          'flex h-11 w-full items-center justify-between rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 px-4 py-2 text-sm font-medium text-slate-900 dark:text-slate-100 shadow-xs placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600/30 focus:border-blue-600 disabled:cursor-not-allowed disabled:opacity-50 text-right cursor-pointer transition-colors',
          className
        )}
        {...props}
      >
        <span className="truncate">{children}</span>
        <ChevronDown className="h-4 w-4 opacity-60 shrink-0 text-slate-400" />
      </button>
    )
  }
)
SelectTrigger.displayName = 'SelectTrigger'

export function SelectValue({ placeholder, children }: { placeholder?: string; children?: React.ReactNode }) {
  const context = React.useContext(SelectContext)
  if (!context) return null
  if (children !== undefined && children !== null && children !== '') {
    return <span>{children}</span>
  }
  return <span>{context.value || placeholder || ''}</span>
}

export function SelectContent({ className, children }: { className?: string; children: React.ReactNode }) {
  const context = React.useContext(SelectContext)
  if (!context || !context.open) return null

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={() => context.setOpen(false)} />
      <div
        className={cn(
          'absolute z-50 mt-1.5 max-h-60 w-full overflow-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-1.5 text-slate-900 dark:text-slate-100 shadow-xl',
          className
        )}
      >
        {children}
      </div>
    </>
  )
}

export function SelectItem({
  value,
  children,
  className,
}: {
  value: string
  children: React.ReactNode
  className?: string
}) {
  const context = React.useContext(SelectContext)
  if (!context) return null

  const isSelected = context.value === value

  return (
    <div
      onClick={() => context.onValueChange?.(value)}
      className={cn(
        'relative flex w-full cursor-pointer select-none items-center rounded-lg py-2.5 px-3 text-sm font-medium outline-none hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors',
        isSelected && 'bg-blue-600 text-white font-bold hover:bg-blue-600 dark:hover:bg-blue-600',
        className
      )}
    >
      {children}
    </div>
  )
}
