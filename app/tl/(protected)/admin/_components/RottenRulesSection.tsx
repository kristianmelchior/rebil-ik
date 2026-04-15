'use client'

import { useState, useEffect } from 'react'
import { PIPELINE_CATEGORIES } from '@/lib/tl/pipeline-config'
import type { RottenRule } from '@/lib/tl/admin-db'

type RuleKey = 'create_date' | 'last_activity_at'

interface StageRule {
  key:  RuleKey
  days: number
}

const DEFAULT_RULE: StageRule = { key: 'last_activity_at', days: 30 }

function buildDefaults(): Record<string, StageRule> {
  const out: Record<string, StageRule> = {}
  for (const cat of PIPELINE_CATEGORIES) {
    for (const stage of cat.stages) {
      out[stage.id] = { ...DEFAULT_RULE }
    }
  }
  return out
}

export default function RottenRulesSection() {
  const [rules,   setRules]   = useState<Record<string, StageRule>>(buildDefaults)
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState(false)
  const [saved,   setSaved]   = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  useEffect(() => {
    fetch('/tl/api/admin/rotten-rules', { credentials: 'include' })
      .then(r => r.json())
      .then((data: unknown) => {
        if (Array.isArray(data)) {
          setRules(prev => {
            const next = { ...prev }
            for (const rule of data as RottenRule[]) {
              if (next[rule.stage_id]) {
                next[rule.stage_id] = { key: rule.key, days: rule.days }
              }
            }
            return next
          })
        }
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  function setKey(stageId: string, key: RuleKey) {
    setSaved(false)
    setRules(prev => ({ ...prev, [stageId]: { ...prev[stageId], key } }))
  }

  function setDays(stageId: string, days: number) {
    setSaved(false)
    setRules(prev => ({ ...prev, [stageId]: { ...prev[stageId], days } }))
  }

  async function handleSave() {
    setSaving(true)
    setSaved(false)
    setError(null)

    const payload: RottenRule[] = Object.entries(rules).map(([stage_id, r]) => ({
      stage_id,
      key:  r.key,
      days: r.days,
    }))

    try {
      const res = await fetch('/tl/api/admin/rotten-rules', {
        method:      'PUT',
        headers:     { 'Content-Type': 'application/json' },
        body:        JSON.stringify(payload),
        credentials: 'include',
      })
      if (res.ok) {
        setSaved(true)
      } else {
        const body = await res.json().catch(() => ({}))
        setError((body as { error?: string }).error ?? 'Ukjent feil')
      }
    } catch {
      setError('Nettverksfeil')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-text-primary">Rotten deals</h2>
        <p className="text-sm text-text-muted mt-1">
          Velg hvilken dato og antall arbeidsdager (man–fre) som skal til før en deal markeres som rotten.
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-text-muted">Laster…</p>
      ) : (
        <div className="space-y-4">
          {PIPELINE_CATEGORIES.map(cat => (
            <div key={cat.name} className="bg-white border border-border rounded-card overflow-hidden">
              <div className="px-4 py-2 bg-[#F5F5F5] border-b border-border">
                <span className="text-xs font-semibold text-text-muted uppercase tracking-wide">
                  {cat.name}
                </span>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-4 py-2 text-left font-medium text-text-muted w-1/2">Steg</th>
                    <th className="px-4 py-2 text-left font-medium text-text-muted">Teller fra</th>
                    <th className="px-4 py-2 text-left font-medium text-text-muted w-36">Arbeidsdager</th>
                  </tr>
                </thead>
                <tbody>
                  {cat.stages.map((stage, idx) => {
                    const rule = rules[stage.id] ?? DEFAULT_RULE
                    return (
                      <tr
                        key={stage.id}
                        className={`border-b border-border last:border-0 ${idx % 2 === 0 ? 'bg-white' : 'bg-[#FAFAFA]'}`}
                      >
                        <td className="px-4 py-2.5 text-text-primary">{stage.name}</td>
                        <td className="px-4 py-2.5">
                          <select
                            value={rule.key}
                            onChange={e => setKey(stage.id, e.target.value as RuleKey)}
                            className="text-xs border border-border rounded px-2 py-1 bg-white text-text-primary"
                          >
                            <option value="last_activity_at">Sist aktivitet</option>
                            <option value="create_date">Opprettet</option>
                          </select>
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-1.5">
                            <input
                              type="number"
                              min={1}
                              max={365}
                              value={rule.days}
                              onChange={e => setDays(stage.id, Math.max(1, parseInt(e.target.value, 10) || 1))}
                              className="w-16 text-xs border border-border rounded px-2 py-1 bg-white text-text-primary text-center"
                            />
                            <span className="text-xs text-text-muted">arbeidsdager</span>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ))}

          <div className="flex items-center gap-3">
            <button
              onClick={() => void handleSave()}
              disabled={saving}
              className="px-4 py-2 rounded-pill bg-text-primary text-white text-sm font-medium hover:opacity-80 disabled:opacity-50 transition-opacity"
            >
              {saving ? 'Lagrer…' : 'Lagre'}
            </button>
            {saved  && <span className="text-sm text-[#16a34a]">Lagret</span>}
            {error  && <span className="text-sm text-[#dc2626]">{error}</span>}
          </div>
        </div>
      )}
    </div>
  )
}
