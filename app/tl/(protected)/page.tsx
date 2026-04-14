// /tl — TL dashboard placeholder.
// Will be replaced with pipeline board + KPI bolks in Phase 1.

export default function TlDashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-text-primary">Pipeline</h2>
        <p className="text-sm text-text-muted mt-1">Kommer snart — deals_current synkroniseres fra HubSpot</p>
      </div>

      {/* Bolk placeholders */}
      {[
        'Bolk 1 — Action insights (live)',
        'Bolk 2 — Output-KPIer',
        'Bolk 3 — Input-KPIer',
        'Bolk 4 — B2B',
        'Bolk 5 — Ettersalg & admin',
      ].map(label => (
        <div
          key={label}
          className="bg-white border border-border rounded-card px-5 py-4 text-sm text-text-muted"
        >
          {label}
        </div>
      ))}
    </div>
  )
}
