'use client'

// Boooom! — team feed of recent purchases (Slack-style cards).

import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  FeedCommentPublic,
  FeedCommentsMap,
  FeedReactionsMap,
  FeedSaleReactions,
  SaleRow,
} from '@/lib/types'
import { fmtKr, formatTimeHm } from '@/lib/formatDisplay'
import { prisgrenseChipClass, HUBSPOT_SALES_DEAL_BASE } from '@/lib/rabattBadge'
import { FEED_ALLOWED_EMOJIS } from '@/lib/feedEmoji'

const fetchOpts: RequestInit = { credentials: 'include' }

const AVATAR_PALETTE = [
  'bg-[#2563eb]',
  'bg-[#7c3aed]',
  'bg-[#0d9488]',
  'bg-[#c2410c]',
  'bg-[#b45309]',
  'bg-[#be185d]',
  'bg-[#4d7c0f]',
  'bg-[#1e40af]',
]

function hashName(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

function initialsFromRepName(repName: string): string {
  const parts = repName.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  const a = parts[0][0] ?? ''
  const b = parts[parts.length - 1][0] ?? ''
  return (a + b).toUpperCase()
}

function avatarClass(repName: string): string {
  return AVATAR_PALETTE[hashName(repName) % AVATAR_PALETTE.length]
}

function formatPurchaseDateYmd(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number)
  if (!y || !m || !d) return ymd
  return new Date(y, m - 1, d).toLocaleDateString('nb-NO', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

/** Date + optional clock (HH:MM) from dato_kjopt ISO, else created_at. */
function feedDateTimeRight(row: SaleRow): string {
  const raw = row.dato_kjopt.trim()
  const ymd = raw.slice(0, 10)
  const dateStr = formatPurchaseDateYmd(ymd)

  let time: string | null = null
  if (raw.length > 10 && (raw.includes('T') || /^\d{4}-\d{2}-\d{2}\s/.test(raw))) {
    time = formatTimeHm(raw)
  }
  if (time == null && row.created_at) {
    time = formatTimeHm(row.created_at)
  }

  return time ? `${dateStr} · ${time}` : dateStr
}

function emptyReactions(): FeedSaleReactions {
  return { reactions: [], myReactions: [] }
}

function optimisticToggle(
  entry: FeedSaleReactions,
  emoji: string,
  viewerName: string
): FeedSaleReactions {
  const had = entry.myReactions.includes(emoji)
  const adding = !had
  const my = new Set(entry.myReactions)
  const reactions = entry.reactions.map(r => ({
    ...r,
    repNames: [...r.repNames],
  }))

  const idx = reactions.findIndex(r => r.emoji === emoji)

  if (adding) {
    my.add(emoji)
    if (idx >= 0) {
      const g = reactions[idx]
      const names = [...g.repNames]
      if (!names.includes(viewerName)) names.push(viewerName)
      reactions[idx] = { ...g, count: g.count + 1, repNames: names }
    } else {
      reactions.push({ emoji, count: 1, repNames: [viewerName] })
    }
  } else {
    my.delete(emoji)
    if (idx >= 0) {
      const g = reactions[idx]
      const names = g.repNames.filter(n => n !== viewerName)
      const count = Math.max(0, g.count - 1)
      if (count === 0) reactions.splice(idx, 1)
      else reactions[idx] = { ...g, count, repNames: names }
    }
  }

  reactions.sort((a, b) => b.count - a.count || a.emoji.localeCompare(b.emoji))
  return { reactions, myReactions: [...my] }
}

/** Unique rep names in first-seen order (for commenter avatar stack). */
function uniqueCommentersInOrder(items: FeedCommentPublic[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const c of items) {
    if (seen.has(c.rep_name)) continue
    seen.add(c.rep_name)
    out.push(c.rep_name)
  }
  return out
}

function formatRelativeCommentTime(iso: string): string {
  const d = new Date(iso)
  const t = d.getTime()
  if (Number.isNaN(t)) return ''
  const diff = Date.now() - t
  const sec = Math.floor(diff / 1000)
  if (sec < 45) return 'nå'
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min} min siden`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr} t siden`
  const days = Math.floor(hr / 24)
  if (days < 7) return `${days} d siden`
  return d.toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' })
}

/** Slack-style smiley + corner plus, line art. */
function SlackAddReactionGlyph({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <circle cx="12" cy="12" r="7.25" stroke="currentColor" strokeWidth="1.35" />
      <circle cx="9.25" cy="10.25" r="0.9" fill="currentColor" />
      <circle cx="14.75" cy="10.25" r="0.9" fill="currentColor" />
      <path
        d="M 8.25 14.25 Q 12 17.1 15.75 14.25"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M17.2 5.3h1.35v1.35h1.35v1.35h-1.35v1.35H17.2V8h-1.35V6.65h1.35V5.3z"
        fill="currentColor"
      />
    </svg>
  )
}

function CommentBubbleGlyph({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        d="M12 21a8.96 8.96 0 01-4.3-1.1L4 21l1.35-3.35A8.98 8.98 0 013 12a9 9 0 119 9z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  )
}

interface FeedTabProps {
  sales: SaleRow[]
  viewerName: string
}

export default function FeedTab({ sales, viewerName }: FeedTabProps) {
  const sorted = [...sales].sort((a, b) => b.dato_kjopt.localeCompare(a.dato_kjopt))
  const [reactions, setReactions] = useState<FeedReactionsMap>({})
  const [comments, setComments] = useState<FeedCommentsMap>({})
  const [pickerSaleId, setPickerSaleId] = useState<number | null>(null)
  const [commentOpenBySale, setCommentOpenBySale] = useState<Record<number, boolean>>({})
  const pickerRef = useRef<HTMLDivElement>(null)
  /** Bumps when social data is updated locally so stale in-flight GETs cannot overwrite newer state. */
  const socialDataVersionRef = useRef(0)

  const refetchSocial = useCallback(async () => {
    socialDataVersionRef.current++
    const v = socialDataVersionRef.current
    const ids = sales.map(s => s.id)
    if (ids.length === 0) {
      if (v !== socialDataVersionRef.current) return
      setReactions({})
      setComments({})
      return
    }
    const qs = ids.join(',')
    const [rRes, cRes] = await Promise.all([
      fetch(`/api/feed/reactions?sale_ids=${encodeURIComponent(qs)}`, fetchOpts),
      fetch(`/api/feed/comments?sale_ids=${encodeURIComponent(qs)}`, fetchOpts),
    ])
    if (v !== socialDataVersionRef.current) return
    if (rRes.ok) setReactions((await rRes.json()) as FeedReactionsMap)
    if (cRes.ok) setComments((await cRes.json()) as FeedCommentsMap)
  }, [sales])

  useEffect(() => {
    socialDataVersionRef.current++
    const v = socialDataVersionRef.current
    let cancelled = false
    void (async () => {
      const ids = sales.map(s => s.id)
      if (ids.length === 0) {
        if (!cancelled && v === socialDataVersionRef.current) {
          setReactions({})
          setComments({})
        }
        return
      }
      const qs = ids.join(',')
      const [rRes, cRes] = await Promise.all([
        fetch(`/api/feed/reactions?sale_ids=${encodeURIComponent(qs)}`, fetchOpts),
        fetch(`/api/feed/comments?sale_ids=${encodeURIComponent(qs)}`, fetchOpts),
      ])
      if (cancelled) return
      if (v !== socialDataVersionRef.current) return
      if (rRes.ok) setReactions((await rRes.json()) as FeedReactionsMap)
      if (cRes.ok) setComments((await cRes.json()) as FeedCommentsMap)
    })()
    return () => {
      cancelled = true
    }
  }, [sales])

  useEffect(() => {
    if (pickerSaleId == null) return
    function onPointerDown(e: MouseEvent) {
      const el = pickerRef.current
      if (el && !el.contains(e.target as Node)) setPickerSaleId(null)
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [pickerSaleId])

  async function toggleReaction(saleId: number, emoji: string) {
    const key = String(saleId)
    setReactions(prev => {
      const entry = prev[key] ?? emptyReactions()
      return {
        ...prev,
        [key]: optimisticToggle(entry, emoji, viewerName),
      }
    })
    try {
      const res = await fetch('/api/feed/reactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sale_id: saleId, emoji }),
        ...fetchOpts,
      })
      if (!res.ok) throw new Error('toggle failed')
      socialDataVersionRef.current++
    } catch {
      await refetchSocial()
    }
  }

  async function submitComment(saleId: number, body: string) {
    const key = String(saleId)
    const text = body.trim()
    if (!text) return
    const tempId = `tmp-${Date.now()}-${Math.random().toString(36).slice(2)}`
    const optimistic = {
      id: tempId,
      sale_id: saleId,
      rep_name: viewerName,
      body: text,
      created_at: new Date().toISOString(),
    }
    setComments(prev => ({
      ...prev,
      [key]: [...(prev[key] ?? []), optimistic],
    }))
    try {
      const res = await fetch('/api/feed/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sale_id: saleId, body: text }),
        ...fetchOpts,
      })
      const json = (await res.json().catch(() => ({}))) as {
        error?: string
        comment?: { id: string; sale_id: number; rep_name: string; body: string; created_at: string }
      }
      if (!res.ok) {
        throw new Error(json.error ?? `Kommentar feilet (${res.status})`)
      }
      if (!json.comment) {
        throw new Error('Ugyldig svar fra server')
      }
      socialDataVersionRef.current++
      setComments(prev => ({
        ...prev,
        [key]: (prev[key] ?? []).map(c => (c.id === tempId ? json.comment! : c)),
      }))
    } catch (err) {
      setComments(prev => ({
        ...prev,
        [key]: (prev[key] ?? []).filter(c => c.id !== tempId),
      }))
      throw err
    }
  }

  return (
    <div>
      <p className="text-xs font-medium text-text-muted mb-4">
        Siste 7 dager
      </p>
      <ul className="space-y-3">
        {sorted.map(row => {
          const title = row.navn?.trim() || `#${row.id}`
          const chipCls = prisgrenseChipClass(row.prisgrense)
          const key = String(row.id)
          const reactEntry = reactions[key] ?? emptyReactions()
          const saleComments = comments[key] ?? []
          const pickerOpen = pickerSaleId === row.id

          return (
            <li
              key={row.id}
              className="bg-surface border border-border rounded-card p-4 flex gap-3"
            >
              <div
                className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-white text-xs font-semibold ${avatarClass(row.rep_name)}`}
              >
                {initialsFromRepName(row.rep_name)}
              </div>
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1">
                  <p className="text-base font-semibold text-text-primary">
                    {row.rep_name}
                  </p>
                  <span className="text-xs text-text-muted shrink-0 tabular-nums">
                    {feedDateTimeRight(row)}
                  </span>
                </div>
                <div className="text-lg text-text-primary font-medium">
                  {row.hs_deal_id ? (
                    <a
                      href={`${HUBSPOT_SALES_DEAL_BASE}/${row.hs_deal_id}/`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline decoration-text-hint underline-offset-[3px] hover:decoration-text-primary"
                    >
                      {title}
                      {row.prisgrense === 'Pris' ? ' 🏆' : ''}
                    </a>
                  ) : (
                    <span>
                      {title}
                      {row.prisgrense === 'Pris' ? ' 🏆' : ''}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-text-secondary pt-1">
                  <span className="inline-flex items-center gap-1.5 min-h-[1.5rem]">
                    Type:
                    <span className="inline-flex items-center text-xs text-text-secondary bg-bg border border-border px-2 py-0.5 rounded-pill leading-none">
                      {row.salgstype}
                    </span>
                  </span>
                  <span className="inline-flex items-center gap-1.5 min-h-[1.5rem]">
                    Innkjøpspris:
                    <span className="text-text-primary font-medium">
                      {row.innkjopspris != null ? fmtKr(row.innkjopspris) : '—'}
                    </span>
                  </span>
                  <span className="inline-flex items-center gap-1.5 min-h-[1.5rem]">
                    Pris:
                    <span className="text-text-primary font-medium">{fmtKr(row.brutto)}</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5 min-h-[1.5rem]">
                    Prisgrense:
                    {row.prisgrense ? (
                      <span className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-pill leading-none ${chipCls}`}>
                        {row.prisgrense}
                      </span>
                    ) : (
                      <span className="text-text-primary font-medium">—</span>
                    )}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  {reactEntry.reactions.map(g => {
                    const mine = reactEntry.myReactions.includes(g.emoji)
                    return (
                      <button
                        key={g.emoji}
                        type="button"
                        title={g.repNames.length ? g.repNames.join(', ') : undefined}
                        onClick={() => void toggleReaction(row.id, g.emoji)}
                        className={
                          mine
                            ? 'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[13px] leading-tight border border-blue-200 bg-blue-50 text-text-secondary hover:bg-blue-100/80'
                            : 'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[13px] leading-tight border border-gray-200 bg-gray-100 text-text-muted hover:bg-gray-200/80'
                        }
                      >
                        <span aria-hidden>{g.emoji}</span>
                        <span className="tabular-nums">{g.count}</span>
                      </button>
                    )
                  })}
                  <div
                    className="relative inline-flex group"
                    ref={pickerSaleId === row.id ? pickerRef : undefined}
                  >
                    <button
                      type="button"
                      onClick={() => setPickerSaleId(pickerOpen ? null : row.id)}
                      className="inline-flex items-center justify-center h-7 min-w-[1.75rem] px-1.5 rounded-full border border-gray-200 bg-white text-[#1f2937] shadow-[0_1px_0_rgba(0,0,0,0.04)] hover:bg-gray-50 hover:border-gray-300"
                      aria-expanded={pickerOpen}
                      aria-haspopup="listbox"
                      aria-label="Legg til reaksjon"
                    >
                      <SlackAddReactionGlyph className="text-[#1f2937]" />
                    </button>
                    <span
                      role="tooltip"
                      className="pointer-events-none absolute bottom-[calc(100%+8px)] left-1/2 z-30 -translate-x-1/2 whitespace-nowrap rounded-md bg-[#1d1c1d] px-2.5 py-1 text-xs font-medium text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100"
                    >
                      Legg til reaksjon…
                      <span
                        className="absolute left-1/2 top-full -mt-px h-0 w-0 -translate-x-1/2 border-x-[6px] border-x-transparent border-t-[6px] border-t-[#1d1c1d]"
                        aria-hidden
                      />
                    </span>
                    {pickerOpen && (
                      <div
                        className="absolute left-0 top-full mt-1 z-10 flex flex-wrap gap-0.5 p-1.5 rounded-lg border border-border bg-surface shadow-md max-w-[200px]"
                        role="listbox"
                      >
                        {FEED_ALLOWED_EMOJIS.map(em => (
                          <button
                            key={em}
                            type="button"
                            role="option"
                            className="w-8 h-8 flex items-center justify-center text-lg rounded hover:bg-bg text-text-secondary"
                            aria-label={`Reaksjon ${em}`}
                            onClick={() => {
                              void toggleReaction(row.id, em)
                              setPickerSaleId(null)
                            }}
                          >
                            {em}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setCommentOpenBySale(p => ({ ...p, [row.id]: true }))
                    }
                    className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 -ml-0.5 text-[13px] font-medium text-[#65676B] hover:bg-black/[0.04]"
                  >
                    <CommentBubbleGlyph className="text-[#65676B]" />
                    Kommenter
                  </button>
                </div>

                <FeedCommentsSection
                  saleId={row.id}
                  items={saleComments}
                  expanded={commentOpenBySale[row.id] ?? false}
                  onExpandedChange={open =>
                    setCommentOpenBySale(p => ({ ...p, [row.id]: open }))
                  }
                  onSubmit={submitComment}
                />
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function FeedCommentsSection({
  saleId,
  items,
  expanded,
  onExpandedChange,
  onSubmit,
}: {
  saleId: number
  items: FeedCommentPublic[]
  expanded: boolean
  onExpandedChange: (open: boolean) => void
  onSubmit: (saleId: number, body: string) => Promise<void>
}) {
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const commenters = uniqueCommentersInOrder(items)
  const maxAvatars = 5
  const shown = commenters.slice(0, maxAvatars)
  const overflow = commenters.length - shown.length
  const last = items.length > 0 ? items[items.length - 1] : null

  async function submitDraft() {
    const t = draft.trim()
    if (!t || sending) return
    setSending(true)
    setSubmitError(null)
    try {
      await onSubmit(saleId, t)
      setDraft('')
      onExpandedChange(true)
    } catch {
      setSubmitError('Kunne ikke sende kommentaren. Prøv igjen.')
    } finally {
      setSending(false)
    }
  }

  function onFormSubmit(e: React.FormEvent) {
    e.preventDefault()
    void submitDraft()
  }

  function onTextareaKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void submitDraft()
    }
  }

  return (
    <div className="mt-1.5 space-y-2">
      {!expanded && items.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-[13px]">
          <div className="flex items-center pl-0.5">
            {shown.map((name, i) => (
              <div
                key={name}
                className={`relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white ring-2 ring-surface ${avatarClass(name)} ${i > 0 ? '-ml-2' : ''}`}
                title={name}
              >
                {initialsFromRepName(name)}
              </div>
            ))}
            {overflow > 0 && (
              <div
                className="-ml-2 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#1f2937] text-[10px] font-semibold text-white ring-2 ring-surface"
                title={`+${overflow} til`}
              >
                +{overflow}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => onExpandedChange(true)}
            className="font-semibold text-[#1877F2] hover:underline"
          >
            {items.length} svar
          </button>
          {last && (
            <span className="text-text-muted">
              Siste svar {formatRelativeCommentTime(last.created_at)}
            </span>
          )}
        </div>
      )}

      {expanded && (
        <div className="rounded-lg border border-border/80 bg-bg/40 px-3 py-2.5 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[13px] font-medium text-text-secondary">
              {items.length > 0 ? `${items.length} svar` : 'Kommentarer'}
            </span>
            <button
              type="button"
              onClick={() => onExpandedChange(false)}
              className="text-[12px] text-text-muted hover:text-text-secondary"
            >
              Skjul
            </button>
          </div>
          {items.length > 0 && (
            <ul className="space-y-2 text-[13px] leading-snug">
              {items.map(c => (
                <li key={c.id} className="text-text-secondary">
                  <span className="font-semibold text-text-primary">{c.rep_name}</span>
                  <span className="text-text-hint mx-1">·</span>
                  <span>{c.body}</span>
                </li>
              ))}
            </ul>
          )}
          {submitError && (
            <p className="text-[13px] text-red-600" role="alert">
              {submitError}
            </p>
          )}
          <form onSubmit={onFormSubmit} className="flex gap-2 items-end">
            <label className="sr-only" htmlFor={`feed-comment-${saleId}`}>
              Kommentar
            </label>
            <textarea
              id={`feed-comment-${saleId}`}
              rows={2}
              value={draft}
              onChange={e => {
                setDraft(e.target.value)
                setSubmitError(null)
              }}
              onKeyDown={onTextareaKeyDown}
              maxLength={2000}
              placeholder="Skriv en kommentar…"
              className="flex-1 min-h-[2.5rem] max-h-28 resize-y rounded-lg border border-border bg-surface px-2.5 py-1.5 text-[13px] text-text-primary placeholder:text-text-hint focus:outline-none focus:border-[#1877F2]/50 focus:ring-1 focus:ring-[#1877F2]/20"
            />
            <button
              type="submit"
              disabled={sending || !draft.trim()}
              className="shrink-0 h-8 px-3 rounded-lg text-[13px] font-medium border border-border bg-surface text-text-secondary hover:bg-bg disabled:opacity-50"
            >
              Send
            </button>
          </form>
          <p className="text-[11px] text-text-hint">Enter for å sende · Shift+Enter for ny linje</p>
        </div>
      )}
    </div>
  )
}
