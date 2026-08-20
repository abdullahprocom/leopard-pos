import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/cn"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-xl text-sm font-bold transition-all duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 disabled:pointer-events-none disabled:opacity-50 active:scale-95 cursor-pointer select-none",
  {
    variants: {
      variant: {
        default:
          "bg-blue-600 text-white shadow-md shadow-blue-600/20 hover:bg-blue-700 hover:shadow-lg hover:shadow-blue-600/30 hover:-translate-y-0.5",
        destructive:
          "bg-red-500 text-white shadow-md shadow-red-500/20 hover:bg-red-600 hover:shadow-lg hover:shadow-red-500/30 hover:-translate-y-0.5",
        outline:
          "border border-slate-200/90 bg-white text-slate-800 shadow-xs hover:bg-slate-50 hover:border-slate-300 hover:text-slate-900 hover:-translate-y-0.5",
        secondary:
          "bg-slate-100 text-slate-900 shadow-xs hover:bg-slate-200/80 hover:-translate-y-0.5",
        ghost: "text-slate-700 hover:bg-slate-100 hover:text-slate-900",
        link: "text-blue-600 underline-offset-4 hover:underline",
      },
      size: {
        default: "h-11 px-5 py-2",
        sm: "h-9 rounded-lg px-3.5 text-xs",
        lg: "h-12 rounded-xl px-8 text-base",
        icon: "h-10 w-10 rounded-xl",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
