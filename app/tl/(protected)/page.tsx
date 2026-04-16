import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import { getAllRepsAdmin } from '@/lib/tl/admin-db'
import { PIPELINE_CATEGORIES, ALL_STAGES } from '@/lib/tl/pipeline-config'
import PipelineOverview, { type CategoryData, type RepDeepDive } from './_components/PipelineOverview'
import { getRepByKode } from '@/lib/db'
import { SESSION_COOKIE_NAME } from '@/lib/auth'
import { isTlSuperadmin } from '@/lib/tl/superadmin'

interface PipelineCount {
  owner_name:   string
  stage_id:     string
  deal_count:   number
  rotten_count: number
}

const CATEGORY_COLORS: Record<string, string> = {
  'NYE LEADS':                '#378ADD',
  'KF1':                      '#60A5FA',
  'TIL PLATTFORM':            '#EF9F27',
  'CLOSING':                  '#F5B84E',
  'VERIFIKASJON/SLUTTFØRING': '#639922',
  'KF2':                      '#90C4EE',
  'INNBYTTE':                 '#6BB3E8',
}

function getAdminClient() {
  const url     = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_KEY
  if (!service) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY env var')
  return createClient(url, service, { auth: { persistSession: false } })
}

async function getData(tlFilter?: string) {
  const supabase = getAdminClient()
  const [{ data, error }, reps, { data: syncData }] = await Promise.all([
    supabase.rpc('get_pipeline_with_rotten'),
    getAllRepsAdmin(),
    supabase.from('deals_current').select('last_modified_at').order('last_modified_at', { ascending: false }).limit(1),
  ])
  if (error) {
    const msg = (error as { message?: string }).message ?? JSON.stringify(error)
    throw new Error(`RPC get_pipeline_with_rotten failed: ${msg}`)
  }

  const repTl = new Map<string, string>()
  for (const r of reps) {
    if (r.full_name && r.teamleder) repTl.set(r.full_name, r.teamleder)
  }

  let counts = (data ?? []) as PipelineCount[]
  if (tlFilter) counts = counts.filter(c => repTl.get(c.owner_name) === tlFilter)

  const lastSyncedAt = syncData?.[0]?.last_modified_at
    ? new Date(syncData[0].last_modified_at)
    : null

  return { counts, lastSyncedAt }
}

// Stage id → name lookup
const STAGE_NAME = new Map(ALL_STAGES.map(s => [s.id, s.name]))
// Stage id → category name lookup
const STAGE_CATEGORY = new Map(
  PIPELINE_CATEGORIES.flatMap(cat => cat.stages.map(s => [s.id, cat.name]))
)

export default async function TlDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ tl?: string }>
}) {
  const { tl } = await searchParams

  // Non-admin teamleders default to filtering by their own name
  let effectiveTl = tl
  if (!effectiveTl) {
    const cookieStore = await cookies()
    const session = cookieStore.get(SESSION_COOKIE_NAME)?.value ?? ''
    if (!session.startsWith('__tl_super__')) {
      const rep = await getRepByKode(session)
      if (rep && !isTlSuperadmin(rep.email)) {
        effectiveTl = rep.full_name ?? undefined
      }
    }
  }

  const { counts, lastSyncedAt } = await getData(effectiveTl)

  // ── Build maps ─────────────────────────────────────────────────────────────

  // owner → stageId → {count, rottenCount}
  const ownerStageMap = new Map<string, Map<string, { count: number; rotten: number }>>()
  const stageCount    = new Map<string, number>()
  const stageRotten   = new Map<string, number>()

  for (const row of counts) {
    const { owner_name: o, stage_id: s, deal_count: c, rotten_count: r } = row
    if (!ownerStageMap.has(o)) ownerStageMap.set(o, new Map())
    ownerStageMap.get(o)!.set(s, { count: c, rotten: r })
    stageCount.set(s,  (stageCount.get(s)  ?? 0) + c)
    stageRotten.set(s, (stageRotten.get(s) ?? 0) + r)
  }

  const ownerTotal = new Map<string, number>()
  for (const [owner, stages] of ownerStageMap) {
    ownerTotal.set(owner, [...stages.values()].reduce((s, v) => s + v.count, 0))
  }

  const total = [...ownerTotal.values()].reduce((s, n) => s + n, 0)

  const owners = [...ownerTotal.entries()]
    .sort((a, b) => {
      if (a[0] === 'other') return 1
      if (b[0] === 'other') return -1
      return b[1] - a[1]
    })
    .map(([owner]) => owner)

  // ── Category totals for pipeline chart ─────────────────────────────────────

  const categoryTotals: CategoryData[] = PIPELINE_CATEGORIES.map(cat => ({
    name:        cat.name,
    count:       cat.stages.reduce((s, st) => s + (stageCount.get(st.id)  ?? 0), 0),
    rottenCount: cat.stages.reduce((s, st) => s + (stageRotten.get(st.id) ?? 0), 0),
    color:       CATEGORY_COLORS[cat.name] ?? '#378ADD',
  }))

  // ── Rep deepdive rows ───────────────────────────────────────────────────────

  const repRows: RepDeepDive[] = owners
    .filter(o => o !== 'other')
    .map(owner => {
      const stageData = ownerStageMap.get(owner) ?? new Map()
      return {
        name: owner,
        categories: PIPELINE_CATEGORIES.map(cat => ({
          count:       cat.stages.reduce((s, st) => s + (stageData.get(st.id)?.count  ?? 0), 0),
          rottenCount: cat.stages.reduce((s, st) => s + (stageData.get(st.id)?.rotten ?? 0), 0),
          stages: cat.stages
            .map(st => ({
              stageName:   STAGE_NAME.get(st.id) ?? st.id,
              count:       stageData.get(st.id)?.count  ?? 0,
              rottenCount: stageData.get(st.id)?.rotten ?? 0,
            }))
            .filter(s => s.count > 0),
        })),
      }
    })

  // ── Pipeline table maps (for the bottom table) ─────────────────────────────

  const ownerStageCount = new Map<string, Map<string, number>>()
  for (const [owner, stages] of ownerStageMap) {
    const m = new Map<string, number>()
    for (const [sid, v] of stages) m.set(sid, v.count)
    ownerStageCount.set(owner, m)
  }

  return (
    <div className="space-y-4">

      {/* ── Overview sections ─────────────────────────────────────────────── */}
      <PipelineOverview
        total={total}
        categories={categoryTotals}
        reps={repRows}
        lastSyncedAt={lastSyncedAt}
      />

      {/* ── Pipeline table ────────────────────────────────────────────────── */}
      <div className="pt-2">
        <div className="overflow-x-auto rounded-card border border-border">
          <table className="text-xs border-collapse" style={{ minWidth: 'max-content' }}>
            <thead>
              <tr className="bg-[#F5F5F5]">
                <th className="sticky left-0 z-10 bg-[#F5F5F5] border-b border-r border-border px-3 py-2 text-left font-semibold text-text-primary min-w-[160px]">
                  Konsulent
                </th>
                <th className="border-b border-r border-border px-3 py-2 text-center font-semibold text-text-primary min-w-[52px]">
                  Total
                </th>
                {PIPELINE_CATEGORIES.map(cat => (
                  <th
                    key={cat.name}
                    colSpan={cat.stages.length}
                    className="border-b border-r border-border px-3 py-2 text-center font-semibold text-text-primary uppercase tracking-wide"
                  >
                    {cat.name}
                  </th>
                ))}
              </tr>
              <tr className="bg-white">
                <th className="sticky left-0 z-10 bg-white border-b border-r border-border px-3 py-2" />
                <th className="border-b border-r border-border px-3 py-2" />
                {ALL_STAGES.map(stage => (
                  <th
                    key={stage.id}
                    className="border-b border-r border-border px-2 py-2 text-center font-medium text-text-muted whitespace-nowrap min-w-[80px]"
                  >
                    {stage.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {owners.map((owner, idx) => {
                const stageCounts = ownerStageCount.get(owner)!
                const ownerTot    = ownerTotal.get(owner)!
                return (
                  <tr key={owner} className={idx % 2 === 0 ? 'bg-white' : 'bg-[#FAFAFA]'}>
                    <td className={`sticky left-0 z-10 border-b border-r border-border px-3 py-2 font-medium text-text-primary ${idx % 2 === 0 ? 'bg-white' : 'bg-[#FAFAFA]'}`}>
                      {owner}
                    </td>
                    <td className="border-b border-r border-border px-3 py-2 text-center font-semibold text-text-primary">
                      {ownerTot}
                    </td>
                    {ALL_STAGES.map(stage => {
                      const count = stageCounts.get(stage.id) ?? 0
                      return (
                        <td key={stage.id} className="border-b border-r border-border px-2 py-2 text-center text-text-muted">
                          {count > 0 ? count : ''}
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
              <tr className="bg-[#F5F5F5] font-semibold border-t-2 border-border">
                <td className="sticky left-0 z-10 bg-[#F5F5F5] border-r border-border px-3 py-2 text-text-primary">Total</td>
                <td className="border-r border-border px-3 py-2 text-center text-text-primary">{total}</td>
                {ALL_STAGES.map(stage => {
                  const count = stageCount.get(stage.id) ?? 0
                  return (
                    <td key={stage.id} className="border-r border-border px-2 py-2 text-center text-text-primary">
                      {count > 0 ? count : ''}
                    </td>
                  )
                })}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

    </div>
  )
}
