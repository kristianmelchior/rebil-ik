'use client'

import { useState } from 'react'

interface Props {
  title:        React.ReactNode
  defaultOpen?: boolean
  onOpen?:      () => void
  children:     React.ReactNode
}

export default function CollapsibleSection({ title, defaultOpen = true, onOpen, children }: Props) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="bg-white border border-border rounded-card overflow-hidden">
      <button
        onClick={() => { const next = !open; setOpen(next); if (next) onOpen?.() }}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-[#FAFAFA] transition-colors text-left"
      >
        <div className="flex items-center gap-2 text-xs font-semibold text-text-muted uppercase tracking-wide">
          {title}
        </div>
        <svg
          className={`w-3 h-3 text-text-muted transition-transform duration-200 ${open ? '' : '-rotate-90'}`}
          viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
        >
          <path d="M2 4l4 4 4-4" />
        </svg>
      </button>

      {open && <div className="border-t border-border">{children}</div>}
    </div>
  )
}
