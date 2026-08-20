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
          'flex h-10 w-full items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-600 disabled:cursor-not-allowed disabled:opacity-50 text-right',
          className
        )}
        {...props}
      >
        <span className="truncate">{children}</span>
        <ChevronDown className="h-4 w-4 opacity-50 shrink-0" />
      </button>
    )
  }
)
SelectTrigger.displayName = 'SelectTrigger'

export function SelectValue({ placeholder }: { placeholder?: string }) {
  const context = React.useContext(SelectContext)
  if (!context) return null
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
          'absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border border-slate-200 bg-white p-1 text-slate-950 shadow-md',
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
        'relative flex w-full cursor-pointer select-none items-center rounded-sm py-2 px-3 text-sm outline-none hover:bg-slate-100 transition-colors',
        isSelected && 'bg-blue-50 text-blue-700 font-semibold',
        className
      )}
    >
      {children}
    </div>
  )
}
