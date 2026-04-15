'use client'

import { useState, useEffect } from 'react'
import { TEAMLEDER_ROLES } from '@/lib/auth'
import type { RepAdmin } from '@/lib/tl/admin-db'
import RottenRulesSection from './_components/RottenRulesSection'

const TL_ROLES = TEAMLEDER_ROLES as readonly string[]

export default function TlAdminPage() {
  const [reps,    setReps]    = useState<RepAdmin[]>([])
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState<string | null>(null)

  useEffect(() => {
    fetch('/tl/api/admin/users', { credentials: 'include' })
      .then(r => r.json())
      .then((data: unknown) => {
        if (Array.isArray(data)) setReps(data as RepAdmin[])
        else console.error('Unexpected API response:', data)
        setLoading(false)
      })
      .catch((e) => { console.error(e); setLoading(false) })
  }, [])

  async function setRole(rep: RepAdmin, rolle: string) {
    setSaving(rep.kode)
    const res = await fetch(`/tl/api/admin/users/${rep.kode}`, {
      method:      'PATCH',
      headers:     { 'Content-Type': 'application/json' },
      body:        JSON.stringify({ rolle }),
      credentials: 'include',
    })
    setSaving(null)
    if (res.ok) {
      setReps(prev => prev.map(r => r.kode === rep.kode ? { ...r, rolle } : r))
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-text-primary">Brukeradministrasjon</h2>
        <p className="text-sm text-text-muted mt-1">Administrer TL-tilgang for alle konsulenter</p>
      </div>

      {loading && <p className="text-sm text-text-muted">Laster…</p>}

      {!loading && (
        <div className="bg-white border border-border rounded-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-[#F5F5F5]">
                <th className="px-4 py-3 text-left font-medium text-text-muted">Navn</th>
                <th className="px-4 py-3 text-left font-medium text-text-muted">E-post</th>
                <th className="px-4 py-3 text-left font-medium text-text-muted">Teamleder</th>
                <th className="px-4 py-3 text-left font-medium text-text-muted">TL-tilgang</th>
              </tr>
            </thead>
            <tbody>
              {reps.map(rep => {
                const hasTl    = TL_ROLES.includes(rep.rolle)
                const isSaving = saving === rep.kode
                return (
                  <tr key={rep.kode} className="border-b border-border last:border-0 hover:bg-[#FAFAFA]">
                    <td className="px-4 py-3 font-medium text-text-primary">{rep.full_name}</td>
                    <td className="px-4 py-3 text-text-muted">{rep.email ?? '—'}</td>
                    <td className="px-4 py-3 text-text-muted">{rep.teamleder ?? '—'}</td>
                    <td className="px-4 py-3">
                      {hasTl ? (
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-[#16a34a] bg-[#f0fdf4] border border-[#bbf7d0] px-2 py-0.5 rounded-full">
                            {rep.rolle}
                          </span>
                          <button
                            onClick={() => setRole(rep, 'Inkjøpskonsulent')}
                            disabled={isSaving}
                            className="text-xs text-text-muted hover:text-[#dc2626] disabled:opacity-50 transition-colors"
                          >
                            {isSaving ? '…' : 'Fjern'}
                          </button>
                        </div>
                      ) : (
                        <select
                          disabled={isSaving}
                          defaultValue=""
                          onChange={e => { if (e.target.value) setRole(rep, e.target.value) }}
                          className="text-xs border border-border rounded px-2 py-1 text-text-muted bg-white disabled:opacity-50"
                        >
                          <option value="" disabled>Gi tilgang…</option>
                          {TL_ROLES.map(r => (
                            <option key={r} value={r}>{r}</option>
                          ))}
                        </select>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="border-t border-border pt-8">
        <RottenRulesSection />
      </div>
    </div>
  )
}
