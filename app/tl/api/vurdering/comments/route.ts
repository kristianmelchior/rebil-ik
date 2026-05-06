// GET  /tl/api/vurdering/comments?week=YYYY-Www[&tl=name] — fetch comments
// POST /tl/api/vurdering/comments — upsert a comment (TL for own team)

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

export interface CommentRow {
  kode:       string
  week:       string
  rater_name: string
  comment:    string
}

export async function GET(request: Request) {
  const auth = await getAuth()
  if (!auth) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const week = searchParams.get('week') ?? currentIsoWeek()
  const tl   = searchParams.get('tl')

  const supabase = getAdminClient()

  let query = supabase
    .from('rating_comments')
    .select('kode, week, rater_name, comment')
    .eq('week', week)
    .neq('comment', '')

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

  const body = await request.json() as { kode: string; comment: string }
  if (!body.kode) return Response.json({ error: 'kode required' }, { status: 400 })

  const week    = currentIsoWeek()
  const comment = (body.comment ?? '').trim()

  const supabase = getAdminClient()

  if (comment === '') {
    // Delete the row if comment is cleared
    await supabase
      .from('rating_comments')
      .delete()
      .eq('week', week)
      .eq('kode', body.kode)
    return Response.json({ ok: true, week })
  }

  const { error } = await supabase
    .from('rating_comments')
    .upsert(
      { week, rater_name: auth.raterName, kode: body.kode, comment, updated_at: new Date().toISOString() },
      { onConflict: 'week,kode' },
    )

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true, week })
}
