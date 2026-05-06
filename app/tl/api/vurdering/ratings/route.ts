// GET  /tl/api/vurdering/ratings?week=YYYY-Www[&tl=name] — fetch ratings
// POST /tl/api/vurdering/ratings — upsert a rating (TL for own team)

import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import { SESSION_COOKIE_NAME, isTeamleder } from '@/lib/auth'
import { isTlSuperadmin } from '@/lib/tl/superadmin'
import { getRepByKode } from '@/lib/db'
import { currentIsoWeek } from '@/lib/tl/week'

function getAdminClient() {
  const url     = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const service = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_KEY)!
  return createClient(url, service, { auth: { persistSession: false } })
}

async function getAuth() {
  const cookieStore = await cookies()
  const session     = cookieStore.get(SESSION_COOKIE_NAME)?.value
  if (!session) return null

  if (session.startsWith('__tl_super__')) {
    const email = session.replace('__tl_super__', '')
    if (!isTlSuperadmin(email)) return null
    return { raterName: email, isSuperadmin: true, teamleder: null as string | null }
  }
  const rep = await getRepByKode(session)
  if (!rep) return null
  const isSuperadmin = isTlSuperadmin(rep.email)
  if (!isSuperadmin && !isTeamleder(rep.rolle)) return null
  return { raterName: rep.full_name, isSuperadmin, teamleder: rep.full_name }
}

export interface RatingRow {
  kode:        string
  question_id: string
  option_id:   string
  rater_name:  string
  week:        string
}

export async function GET(request: Request) {
  const auth = await getAuth()
  if (!auth) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const week = searchParams.get('week') ?? currentIsoWeek()
  const tl   = searchParams.get('tl')  // optional filter by teamleder name

  const supabase = getAdminClient()

  let query = supabase
    .from('ratings')
    .select('kode, question_id, option_id, rater_name, week')
    .eq('week', week)

  // Non-superadmins can only see their own team's ratings
  if (!auth.isSuperadmin && auth.teamleder) {
    query = query.eq('rater_name', auth.teamleder)
  } else if (tl) {
    query = query.eq('rater_name', tl)
  }

  const { data, error } = await query
  if (error) return Response.json({ error: error.message }, { status: 500 })

  return Response.json(data ?? [])
}

export async function POST(request: Request) {
  const auth = await getAuth()
  if (!auth) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json() as {
    week?:       string
    kode:        string
    question_id: string
    option_id:   string
  }

  if (!body.kode || !body.question_id || !body.option_id) {
    return Response.json({ error: 'kode, question_id, option_id required' }, { status: 400 })
  }

  // Always rate the current week — don't allow back-dating via API
  const week = currentIsoWeek()

  const supabase = getAdminClient()

  const { error } = await supabase
    .from('ratings')
    .upsert(
      {
        week,
        rater_name:  auth.raterName,
        kode:        body.kode,
        question_id: body.question_id,
        option_id:   body.option_id,
      },
      { onConflict: 'week,kode,question_id' },
    )

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true, week })
}
