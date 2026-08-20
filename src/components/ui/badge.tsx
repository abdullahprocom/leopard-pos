import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/cn"

const badgeVariants = cva(
  "inline-flex items-center rounded-lg border px-2.5 py-0.5 text-xs font-bold transition-colors select-none",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-blue-600 text-white shadow-xs hover:bg-blue-700",
        secondary:
          "border-transparent bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700",
        destructive:
          "border-transparent bg-rose-600 text-white shadow-xs hover:bg-rose-700",
        outline: "border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200",
        success: 
          "border-transparent bg-emerald-600 text-white shadow-xs hover:bg-emerald-700",
        warning:
          "border-transparent bg-amber-500 text-white shadow-xs hover:bg-amber-600",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
