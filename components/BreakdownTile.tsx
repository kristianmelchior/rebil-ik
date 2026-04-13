'use client'

import { useState } from 'react'
import type { SaleRow } from '@/lib/types'

export interface Slice { label: string; biler: number; pct: number; color: string }

// ─── Pris distribution ────────────────────────────────────────────────────────

const PRIS_CATS = ['Pris', 'Rabattnivå 1', 'Rabattnivå 2', 'Minstepris'] as const
type PrisCat = typeof PRIS_CATS[number]

const PRIS_COLORS: Record<PrisCat, string> = {
  'Pris':         '#4A8A2A',
  'Rabattnivå 1': '#E08C2A',
  'Rabattnivå 2': '#D94040',
  'Minstepris':   '#8B1F1F',
}

export function buildPrisSlices(sales: SaleRow[]): Slice[] {
  const counts: Record<PrisCat, number> = { 'Pris': 0, 'Rabattnivå 1': 0, 'Rabattnivå 2': 0, 'Minstepris': 0 }
  for (const s of sales) {
    const g = (s.prisgrense ?? '') as PrisCat
    if (g in counts) counts[g] += s.biler ?? 0
  }
  const total = Object.values(counts).reduce((a, b) => a + b, 0)
  if (total === 0) return []
  return PRIS_CATS
    .filter(cat => counts[cat] > 0)
    .map(cat => ({ label: cat, biler: counts[cat], pct: counts[cat] / total, color: PRIS_COLORS[cat] }))
}

// ─── Fordeling biler ──────────────────────────────────────────────────────────

const FORD_COLORS: Record<string, string> = {
  'Fastpris':   '#2A6DB5',
  'Kommisjon':  '#8B5CF6',
  'Salgshjelp': '#9CA3AF',
}

export function buildFordSlices(sales: SaleRow[]): Slice[] {
  const counts: Record<string, number> = { 'Fastpris': 0, 'Kommisjon': 0, 'Salgshjelp': 0 }
  for (const s of sales) {
    const biler = s.biler ?? 0
    if (biler <= 0) continue
    if (s.bonustype === 'Salgshjelp') {
      counts['Salgshjelp'] += biler
    } else if (s.salgstype === 'B2B' || s.salgstype === 'Retail') {
      counts['Fastpris'] += biler
    } else if (s.salgstype === 'Kommisjon' || s.salgstype === 'Fjernkommisjon') {
      counts['Kommisjon'] += biler
    }
  }
  const total = Object.values(counts).reduce((a, b) => a + b, 0)
  if (total === 0) return []
  return Object.entries(counts)
    .filter(([, v]) => v > 0)
    .map(([label, biler]) => ({ label, biler, pct: biler / total, color: FORD_COLORS[label] ?? '#ccc' }))
}

// ─── Shared breakdown tile ────────────────────────────────────────────────────

export function BreakdownTile({
  title, mainLabel, slices, muted = false,
}: {
  title: string
  mainLabel: string
  slices: Slice[]
  muted?: boolean
}) {
  const [show, setShow] = useState(false)
  const mainSlice = slices.find(s => s.label === mainLabel)
  const mainPct   = mainSlice?.pct ?? null

  return (
    <div
      className="bg-surface border border-border rounded-card p-5 text-center flex flex-col items-center justify-center min-h-[120px] relative"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      <p className="text-xs font-medium text-text-muted uppercase tracking-wider mb-2">{title}</p>
      <p className={`text-kpi font-medium leading-tight ${muted ? 'text-text-muted' : 'text-text-primary'}`}>
        {mainPct !== null ? `${Math.round(mainPct * 100)}%` : '—'}
      </p>

      {show && slices.length > 0 && (
        <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 z-20 bg-surface border border-border rounded-card shadow-lg p-3 w-48 text-left">
          {slices.map(s => (
            <div key={s.label} className="flex items-center justify-between py-0.5 text-xs">
              <span className="flex items-center gap-1.5 text-text-secondary">
                <span className="inline-block w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                {s.label}
              </span>
              <span className="font-medium text-text-primary">{Math.round(s.pct * 100)}% ({s.biler})</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
