'use client'

import { useState } from 'react'
import CollapsibleSection from './CollapsibleSection'
import type { FlaggedDeal } from '@/app/tl/api/pipeline/flagged/route'

const HS_URL = (dealId: string) =>
  `https://app-eu1.hubspot.com/contacts/25445101/record/0-3/${dealId}/`

const REASON_LABEL: Record<FlaggedDeal['reason'], string> = {
  no_owner:       'Ingen deal owner',
  owner_not_rep:  'Deal owner er ikke en aktiv rep',
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

interface Props {
  tlFilter?: string
}

export default function OpryddingSection({ tlFilter }: Props) {
  const [deals,   setDeals]   = useState<FlaggedDeal[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState(false)

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

  const counts = deals
    ? {
        no_owner:       deals.filter(d => d.reason === 'no_owner').length,
        owner_not_rep:  deals.filter(d => d.reason === 'owner_not_rep').length,
        owner_mismatch: deals.filter(d => d.reason === 'owner_mismatch').length,
      }
    : null

  return (
    <CollapsibleSection
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

        {/* Summary pills */}
        {counts && (
          <div className="flex gap-2 mb-4 flex-wrap">
            {(Object.entries(counts) as [FlaggedDeal['reason'], number][]).map(([reason, n]) => n > 0 && (
              <span key={reason} className={`text-[11px] font-medium px-2.5 py-1 rounded-full ${REASON_STYLE[reason]}`}>
                {n} × {REASON_LABEL[reason]}
              </span>
            ))}
          </div>
        )}

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
                  <th className="text-left font-medium pb-2 pr-4">Deal</th>
                  <th className="text-left font-medium pb-2 pr-4">Steg</th>
                  <th className="text-left font-medium pb-2 pr-4">Deal owner nå</th>
                  <th className="text-left font-medium pb-2 pr-4">Dealeier IK</th>
                  <th className="text-left font-medium pb-2">Årsak</th>
                </tr>
              </thead>
              <tbody>
                {deals.map(deal => (
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
                    <td className="py-2 pr-4 whitespace-nowrap">
                      {deal.owner_name
                        ? <span className="text-text-primary">{deal.owner_name}</span>
                        : <span className="text-[#A32D2D]">Ikke satt</span>
                      }
                    </td>
                    <td className="py-2 pr-4 whitespace-nowrap">
                      {deal.ik_name
                        ? <span className="text-text-primary">{deal.ik_name}</span>
                        : <span className="text-text-muted italic">Ukjent</span>
                      }
                    </td>
                    <td className="py-2 whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${REASON_STYLE[deal.reason]}`}>
                        {REASON_LABEL[deal.reason]}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </CollapsibleSection>
  )
}
