'use client'

import { useState, useEffect } from 'react'
import { TEAMLEDER_ROLES } from '@/lib/auth'
import type { RepAdmin } from '@/lib/tl/admin-db'

const TL_ROLES = TEAMLEDER_ROLES as readonly string[]

export default function TlAdminPage() {
  const [reps,    setReps]    = useState<RepAdmin[]>([])
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState<string | null>(null)  // kode being saved

  useEffect(() => {
    fetch('/tl/api/admin/users', { credentials: 'include' })
      .then(r => r.json())
      .then((data: RepAdmin[]) => { setReps(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  async function toggleTlAccess(rep: RepAdmin) {
    const isTl    = TL_ROLES.includes(rep.rolle)
    const newRole = isTl ? 'Inkjøpskonsulent' : 'Teamleder m leads'

    setSaving(rep.kode)
    const res = await fetch(`/tl/api/admin/users/${rep.kode}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ rolle: newRole }),
      credentials: 'include',
    })
    setSaving(null)

    if (res.ok) {
      setReps(prev => prev.map(r => r.kode === rep.kode ? { ...r, rolle: newRole } : r))
    }
  }

  const tlReps    = reps.filter(r => TL_ROLES.includes(r.rolle))
  const otherReps = reps.filter(r => !TL_ROLES.includes(r.rolle))

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-text-primary">Brukeradministrasjon</h2>
        <p className="text-sm text-text-muted mt-1">Administrer hvem som har tilgang til TL-dashboardet</p>
      </div>

      {loading && <p className="text-sm text-text-muted">Laster…</p>}

      {!loading && (
        <>
          {/* Active TL users */}
          <section>
            <h3 className="text-xs font-medium text-text-muted uppercase tracking-wider mb-3">
              Har TL-tilgang ({tlReps.length})
            </h3>
            <div className="bg-white border border-border rounded-card overflow-hidden">
              {tlReps.length === 0 && (
                <p className="px-4 py-3 text-sm text-text-muted">Ingen</p>
              )}
              {tlReps.map(rep => (
                <RepRow key={rep.kode} rep={rep} saving={saving} onToggle={toggleTlAccess} />
              ))}
            </div>
          </section>

          {/* Other users */}
          <section>
            <h3 className="text-xs font-medium text-text-muted uppercase tracking-wider mb-3">
              Ingen TL-tilgang ({otherReps.length})
            </h3>
            <div className="bg-white border border-border rounded-card overflow-hidden">
              {otherReps.map(rep => (
                <RepRow key={rep.kode} rep={rep} saving={saving} onToggle={toggleTlAccess} />
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  )
}

function RepRow({
  rep,
  saving,
  onToggle,
}: {
  rep: RepAdmin
  saving: string | null
  onToggle: (rep: RepAdmin) => void
}) {
  const isTl     = TL_ROLES.includes(rep.rolle)
  const isSaving = saving === rep.kode

  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-border last:border-0">
      <div>
        <p className="text-sm font-medium text-text-primary">{rep.full_name}</p>
        <p className="text-xs text-text-muted">{rep.email} · {rep.rolle}</p>
      </div>
      <button
        onClick={() => onToggle(rep)}
        disabled={isSaving}
        className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors disabled:opacity-50 ${
          isTl
            ? 'border-border text-text-secondary hover:border-[#dc2626] hover:text-[#dc2626]'
            : 'border-border text-text-secondary hover:border-[#16a34a] hover:text-[#16a34a]'
        }`}
      >
        {isSaving ? '…' : isTl ? 'Fjern tilgang' : 'Gi tilgang'}
      </button>
    </div>
  )
}
