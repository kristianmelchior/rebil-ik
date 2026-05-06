'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import dynamic from 'next/dynamic'
import type { RatingQuestion, RatingOption } from '@/app/tl/api/vurdering/questions/route'
import type { RatingRow } from '@/app/tl/api/vurdering/ratings/route'
import type { CommentRow } from '@/app/tl/api/vurdering/comments/route'
import { currentIsoWeek, isoWeekLabel, recentWeeks } from '@/lib/tl/week'

// Lazy-load emoji-mart — only fetched when picker is first opened
const EmojiMartPicker = dynamic(() => import('@emoji-mart/react'), { ssr: false })

// ─── Types ────────────────────────────────────────────────────────────────────

interface Rep {
  kode: string
  full_name: string
  teamleder: string
}

interface Props {
  reps:           Rep[]
  raterName:      string
  isAdmin:        boolean
  teamleders:     string[]
  ownTeamleder:   string | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function hexToRgb(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return { r, g, b }
}

function isDark(hex: string): boolean {
  try {
    const { r, g, b } = hexToRgb(hex)
    return (r * 299 + g * 587 + b * 114) / 1000 < 128
  } catch { return false }
}

function darken(hex: string, amount = 60): string {
  try {
    const { r, g, b } = hexToRgb(hex)
    const clamp = (v: number) => Math.max(0, Math.min(255, v))
    return `rgb(${clamp(r - amount)}, ${clamp(g - amount)}, ${clamp(b - amount)})`
  } catch { return hex }
}

// ─── Emoji picker (emoji-mart) ────────────────────────────────────────────────

function EmojiPicker({ onSelect }: { onSelect: (e: string) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="text-base leading-none hover:scale-110 transition-transform select-none"
        title="Legg til emoji"
      >
        😊
      </button>
      {open && (
        <div className="absolute bottom-full left-0 mb-1.5 z-50">
          <EmojiMartPicker
            data={async () => (await import('@emoji-mart/data')).default}
            onEmojiSelect={(em: { native: string }) => {
              onSelect(em.native)
              setOpen(false)
            }}
            locale="en"
            theme="light"
            previewPosition="none"
            skinTonePosition="none"
            maxFrequentRows={2}
          />
        </div>
      )}
    </div>
  )
}

// ─── Comment textarea (debounced auto-save + manual save button) ──────────────

function CommentCell({
  kode, initialValue, onSave,
}: {
  kode:         string
  initialValue: string
  onSave:       (kode: string, comment: string) => void
}) {
  const [value,   setValue]   = useState(initialValue)
  const [saved,   setSaved]   = useState(initialValue)
  const [status,  setStatus]  = useState<'idle' | 'saving' | 'saved'>('idle')
  const timerRef  = useRef<ReturnType<typeof setTimeout> | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => { setValue(initialValue); setSaved(initialValue) }, [initialValue])

  function persist(v: string) {
    onSave(kode, v)
    setSaved(v)
    setStatus('saved')
    setTimeout(() => setStatus('idle'), 1500)
  }

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const v = e.target.value
    setValue(v)
    setStatus('saving')
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => persist(v), 1200)
  }

  function handleSave() {
    if (timerRef.current) clearTimeout(timerRef.current)
    persist(value)
  }

  function insertEmoji(emoji: string) {
    const el = textareaRef.current
    if (!el) { setValue(v => v + emoji); return }
    const start = el.selectionStart ?? value.length
    const end   = el.selectionEnd   ?? value.length
    const next  = value.slice(0, start) + emoji + value.slice(end)
    setValue(next)
    setStatus('saving')
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => persist(next), 1200)
    // Restore cursor after emoji
    requestAnimationFrame(() => {
      el.selectionStart = el.selectionEnd = start + emoji.length
      el.focus()
    })
  }

  const isDirty = value !== saved

  return (
    <div className="space-y-1.5 min-w-[240px]">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        placeholder="Fritekstkommentar…"
        rows={3}
        className="w-full text-sm border border-[#e5e7eb] rounded-lg px-3 py-2 resize-y outline-none focus:border-[var(--rebil-red)] bg-white text-text-primary placeholder:text-gray-300 transition-colors leading-relaxed"
      />
      <div className="flex items-center gap-2">
        <EmojiPicker onSelect={insertEmoji} />
        {(isDirty || status !== 'idle') && (
          <button
            onClick={handleSave}
            className="text-[11px] font-medium text-white bg-[var(--rebil-red)] px-2.5 py-0.5 rounded transition-opacity hover:opacity-80"
          >
            Lagre
          </button>
        )}
        {status === 'saving' && <span className="text-[10px] text-text-muted">lagrer…</span>}
        {status === 'saved'  && !isDirty && <span className="text-[10px] text-[#16a34a]">✓ Lagret</span>}
      </div>
    </div>
  )
}

// ─── Rate tab ─────────────────────────────────────────────────────────────────

function RateTab({
  reps, questions, ratings, comments, week, saving, onRate, onComment,
}: {
  reps:      Rep[]
  questions: RatingQuestion[]
  ratings:   Map<string, Map<string, string>>   // kode → question_id → option_id
  comments:  Map<string, string>                // kode → comment text
  week:      string
  saving:    Set<string>
  onRate:    (kode: string, question_id: string, option_id: string) => void
  onComment: (kode: string, comment: string) => void
}) {
  if (questions.length === 0) {
    return (
      <p className="text-sm text-text-muted">
        Ingen vurderingsspørsmål er satt opp ennå. En superadmin kan legge til spørsmål under Administrer.
      </p>
    )
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-text-muted">
        Uke: <span className="font-medium text-text-primary">{isoWeekLabel(week)}</span>
      </p>
      <div className="bg-surface border border-border rounded-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-bg">
              <th className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider whitespace-nowrap">
                Ansatt
              </th>
              {questions.map(q => (
                <th key={q.id} className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider min-w-[160px]">
                  {q.text}
                </th>
              ))}
              <th className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider min-w-[220px]">
                Kommentar
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider whitespace-nowrap">
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {reps.map((rep, i) => {
              const repRatings = ratings.get(rep.kode) ?? new Map<string, string>()
              const doneCount  = questions.filter(q => repRatings.has(q.id)).length
              const allDone    = doneCount === questions.length

              return (
                <tr
                  key={rep.kode}
                  className={`border-b border-border last:border-0 ${i % 2 !== 0 ? 'bg-bg' : ''}`}
                >
                  <td className="px-4 py-3 font-medium text-text-primary whitespace-nowrap align-top">
                    {rep.full_name}
                  </td>
                  {questions.map(q => {
                    const selectedId = repRatings.get(q.id)
                    const key = `${rep.kode}:${q.id}`
                    const isSaving = saving.has(key)
                    return (
                      <td key={q.id} className="px-4 py-3 align-top">
                        {/* Segmented control — all options joined on one line */}
                        <div className="inline-flex rounded-full border border-[#e5e7eb] overflow-hidden" style={{ opacity: isSaving ? 0.6 : 1 }}>
                          {q.options.map((opt, optIdx) => {
                            const isSelected = opt.id === selectedId
                            const textColor  = isDark(opt.color) ? '#fff' : '#222'
                            const isFirst    = optIdx === 0
                            const isLast     = optIdx === q.options.length - 1
                            return (
                              <button
                                key={opt.id}
                                disabled={isSaving}
                                onClick={() => onRate(rep.kode, q.id, opt.id)}
                                style={isSelected ? {
                                  backgroundColor: opt.color,
                                  color:           textColor,
                                } : {
                                  backgroundColor: '#fff',
                                  color:           '#9ca3af',
                                }}
                                className={[
                                  'text-xs px-3 py-1.5 whitespace-nowrap select-none transition-colors',
                                  isSelected ? 'font-semibold' : 'font-normal hover:bg-gray-50 hover:text-gray-600',
                                  !isFirst ? 'border-l border-[#e5e7eb]' : '',
                                ].join(' ')}
                              >
                                {isSelected ? `✓ ${opt.text}` : opt.text}
                              </button>
                            )
                          })}
                        </div>
                      </td>
                    )
                  })}
                  {/* Comment textarea */}
                  <td className="px-4 py-2 align-top">
                    <CommentCell
                      kode={rep.kode}
                      initialValue={comments.get(rep.kode) ?? ''}
                      onSave={onComment}
                    />
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap align-top">
                    {allDone ? (
                      <span className="text-xs font-medium text-[#16a34a] bg-[#f0fdf4] border border-[#bbf7d0] px-2 py-0.5 rounded-full">
                        ✓ Ferdig
                      </span>
                    ) : (
                      <span className="text-xs text-text-muted">
                        {doneCount}/{questions.length}
                      </span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Tooltip ──────────────────────────────────────────────────────────────────

function CommentTooltip({ text }: { text: string }) {
  const [visible, setVisible] = useState(false)

  return (
    <div
      className="relative inline-block"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      <span className="text-xs text-text-muted cursor-default select-none px-1.5 py-0.5 rounded hover:bg-border transition-colors">
        💬
      </span>
      {visible && (
        <div className="absolute z-50 left-1/2 -translate-x-1/2 bottom-full mb-1.5 w-56 bg-gray-900 text-white text-xs rounded-lg px-3 py-2 shadow-lg whitespace-pre-wrap leading-relaxed pointer-events-none">
          {text}
          <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-gray-900" />
        </div>
      )}
    </div>
  )
}

// ─── Stats tab ─────────────────────────────────────────────────────────────────
// Rows = reps grouped × questions + comment row. Columns = weeks (newest left).

function StatsTab({
  reps, questions,
}: {
  reps:      Rep[]
  questions: RatingQuestion[]
  isAdmin:   boolean
}) {
  const [allRatings,  setAllRatings]  = useState<RatingRow[]>([])
  const [allComments, setAllComments] = useState<CommentRow[]>([])
  const [loadingHist, setLoadingHist] = useState(true)
  const weeks = recentWeeks(8)

  useEffect(() => {
    setLoadingHist(true)
    Promise.all([
      // Ratings for each week
      ...weeks.map(w =>
        fetch(`/tl/api/vurdering/ratings?week=${w}`, { credentials: 'include' })
          .then(r => r.ok ? r.json() as Promise<RatingRow[]> : [])
          .catch(() => [] as RatingRow[])
      ),
      // Comments for each week
      ...weeks.map(w =>
        fetch(`/tl/api/vurdering/comments?week=${w}`, { credentials: 'include' })
          .then(r => r.ok ? r.json() as Promise<CommentRow[]> : [])
          .catch(() => [] as CommentRow[])
      ),
    ]).then(results => {
      const half = weeks.length
      setAllRatings((results.slice(0, half) as RatingRow[][]).flat())
      setAllComments((results.slice(half)   as CommentRow[][]).flat())
      setLoadingHist(false)
    }).catch(() => setLoadingHist(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const optionMap = new Map<string, RatingOption>()
  for (const q of questions) for (const o of q.options) optionMap.set(o.id, o)

  // kode → week → question_id → option_id
  const dataMap = new Map<string, Map<string, Map<string, string>>>()
  for (const r of allRatings) {
    if (!dataMap.has(r.kode)) dataMap.set(r.kode, new Map())
    const byWeek = dataMap.get(r.kode)!
    if (!byWeek.has(r.week)) byWeek.set(r.week, new Map())
    byWeek.get(r.week)!.set(r.question_id, r.option_id)
  }

  // kode → week → comment text
  const commentMap = new Map<string, Map<string, string>>()
  for (const c of allComments) {
    if (!commentMap.has(c.kode)) commentMap.set(c.kode, new Map())
    commentMap.get(c.kode)!.set(c.week, c.comment)
  }

  // Only show weeks that have any data
  const activeWeeks = weeks.filter(w =>
    allRatings.some(r => r.week === w) || allComments.some(c => c.week === w)
  )

  function shortWeekLabel(week: string) {
    const m = week.match(/^(\d{4})-W(\d{2})$/)
    return m ? `Uke ${parseInt(m[2], 10)}` : week
  }

  if (loadingHist) return <p className="text-sm text-text-muted">Laster historikk…</p>
  if (activeWeeks.length === 0) {
    return <p className="text-sm text-text-muted">Ingen vurderinger er registrert ennå.</p>
  }

  const latestWeek = activeWeeks[0] // newest first

  // Column layout:
  // - Label column: fixed, shrinks to content
  // - Latest week: wide (~1/3 of remaining space), min 220px
  // - Older weeks: narrow, sized to widest pill ("Under forventet"), ~120px
  // Table overflows horizontally — container has overflow-x-auto

  return (
    <div className="bg-surface border border-border rounded-card overflow-x-auto">
      <table className="text-sm" style={{ tableLayout: 'fixed', minWidth: '100%' }}>
        <colgroup>
          <col style={{ width: '180px' }} />
          {activeWeeks.map((w, i) => (
            <col key={w} style={{ width: i === 0 ? '260px' : '130px' }} />
          ))}
        </colgroup>
        <thead>
          <tr className="border-b border-border bg-bg">
            <th className="px-4 py-3" />
            {activeWeeks.map((w, i) => (
              <th
                key={w}
                className={`px-4 py-3 text-left text-xs uppercase tracking-wider whitespace-nowrap ${
                  i === 0
                    ? 'font-bold text-text-primary'
                    : 'font-medium text-text-muted'
                }`}
              >
                {shortWeekLabel(w)}
                {i === 0 && (
                  <span className="ml-1.5 text-[10px] font-normal text-text-muted normal-case tracking-normal">siste</span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {reps.map((rep, repIdx) => {
            const byWeek    = dataMap.get(rep.kode)
            const byWeekCom = commentMap.get(rep.kode)

            return (
              <React.Fragment key={rep.kode}>
                {/* Rep name header row */}
                <tr className={`border-b border-border ${repIdx > 0 ? 'border-t-2' : ''}`}>
                  <td
                    colSpan={activeWeeks.length + 1}
                    className="px-4 py-2 font-semibold text-text-primary bg-bg text-xs uppercase tracking-wide"
                  >
                    {rep.full_name}
                  </td>
                </tr>

                {/* One row per question */}
                {questions.map((q, qIdx) => (
                  <tr
                    key={q.id}
                    className={`border-b border-border ${qIdx % 2 !== 0 ? 'bg-[#FAFAFA]' : ''}`}
                  >
                    <td className="px-4 py-2 text-xs text-text-muted pl-6 truncate">
                      {q.text}
                    </td>
                    {activeWeeks.map((w, wi) => {
                      const optId = byWeek?.get(w)?.get(q.id)
                      const opt   = optId ? optionMap.get(optId) : undefined
                      if (!opt) return (
                        <td key={w} className="px-4 py-2 text-xs text-text-muted">—</td>
                      )
                      const textColor = isDark(opt.color) ? '#fff' : '#111'
                      return (
                        <td key={w} className="px-4 py-2">
                          <span
                            className="text-xs px-2.5 py-0.5 rounded-full font-medium whitespace-nowrap"
                            style={{ backgroundColor: opt.color, color: textColor }}
                          >
                            {opt.text}
                          </span>
                        </td>
                      )
                    })}
                  </tr>
                ))}

                {/* Comment row */}
                {activeWeeks.some(w => byWeekCom?.get(w)) && (
                  <tr className="border-b border-border bg-[#FAFAFA]">
                    <td className="px-4 py-2 text-xs text-text-muted pl-6 whitespace-nowrap italic">
                      Kommentar
                    </td>
                    {activeWeeks.map((w, wi) => {
                      const text = byWeekCom?.get(w) ?? ''
                      if (!text) return <td key={w} className="px-4 py-2 text-xs text-text-muted">—</td>

                      if (wi === 0) {
                        // Latest week: full text, truncated with tooltip on hover
                        return (
                          <td key={w} className="px-4 py-2 text-xs text-text-primary">
                            <span className="line-clamp-3 leading-relaxed" title={text}>{text}</span>
                          </td>
                        )
                      }
                      // Older weeks: 💬 icon with tooltip
                      return (
                        <td key={w} className="px-4 py-2">
                          <CommentTooltip text={text} />
                        </td>
                      )
                    })}
                  </tr>
                )}
              </React.Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function VurderingSection({ reps, raterName, isAdmin, teamleders, ownTeamleder }: Props) {
  const [tab,         setTab]         = useState<'rate' | 'stats'>('rate')
  const [selectedTl,  setSelectedTl]  = useState<string>(ownTeamleder ?? '__all__')
  const [questions,   setQuestions]   = useState<RatingQuestion[]>([])
  const [ratings,     setRatings]     = useState<Map<string, Map<string, string>>>(new Map())
  const [comments,    setComments]    = useState<Map<string, string>>(new Map())  // kode → text
  const [loadingQ,    setLoadingQ]    = useState(true)
  const [loadingR,    setLoadingR]    = useState(true)
  const [saving,      setSaving]      = useState<Set<string>>(new Set())
  const week = currentIsoWeek()

  const visibleReps = isAdmin && selectedTl !== '__all__'
    ? reps.filter(r => r.teamleder === selectedTl)
    : reps

  // Load questions
  useEffect(() => {
    fetch('/tl/api/vurdering/questions', { credentials: 'include' })
      .then(r => r.ok ? r.json() as Promise<RatingQuestion[]> : [])
      .then(data => { setQuestions(data); setLoadingQ(false) })
      .catch(() => setLoadingQ(false))
  }, [])

  // Load ratings + comments for current week.
  // No tl-filter here — fetch all ratings for the week and let visibleReps handle client-side filtering.
  // (The tl param filters on rater_name, not on the rated rep's team, which would be wrong.)
  const loadRatings = useCallback(() => {
    setLoadingR(true)
    Promise.all([
      fetch(`/tl/api/vurdering/ratings?week=${week}`,  { credentials: 'include' })
        .then(r => r.ok ? r.json() as Promise<RatingRow[]>  : []).catch(() => [] as RatingRow[]),
      fetch(`/tl/api/vurdering/comments?week=${week}`, { credentials: 'include' })
        .then(r => r.ok ? r.json() as Promise<CommentRow[]> : []).catch(() => [] as CommentRow[]),
    ]).then(([ratingRows, commentRows]) => {
      const m = new Map<string, Map<string, string>>()
      for (const row of ratingRows as RatingRow[]) {
        if (!m.has(row.kode)) m.set(row.kode, new Map())
        m.get(row.kode)!.set(row.question_id, row.option_id)
      }
      setRatings(m)

      const cm = new Map<string, string>()
      for (const c of commentRows as CommentRow[]) cm.set(c.kode, c.comment)
      setComments(cm)

      setLoadingR(false)
    }).catch(() => setLoadingR(false))
  }, [week])

  useEffect(() => { loadRatings() }, [loadRatings])

  async function handleRate(kode: string, question_id: string, option_id: string) {
    const key = `${kode}:${question_id}`
    setSaving(prev => new Set(prev).add(key))
    setRatings(prev => {
      const next = new Map(prev)
      if (!next.has(kode)) next.set(kode, new Map())
      next.get(kode)!.set(question_id, option_id)
      return next
    })
    try {
      await fetch('/tl/api/vurdering/ratings', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ kode, question_id, option_id }),
      })
    } catch { loadRatings() }
    finally { setSaving(prev => { const s = new Set(prev); s.delete(key); return s }) }
  }

  async function handleComment(kode: string, comment: string) {
    // Optimistic update
    setComments(prev => { const m = new Map(prev); m.set(kode, comment); return m })
    await fetch('/tl/api/vurdering/comments', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ kode, comment }),
    }).catch(() => {})
  }

  const loading = loadingQ || loadingR

  const totalExpected = visibleReps.length * questions.length
  const totalDone = visibleReps.reduce((sum, rep) =>
    sum + questions.filter(q => ratings.get(rep.kode)?.has(q.id)).length, 0)
  const allComplete = totalExpected > 0 && totalDone === totalExpected

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-text-primary">Ukentlig vurdering</h1>
        <p className="text-sm text-text-muted mt-1">{isoWeekLabel(week)}</p>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="inline-flex bg-[#EBEBEB] rounded-pill p-[3px] gap-0.5">
          {([['rate', 'Rate'], ['stats', 'Historikk']] as const).map(([t, label]) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-pill text-xs font-medium px-3.5 py-1 transition-colors ${
                tab === t
                  ? 'bg-[var(--rebil-red)] text-white'
                  : 'bg-transparent text-text-muted hover:text-text-primary'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {isAdmin && teamleders.length > 0 && (
          <select
            value={selectedTl}
            onChange={e => setSelectedTl(e.target.value)}
            className="text-sm font-medium border border-border rounded-lg px-3 py-1.5 bg-surface outline-none cursor-pointer focus:border-[var(--rebil-red)] text-text-primary"
          >
            <option value="__all__">Alle team</option>
            {teamleders.map(tl => (
              <option key={tl} value={tl}>{tl}</option>
            ))}
          </select>
        )}
      </div>

      {tab === 'rate' && !loading && allComplete && (
        <div className="flex items-center gap-2 text-sm font-medium text-[#16a34a] bg-[#f0fdf4] border border-[#bbf7d0] rounded-lg px-4 py-2.5">
          ✓ Alle ansatte er vurdert for {isoWeekLabel(week)}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-text-muted">Laster…</p>
      ) : tab === 'rate' ? (
        <RateTab
          reps={visibleReps}
          questions={questions}
          ratings={ratings}
          comments={comments}
          week={week}
          saving={saving}
          onRate={handleRate}
          onComment={handleComment}
        />
      ) : (
        <StatsTab
          reps={visibleReps}
          questions={questions}
          isAdmin={isAdmin}
        />
      )}
    </div>
  )
}
