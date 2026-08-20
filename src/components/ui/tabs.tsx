'use client'

import * as React from "react"
import { cn } from "@/lib/cn"

interface TabsContextValue {
  value: string
  onValueChange: (value: string) => void
}

const TabsContext = React.createContext<TabsContextValue | undefined>(undefined)

export function Tabs({
  value,
  defaultValue = "",
  onValueChange,
  className,
  children,
}: {
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
  className?: string
  children: React.ReactNode
}) {
  const [internalValue, setInternalValue] = React.useState(value || defaultValue)

  const activeValue = value !== undefined ? value : internalValue

  const handleValueChange = (val: string) => {
    setInternalValue(val)
    onValueChange?.(val)
  }

  return (
    <TabsContext.Provider value={{ value: activeValue, onValueChange: handleValueChange }}>
      <div className={cn("w-full", className)}>{children}</div>
    </TabsContext.Provider>
  )
}

export function TabsList({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
}) {
  return (
    <div
      className={cn(
        "inline-flex items-center justify-center p-1.5 rounded-2xl bg-slate-200/90 dark:bg-slate-800/90 border border-slate-300/80 dark:border-slate-700 shadow-inner gap-2",
        className
      )}
    >
      {children}
    </div>
  )
}

export function TabsTrigger({
  value,
  className,
  children,
}: {
  value: string
  className?: string
  children: React.ReactNode
}) {
  const context = React.useContext(TabsContext)
  if (!context) throw new Error("TabsTrigger must be used within Tabs")

  const isSelected = context.value === value

  return (
    <button
      type="button"
      onClick={() => context.onValueChange(value)}
      className={cn(
        "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl px-6 py-3 text-sm font-bold transition-all duration-200 ease-in-out cursor-pointer select-none active:scale-95",
        isSelected
          ? "bg-blue-600 text-white shadow-md shadow-blue-600/30 border border-blue-500 font-black scale-[1.02]"
          : "bg-white/80 dark:bg-slate-900/80 text-slate-700 dark:text-slate-300 border border-slate-200/90 dark:border-slate-700 shadow-xs hover:bg-white dark:hover:bg-slate-900 hover:text-blue-600 hover:-translate-y-0.5",
        className
      )}
    >
      {children}
    </button>
  )
}

export function TabsContent({
  value,
  className,
  children,
}: {
  value: string
  className?: string
  children: React.ReactNode
}) {
  const context = React.useContext(TabsContext)
  if (!context) throw new Error("TabsContent must be used within Tabs")

  if (context.value !== value) return null

  return (
    <div className={cn("mt-6 focus-visible:outline-none transition-opacity duration-200", className)}>
      {children}
    </div>
  )
}
