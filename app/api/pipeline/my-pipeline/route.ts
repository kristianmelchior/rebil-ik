// GET /api/pipeline/my-pipeline
// Returns pipeline summary + rotten deals for the logged-in rep (IK session).
// Reuses the same get_pipeline_with_rotten + get_rotten_sample RPCs as TL dash,
// but filters automatically to the session rep — no TL session required.

import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import { getRepByKode } from '@/lib/db'
import { SESSION_COOKIE_NAME, ADMIN_SESSION_COOKIE_NAME, ADMIN_VIEW_KODE_COOKIE_NAME } from '@/lib/auth'
import { PIPELINE_CATEGORIES, ALL_STAGES } from '@/lib/tl/pipeline-config'

interface PipelineCount {
  owner_name:   string
  stage_id:     string
  deal_count:   number
  rotten_count: number
}

const STAGE_CATEGORY = new Map(
  PIPELINE_CATEGORIES.flatMap(cat => cat.stages.map(s => [s.id, cat.name]))
)
const STAGE_NAME = new Map(ALL_STAGES.map(s => [s.id, s.name]))

function getAdminClient() {
  const url     = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_KEY
  if (!service) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY env var')
  return createClient(url, service!, { auth: { persistSession: false } })
}

export async function GET() {
  const cookieStore   = await cookies()
  const isAdmin       = cookieStore.get(ADMIN_SESSION_COOKIE_NAME)?.value === '1'
  const adminViewKode = cookieStore.get(ADMIN_VIEW_KODE_COOKIE_NAME)?.value
  const session       = cookieStore.get(SESSION_COOKIE_NAME)?.value

  const kode = isAdmin ? adminViewKode : session
  if (!kode) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const rep = await getRepByKode(kode)
  if (!rep) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const supabase = getAdminClient()

    const [{ data: pipelineData, error }, { data: rottenData, error: rottenError }] =
      await Promise.all([
        supabase.rpc('get_pipeline_with_rotten'),
        supabase.rpc('get_rotten_sample', { p_owner_name: rep.full_name, p_limit: 50 }),
      ])

    if (error)       return Response.json({ error: error.message }, { status: 500 })
    if (rottenError) return Response.json({ error: rottenError.message }, { status: 500 })

    // Filter pipeline to just this rep
    const counts = ((pipelineData ?? []) as PipelineCount[])
      .filter(r => r.owner_name === rep.full_name)

    // Build category summary
    const stageCount  = new Map<string, number>()
    const stageRotten = new Map<string, number>()
    for (const row of counts) {
      stageCount.set(row.stage_id,  (stageCount.get(row.stage_id)  ?? 0) + row.deal_count)
      stageRotten.set(row.stage_id, (stageRotten.get(row.stage_id) ?? 0) + row.rotten_count)
    }

    const categories = PIPELINE_CATEGORIES.map(cat => ({
      name:        cat.name,
      count:       cat.stages.reduce((s, st) => s + (stageCount.get(st.id)  ?? 0), 0),
      rottenCount: cat.stages.reduce((s, st) => s + (stageRotten.get(st.id) ?? 0), 0),
    }))

    const totalDeals  = categories.reduce((s, c) => s + c.count, 0)
    const totalRotten = categories.reduce((s, c) => s + c.rottenCount, 0)

    // Rotten deals with category
    const rottenDeals = (rottenData ?? []).map((d: {
      deal_id: string; deal_name: string | null; stage_name: string | null
      ref_date: string; days_since: number; create_date: string | null
      last_activity_at: string | null; next_activity_date: string | null
    }) => ({
      ...d,
      hubspot_url: `https://app-eu1.hubspot.com/contacts/25445101/record/0-3/${d.deal_id}/`,
    }))

    return Response.json(
      { categories, totalDeals, totalRotten, rottenDeals, repName: rep.full_name },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[/api/pipeline/my-pipeline] error:', err)
    return Response.json({ error: msg }, { status: 500 })
  }
}
