// GET  /tl/api/pipeline/review        — all reviews
// POST /tl/api/pipeline/review        — upsert review { deal_id, snooze_days }
// DELETE /tl/api/pipeline/review      — remove review { deal_id }
// Requires any valid TL session.

import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import { getRepByKode } from '@/lib/db'
import { SESSION_COOKIE_NAME, isTeamleder } from '@/lib/auth'
import { isTlSuperadmin } from '@/lib/tl/superadmin'

export interface ReviewRow {
  deal_id:     string
  reviewed_by: string
  reviewed_at: string
  snooze_days: number
}

function getAdminClient() {
  const url     = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_KEY
  return createClient(url, service!, { auth: { persistSession: false } })
}

async function resolveReviewer(): Promise<string | null> {
  const cookieStore    = await cookies()
  const session        = cookieStore.get(SESSION_COOKIE_NAME)?.value
  if (!session) return null

  const isSuperSession = session.startsWith('__tl_super__')
  const superEmail     = isSuperSession ? session.replace('__tl_super__', '') : null
  const rep            = isSuperSession ? null : await getRepByKode(session)

  const allowed =
    (isSuperSession && isTlSuperadmin(superEmail)) ||
    (rep && (isTlSuperadmin(rep.email) || isTeamleder(rep.rolle)))
  if (!allowed) return null

  return rep?.full_name ?? superEmail ?? 'Ukjent'
}

export async function GET() {
  const reviewer = await resolveReviewer()
  if (!reviewer) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await getAdminClient()
    .from('deal_reviews')
    .select('deal_id, reviewed_by, reviewed_at, snooze_days')

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data ?? [])
}

export async function POST(req: Request) {
  const reviewer = await resolveReviewer()
  if (!reviewer) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json() as { deal_id?: string; snooze_days?: number }
  const { deal_id, snooze_days = 2 } = body
  if (!deal_id) return Response.json({ error: 'deal_id required' }, { status: 400 })

  const { error } = await getAdminClient()
    .from('deal_reviews')
    .upsert({ deal_id, reviewed_by: reviewer, reviewed_at: new Date().toISOString(), snooze_days }, { onConflict: 'deal_id' })

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}

export async function DELETE(req: Request) {
  const reviewer = await resolveReviewer()
  if (!reviewer) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json() as { deal_id?: string }
  const { deal_id } = body
  if (!deal_id) return Response.json({ error: 'deal_id required' }, { status: 400 })

  const { error } = await getAdminClient()
    .from('deal_reviews')
    .delete()
    .eq('deal_id', deal_id)

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}
