'use client'

import { useState, useEffect } from 'react'
import CollapsibleSection from './CollapsibleSection'
import type { FlaggedDeal } from '@/app/tl/api/pipeline/flagged/route'

const HS_URL = (dealId: string) =>
  `https://app-eu1.hubspot.com/contacts/25445101/record/0-3/${dealId}/`

const REASON_LABEL: Record<FlaggedDeal['reason'], string> = {
  no_owner:       'Ingen deal owner',
  owner_not_rep:  'Feil m Dealowner/avtaleeier',
  owner_mismatch: 'Deal owner ≠ dealeier IK',
}

const REASON_STYLE: Record<FlaggedDeal['reason'], string> = {
  no_owner:       'bg-[#FCEBEB] text-[#A32D2D]',
  owner_not_rep:  'bg-[#FDE8D0] text-[#C2580A]',
  owner_mismatch: 'bg-[#FEF9C3] text-[#854D0E]',
}

const REASON_ROW: Record<FlaggedDeal['reason'], string> = {
  no_owner:       'bg-[#FFF8F8]',
  owner_not_rep:  'bg-[#FFFBF7]',
  owner_mismatch: 'bg-[#FEFCE8]',
}

type SortCol = 'deal_name' | 'stage_name' | 'owner' | 'ik' | 'reason' | 'age'

function dealAgedays(createDate: string | null): number {
  if (!createDate) return 0
  return Math.floor((Date.now() - new Date(createDate).getTime()) / 86_400_000)
}

function sortValue(deal: FlaggedDeal, col: SortCol): string | number {
  switch (col) {
    case 'deal_name':  return deal.deal_name ?? ''
    case 'stage_name': return deal.stage_name ?? ''
    case 'owner':      return deal.owner_name ?? deal.hubspot_owner_id ?? ''
    case 'ik':         return deal.ik_name ?? ''
    case 'reason':     return deal.reason
    case 'age':        return dealAgedays(deal.create_date)
  }
}

interface Props {
  tlFilter?:  string
  teamleders: string[]
  isAdmin:    boolean
}

export default function OpryddingSection({ tlFilter, teamleders, isAdmin }: Props) {
  const [deals,       setDeals]       = useState<FlaggedDeal[] | null>(null)
  const [loading,     setLoading]     = useState(false)
  const [error,       setError]       = useState(false)
  const [ansvarligTl, setAnsvarligTl] = useState<string>('')
  const [savingTl,    setSavingTl]    = useState(false)
  const [sortCol,     setSortCol]     = useState<SortCol>('reason')
  const [sortDir,     setSortDir]     = useState<'asc' | 'desc'>('asc')

  useEffect(() => {
    load()
    fetch('/tl/api/opprydding-settings', { credentials: 'include' })
      .then(r => r.json())
      .then(s => { if (s.ansvarlig_tl !== undefined) setAnsvarligTl(s.ansvarlig_tl ?? '') })
      .catch(() => {})
  }, [])

  async function load() {
    if (deals !== null) return
    setLoading(true)
    setError(false)
    try {
      const params = tlFilter ? `?tl=${encodeURIComponent(tlFilter)}` : ''
      const res  = await fetch(`/tl/api/pipeline/flagged${params}`, { credentials: 'include' })
      const data = await res.json() as FlaggedDeal[] | { error: string }
      if (Array.isArray(data)) setDeals(data)
      else setError(true)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  async function saveAnsvarligTl(value: string) {
    setSavingTl(true)
    try {
      await fetch('/tl/api/opprydding-settings', {
        method:      'POST',
        credentials: 'include',
        headers:     { 'Content-Type': 'application/json' },
        body:        JSON.stringify({ ansvarlig_tl: value || null }),
      })
      setAnsvarligTl(value)
    } finally {
      setSavingTl(false)
    }
  }

  function toggleSort(col: SortCol) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('asc') }
  }

  const sortedDeals = deals ? [...deals].sort((a, b) => {
    const av = sortValue(a, sortCol)
    const bv = sortValue(b, sortCol)
    const cmp = typeof av === 'number' && typeof bv === 'number'
      ? av - bv
      : String(av).localeCompare(String(bv), 'nb')
    return sortDir === 'asc' ? cmp : -cmp
  }) : []

  const counts = deals
    ? {
        no_owner:       deals.filter(d => d.reason === 'no_owner').length,
        owner_not_rep:  deals.filter(d => d.reason === 'owner_not_rep').length,
        owner_mismatch: deals.filter(d => d.reason === 'owner_mismatch').length,
      }
    : null

  function SortTh({ col, children }: { col: SortCol; children: React.ReactNode }) {
    const active = sortCol === col
    return (
      <th
        className="text-left font-medium pb-2 pr-4 cursor-pointer select-none hover:text-text-primary whitespace-nowrap"
        onClick={() => toggleSort(col)}
      >
        <span className="inline-flex items-center gap-1">
          {children}
          <span className={`text-[10px] ${active ? 'opacity-80' : 'opacity-25'}`}>
            {active && sortDir === 'desc' ? '▲' : '▼'}
          </span>
        </span>
      </th>
    )
  }

  return (
    <CollapsibleSection
      defaultOpen={false}
      title={
        <span className="flex items-center gap-2">
          Opprydding
          {counts && deals!.length > 0 && (
            <span className="text-[11px] font-medium bg-[#FCEBEB] text-[#A32D2D] px-2 py-0.5 rounded-full normal-case tracking-normal">
              {deals!.length} deals
            </span>
          )}
        </span>
      }
      onOpen={load}
    >
      <div className="px-4 py-3">

        {/* Pills row + Ansvarlig TL */}
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex gap-2 flex-wrap">
            {counts && (Object.entries(counts) as [FlaggedDeal['reason'], number][]).map(([reason, n]) => n > 0 && (
              <span key={reason} className={`text-[11px] font-medium px-2.5 py-1 rounded-full ${REASON_STYLE[reason]}`}>
                {n} × {REASON_LABEL[reason]}
              </span>
            ))}
          </div>

          {teamleders.length > 0 && (
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs text-text-muted whitespace-nowrap">Ansvarlig TL</span>
              <select
                value={ansvarligTl}
                onChange={e => isAdmin && saveAnsvarligTl(e.target.value)}
                disabled={!isAdmin || savingTl}
                className="text-xs border border-border rounded px-2 py-1 bg-white text-text-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value="">Ikke satt</option>
                {teamleders.map(tl => (
                  <option key={tl} value={tl}>{tl}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {loading && <p className="text-xs text-text-muted py-4 text-center">Laster…</p>}
        {error   && <p className="text-xs text-[#A32D2D] py-4 text-center">Feil ved lasting</p>}

        {deals !== null && deals.length === 0 && (
          <p className="text-xs text-text-muted py-4 text-center">Ingen flaggede deals 🎉</p>
        )}

        {deals !== null && deals.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-border text-text-muted">
                  <SortTh col="deal_name">Deal</SortTh>
                  <SortTh col="stage_name">Steg</SortTh>
                  <SortTh col="age">Alder</SortTh>
                  <SortTh col="owner">Deal owner nå</SortTh>
                  <SortTh col="ik">Dealeier IK</SortTh>
                  <SortTh col="reason">Årsak</SortTh>
                </tr>
              </thead>
              <tbody>
                {sortedDeals.map(deal => {
                  const ageDays = dealAgedays(deal.create_date)
                  return (
                    <tr key={deal.deal_id} className={`border-t border-border/50 ${REASON_ROW[deal.reason]}`}>
                      <td className="py-2 pr-4">
                        <a
                          href={HS_URL(deal.deal_id)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[#185FA5] hover:underline"
                        >
                          {deal.deal_name ?? deal.deal_id}
                        </a>
                      </td>
                      <td className="py-2 pr-4 text-text-muted whitespace-nowrap">{deal.stage_name ?? '—'}</td>
                      <td className="py-2 pr-4 text-text-muted whitespace-nowrap">
                        {deal.create_date ? `${ageDays} d` : '—'}
                      </td>
                      <td className="py-2 pr-4 whitespace-nowrap">
                        {deal.owner_name
                          ? <span className="text-text-primary">{deal.owner_name}</span>
                          : deal.hubspot_owner_id
                            ? <span className="text-text-muted italic">Ikke rep ({deal.hubspot_owner_id})</span>
                            : <span className="text-[#A32D2D]">Ikke satt</span>
                        }
                      </td>
                      <td className="py-2 pr-4 whitespace-nowrap">
                        {deal.ik_name
                          ? <span className="text-text-primary">
                              {deal.ik_name}
                              {deal.ik_kode && <span className="text-text-muted ml-1">({deal.ik_kode})</span>}
                            </span>
                          : <span className="text-text-muted italic">Ukjent</span>
                        }
                      </td>
                      <td className="py-2 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${REASON_STYLE[deal.reason]}`}>
                          {REASON_LABEL[deal.reason]}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </CollapsibleSection>
  )
}
