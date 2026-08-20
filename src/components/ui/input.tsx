import * as React from "react"
import { cn } from "@/lib/cn"

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-11 w-full rounded-xl border border-slate-200 dark:border-slate-700/90 bg-white dark:bg-slate-800/90 px-4 py-2 text-sm text-slate-900 dark:text-slate-100 shadow-xs transition-colors placeholder:text-slate-400 dark:placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600/30 focus-visible:border-blue-600 disabled:cursor-not-allowed disabled:opacity-50 rtl:text-right font-medium",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
