'use client'

import * as React from "react"
import { cn } from "@/lib/cn"

export interface DialogProps {
  open: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  className?: string
}

export function Dialog({ open, onClose, title, children, className }: DialogProps) {
  const dialogRef = React.useRef<HTMLDialogElement>(null)

  React.useEffect(() => {
    const dialogElement = dialogRef.current
    if (!dialogElement) return

    if (open) {
      if (!dialogElement.open) {
        dialogElement.showModal()
      }
    } else {
      if (dialogElement.open) {
        dialogElement.close()
      }
    }
  }, [open])

  // Close dialog when clicking on the backdrop
  const handleBackdropClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    const dialogElement = dialogRef.current
    if (!dialogElement) return

    const rect = dialogElement.getBoundingClientRect()
    const isInDialog = (
      e.clientX >= rect.left &&
      e.clientX <= rect.right &&
      e.clientY >= rect.top &&
      e.clientY <= rect.bottom
    )

    if (!isInDialog) {
      onClose()
    }
  }

  // Handle ESC key
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDialogElement>) => {
    if (e.key === 'Escape') {
      onClose()
    }
  }

  return (
    <dialog
      ref={dialogRef}
      onClick={handleBackdropClick}
      onKeyDown={handleKeyDown}
      className={cn(
        "backdrop:bg-black/50 backdrop:backdrop-blur-sm",
        "rounded-xl border border-slate-200 bg-white p-0 shadow-lg",
        "w-full max-w-lg",
        "open:animate-in open:fade-in-90 open:zoom-in-95",
        "rtl:text-right",
        className
      )}
    >
      <div className="flex flex-col p-6 space-y-4">
        {title && (
          <div className="flex flex-col space-y-1.5 text-center sm:text-right">
            <h2 className="text-lg font-semibold leading-none tracking-tight">
              {title}
            </h2>
          </div>
        )}
        <div className="flex-1">
          {children}
        </div>
      </div>
    </dialog>
  )
}
