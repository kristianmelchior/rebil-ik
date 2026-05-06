'use client'

import { useState, useEffect } from 'react'
import type { RatingQuestion } from '@/app/tl/api/vurdering/questions/route'

// ─── Pastel colour palette ────────────────────────────────────────────────────

const PASTEL_COLORS = [
  { hex: '#E8F5E9', label: 'Grønn'   },
  { hex: '#FFF9C4', label: 'Gul'     },
  { hex: '#FFEBEE', label: 'Rød'     },
  { hex: '#E3F2FD', label: 'Blå'     },
  { hex: '#F3E5F5', label: 'Lilla'   },
  { hex: '#FBE9E7', label: 'Oransje' },
  { hex: '#E0F7FA', label: 'Cyan'    },
  { hex: '#F9FBE7', label: 'Lime'    },
  { hex: '#FCE4EC', label: 'Rosa'    },
  { hex: '#EEEEEE', label: 'Grå'     },
]

// ─── Option editor ────────────────────────────────────────────────────────────

interface DraftOption {
  id?:        string
  text:       string
  color:      string
  sort_order: number
}

function OptionEditor({
  options, onChange,
}: {
  options:  DraftOption[]
  onChange: (opts: DraftOption[]) => void
}) {
  function update(i: number, patch: Partial<DraftOption>) {
    const next = options.map((o, idx) => idx === i ? { ...o, ...patch } : o)
    onChange(next)
  }
  function remove(i: number) { onChange(options.filter((_, idx) => idx !== i)) }
  function add()             { onChange([...options, { text: '', color: PASTEL_COLORS[0].hex, sort_order: options.length }]) }
  function move(i: number, dir: -1 | 1) {
    const j = i + dir
    if (j < 0 || j >= options.length) return
    const next = [...options]
    ;[next[i], next[j]] = [next[j], next[i]]
    onChange(next.map((o, idx) => ({ ...o, sort_order: idx })))
  }

  return (
    <div className="space-y-2">
      {options.map((opt, i) => (
        <div key={i} className="flex items-center gap-2">
          {/* Move up/down */}
          <div className="flex flex-col">
            <button onClick={() => move(i, -1)} className="text-text-muted hover:text-text-primary text-xs leading-none px-0.5" title="Opp">▲</button>
            <button onClick={() => move(i,  1)} className="text-text-muted hover:text-text-primary text-xs leading-none px-0.5" title="Ned">▼</button>
          </div>
          {/* Colour picker */}
          <div className="flex gap-1 flex-wrap max-w-[180px]">
            {PASTEL_COLORS.map(c => (
              <button
                key={c.hex}
                title={c.label}
                onClick={() => update(i, { color: c.hex })}
                style={{ backgroundColor: c.hex }}
                className={`w-5 h-5 rounded border-2 transition-all ${opt.color === c.hex ? 'border-gray-600 scale-110' : 'border-transparent hover:border-gray-400'}`}
              />
            ))}
          </div>
          {/* Preview pill */}
          <span className="text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap" style={{ backgroundColor: opt.color }}>
            {opt.text || 'Tekst…'}
          </span>
          {/* Text input */}
          <input
            type="text"
            value={opt.text}
            onChange={e => update(i, { text: e.target.value })}
            placeholder="Alternativtekst"
            className="flex-1 text-sm border border-border rounded px-2 py-1 outline-none focus:border-[var(--rebil-red)] bg-white min-w-[120px]"
          />
          <button onClick={() => remove(i)} className="text-text-muted hover:text-[#dc2626] text-sm">✕</button>
        </div>
      ))}
      <button
        onClick={add}
        className="text-xs text-text-muted hover:text-text-primary border border-dashed border-border rounded px-3 py-1.5 transition-colors"
      >
        + Legg til alternativ
      </button>
    </div>
  )
}

// ─── Question card ────────────────────────────────────────────────────────────

function QuestionCard({
  question, index, total, onSave, onDelete, onMoveUp, onMoveDown,
}: {
  question:    RatingQuestion
  index:       number
  total:       number
  onSave:      (id: string, text: string, options: DraftOption[]) => Promise<void>
  onDelete:    (id: string) => Promise<void>
  onMoveUp:    (id: string) => void
  onMoveDown:  (id: string) => void
}) {
  const [editing,  setEditing]  = useState(false)
  const [text,     setText]     = useState(question.text)
  const [options,  setOptions]  = useState<DraftOption[]>(question.options)
  const [saving,   setSaving]   = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function save() {
    setSaving(true)
    await onSave(question.id, text, options)
    setSaving(false)
    setEditing(false)
  }

  async function del() {
    if (!confirm(`Slett spørsmålet «${question.text}»? Eksisterende vurderinger beholdes.`)) return
    setDeleting(true)
    await onDelete(question.id)
    setDeleting(false)
  }

  return (
    <div className="bg-white border border-border rounded-lg p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1">
          <button onClick={() => onMoveUp(question.id)}   disabled={index === 0}       className="text-text-muted hover:text-text-primary disabled:opacity-30 text-xs px-1">▲</button>
          <button onClick={() => onMoveDown(question.id)} disabled={index === total-1}  className="text-text-muted hover:text-text-primary disabled:opacity-30 text-xs px-1">▼</button>
        </div>
        {editing ? (
          <input
            type="text"
            value={text}
            onChange={e => setText(e.target.value)}
            className="flex-1 text-sm font-medium border border-border rounded px-2 py-1 outline-none focus:border-[var(--rebil-red)] bg-white"
          />
        ) : (
          <span className="flex-1 text-sm font-medium text-text-primary">{question.text}</span>
        )}
        <div className="flex items-center gap-2 shrink-0">
          {editing ? (
            <>
              <button onClick={save} disabled={saving} className="text-xs font-medium text-white bg-[var(--rebil-red)] px-3 py-1 rounded transition-colors hover:opacity-90 disabled:opacity-50">
                {saving ? 'Lagrer…' : 'Lagre'}
              </button>
              <button onClick={() => { setEditing(false); setText(question.text); setOptions(question.options) }} className="text-xs text-text-muted hover:text-text-primary">
                Avbryt
              </button>
            </>
          ) : (
            <>
              <button onClick={() => setEditing(true)} className="text-xs text-text-muted hover:text-text-primary">Rediger</button>
              <button onClick={del} disabled={deleting} className="text-xs text-text-muted hover:text-[#dc2626] disabled:opacity-50">
                {deleting ? '…' : 'Slett'}
              </button>
            </>
          )}
        </div>
      </div>

      {editing && (
        <div className="border-t border-border pt-3">
          <p className="text-xs font-medium text-text-muted mb-2 uppercase tracking-wider">Alternativer</p>
          <OptionEditor options={options} onChange={setOptions} />
        </div>
      )}

      {!editing && (
        <div className="flex flex-wrap gap-1.5">
          {question.options.map(opt => (
            <span key={opt.id} className="text-xs px-2.5 py-1 rounded-full font-medium" style={{ backgroundColor: opt.color }}>
              {opt.text}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── New question form ────────────────────────────────────────────────────────

function NewQuestionForm({ onCreated }: { onCreated: () => void }) {
  const [open,    setOpen]    = useState(false)
  const [text,    setText]    = useState('')
  const [options, setOptions] = useState<DraftOption[]>([
    { text: '', color: PASTEL_COLORS[0].hex, sort_order: 0 },
  ])
  const [saving,  setSaving]  = useState(false)

  async function submit() {
    if (!text.trim()) return
    setSaving(true)
    await fetch('/tl/api/vurdering/questions', {
      method:      'POST',
      headers:     { 'Content-Type': 'application/json' },
      credentials: 'include',
      body:        JSON.stringify({ text: text.trim(), options }),
    })
    setSaving(false)
    setText('')
    setOptions([{ text: '', color: PASTEL_COLORS[0].hex, sort_order: 0 }])
    setOpen(false)
    onCreated()
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full text-sm text-text-muted hover:text-text-primary border border-dashed border-border rounded-lg px-4 py-3 transition-colors text-left"
      >
        + Nytt spørsmål
      </button>
    )
  }

  return (
    <div className="bg-white border border-[var(--rebil-red)] rounded-lg p-4 space-y-4">
      <input
        type="text"
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder="Spørsmålstekst…"
        className="w-full text-sm font-medium border border-border rounded px-2 py-1.5 outline-none focus:border-[var(--rebil-red)] bg-white"
        autoFocus
      />
      <div>
        <p className="text-xs font-medium text-text-muted mb-2 uppercase tracking-wider">Alternativer</p>
        <OptionEditor options={options} onChange={setOptions} />
      </div>
      <div className="flex gap-2">
        <button onClick={submit} disabled={saving || !text.trim()} className="text-xs font-medium text-white bg-[var(--rebil-red)] px-4 py-1.5 rounded hover:opacity-90 disabled:opacity-50 transition-colors">
          {saving ? 'Oppretter…' : 'Opprett spørsmål'}
        </button>
        <button onClick={() => setOpen(false)} className="text-xs text-text-muted hover:text-text-primary">Avbryt</button>
      </div>
    </div>
  )
}

// ─── Main export ──────────────────────────────────────────────────────────────

export default function VurderingQuestionsAdmin() {
  const [questions, setQuestions] = useState<RatingQuestion[]>([])
  const [loading,   setLoading]   = useState(true)

  async function load() {
    setLoading(true)
    const res = await fetch('/tl/api/vurdering/questions', { credentials: 'include' })
    if (res.ok) setQuestions(await res.json() as RatingQuestion[])
    setLoading(false)
  }

  useEffect(() => { void load() }, [])

  async function handleSave(id: string, text: string, options: DraftOption[]) {
    await fetch(`/tl/api/vurdering/questions/${id}`, {
      method:      'PUT',
      headers:     { 'Content-Type': 'application/json' },
      credentials: 'include',
      body:        JSON.stringify({ text, options }),
    })
    await load()
  }

  async function handleDelete(id: string) {
    await fetch(`/tl/api/vurdering/questions/${id}`, {
      method: 'DELETE', credentials: 'include',
    })
    await load()
  }

  function handleMoveUp(id: string) {
    const idx = questions.findIndex(q => q.id === id)
    if (idx <= 0) return
    const next = [...questions]
    ;[next[idx - 1], next[idx]] = [next[idx], next[idx - 1]]
    setQuestions(next)
    // Persist new order
    next.forEach((q, i) => {
      fetch(`/tl/api/vurdering/questions/${q.id}`, {
        method:      'PUT',
        headers:     { 'Content-Type': 'application/json' },
        credentials: 'include',
        body:        JSON.stringify({ sort_order: i }),
      }).catch(() => {})
    })
  }

  function handleMoveDown(id: string) {
    const idx = questions.findIndex(q => q.id === id)
    if (idx < 0 || idx >= questions.length - 1) return
    const next = [...questions]
    ;[next[idx], next[idx + 1]] = [next[idx + 1], next[idx]]
    setQuestions(next)
    next.forEach((q, i) => {
      fetch(`/tl/api/vurdering/questions/${q.id}`, {
        method:      'PUT',
        headers:     { 'Content-Type': 'application/json' },
        credentials: 'include',
        body:        JSON.stringify({ sort_order: i }),
      }).catch(() => {})
    })
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold text-text-primary">Vurderingsspørsmål</h3>
        <p className="text-sm text-text-muted mt-0.5">Konfigurer hvilke spørsmål og alternativer TL bruker når de vurderer sine ansatte ukentlig.</p>
      </div>

      {loading ? (
        <p className="text-sm text-text-muted">Laster…</p>
      ) : (
        <div className="space-y-2">
          {questions.map((q, i) => (
            <QuestionCard
              key={q.id}
              question={q}
              index={i}
              total={questions.length}
              onSave={handleSave}
              onDelete={handleDelete}
              onMoveUp={handleMoveUp}
              onMoveDown={handleMoveDown}
            />
          ))}
          <NewQuestionForm onCreated={load} />
        </div>
      )}
    </div>
  )
}
