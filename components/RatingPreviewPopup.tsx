'use client'

// Popup shown to the logged-in rep when their TL has rated them this week.
// TEMPORARILY hardcoded to only appear for Benjamin Parr (test phase).

import { useState, useEffect } from 'react'
import type { VurderingPreview } from '@/app/api/vurdering-preview/route'
import { isoWeekLabel } from '@/lib/tl/week'

const TEST_NAME = 'Benjamin Parr'

function isDark(hex: string): boolean {
  try {
    const r = parseInt(hex.slice(1, 3), 16)
    const g = parseInt(hex.slice(3, 5), 16)
    const b = parseInt(hex.slice(5, 7), 16)
    return (r * 299 + g * 587 + b * 114) / 1000 < 128
  } catch { return false }
}

function dismissKey(week: string) {
  return `rating_preview_dismissed_${week}`
}

export default function RatingPreviewPopup({
  repName,
  repKode,
  isAdmin = false,
}: {
  repName:  string
  repKode:  string
  isAdmin?: boolean
}) {
  const [preview,  setPreview]  = useState<VurderingPreview | null>(null)
  const [expanded, setExpanded] = useState(false)
  const [visible,  setVisible]  = useState(false)

  useEffect(() => {
    // Regular reps: only show for Benjamin Parr
    if (!isAdmin && repName !== TEST_NAME) return

    // Admin previewing: must have selected a rep
    const url = isAdmin
      ? `/api/vurdering-preview?kode=${encodeURIComponent(repKode)}`
      : '/api/vurdering-preview'

    fetch(url, { credentials: 'include' })
      .then(r => r.ok ? r.json() as Promise<VurderingPreview | null> : null)
      .then(data => {
        if (!data) { setVisible(false); setPreview(null); return }
        // Admins always see preview (no dismiss check)
        if (!isAdmin && localStorage.getItem(dismissKey(data.week))) return
        setPreview(data)
        setVisible(true)
        if (isAdmin) setExpanded(true) // auto-expand for admin preview
      })
      .catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repName, repKode, isAdmin])

  if (!visible || !preview) return null

  function dismiss() {
    localStorage.setItem(dismissKey(preview!.week), '1')
    setVisible(false)
  }

  const answeredCount = preview.questions.filter(q => q.selectedOption).length

  return (
    <div className="fixed bottom-6 right-6 z-50 w-80 shadow-2xl rounded-2xl overflow-hidden border border-border animate-in slide-in-from-bottom-4 fade-in duration-300">
      {/* Header — always visible */}
      <div
        className="bg-[var(--rebil-red)] px-4 py-3 flex items-start justify-between gap-2 cursor-pointer"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex-1 min-w-0">
          {isAdmin && (
            <p className="text-white/60 text-[10px] font-medium uppercase tracking-wider mb-0.5">
              Forhåndsvisning — {repName}
            </p>
          )}
          <p className="text-white font-semibold text-sm leading-tight">
            {isAdmin ? 'Slik ser ansatt dette' : 'Ny tilbakemelding fra din teamleder'}
          </p>
          <p className="text-white/75 text-xs mt-0.5">
            {isoWeekLabel(preview.week)} · {answeredCount}/{preview.questions.length} spørsmål besvart
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
          <button
            onClick={e => { e.stopPropagation(); setExpanded(x => !x) }}
            className="text-white/80 hover:text-white text-lg leading-none w-6 h-6 flex items-center justify-center"
            aria-label={expanded ? 'Minimer' : 'Åpne'}
          >
            {expanded ? '−' : '+'}
          </button>
          <button
            onClick={e => { e.stopPropagation(); dismiss() }}
            className="text-white/60 hover:text-white text-sm leading-none w-6 h-6 flex items-center justify-center"
            aria-label="Lukk"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Expandable body */}
      {expanded && (
        <div className="bg-white px-4 py-3 space-y-3">
          <p className="text-xs text-text-muted">
            Fra: <span className="font-medium text-text-primary">{preview.raterName}</span>
          </p>

          {/* Questions + answers */}
          <div className="space-y-2">
            {preview.questions.map((q, i) => (
              <div key={i} className="flex items-start justify-between gap-2">
                <span className="text-xs text-text-muted leading-tight flex-1">{q.text}</span>
                {q.selectedOption ? (
                  <span
                    className="text-xs px-2.5 py-0.5 rounded-full font-medium whitespace-nowrap shrink-0"
                    style={{
                      backgroundColor: q.selectedOption.color,
                      color: isDark(q.selectedOption.color) ? '#fff' : '#111',
                    }}
                  >
                    {q.selectedOption.text}
                  </span>
                ) : (
                  <span className="text-xs text-text-muted italic shrink-0">Ikke besvart</span>
                )}
              </div>
            ))}
          </div>

          {/* Comment */}
          {preview.comment && (
            <div className="border-t border-border pt-2.5">
              <p className="text-[11px] font-medium text-text-muted uppercase tracking-wide mb-1">Kommentar</p>
              <p className="text-xs text-text-primary leading-relaxed">{preview.comment}</p>
            </div>
          )}

          <button
            onClick={dismiss}
            className="w-full text-xs text-text-muted hover:text-text-primary text-center pt-1 transition-colors"
          >
            Ikke vis igjen denne uken
          </button>
        </div>
      )}
    </div>
  )
}
