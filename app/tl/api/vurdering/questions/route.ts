// GET  /tl/api/vurdering/questions — list all questions + options (all TL roles)
// POST /tl/api/vurdering/questions — create question (superadmin only)

import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import { SESSION_COOKIE_NAME, isTeamleder } from '@/lib/auth'
import { isTlSuperadmin } from '@/lib/tl/superadmin'
import { getRepByKode } from '@/lib/db'

function getAdminClient() {
  const url     = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const service = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_KEY)!
  return createClient(url, service, { auth: { persistSession: false } })
}

async function getAuth() {
  const cookieStore = await cookies()
  const session     = cookieStore.get(SESSION_COOKIE_NAME)?.value
  if (!session) return { ok: false, isSuperadmin: false } as const

  const isSuperSession = session.startsWith('__tl_super__')
  if (isSuperSession) {
    const email      = session.replace('__tl_super__', '')
    const isSuperadmin = isTlSuperadmin(email)
    return { ok: isSuperadmin, isSuperadmin, raterName: email }
  }
  const rep = await getRepByKode(session)
  if (!rep) return { ok: false, isSuperadmin: false } as const
  const isSuperadmin = isTlSuperadmin(rep.email)
  const ok = isSuperadmin || isTeamleder(rep.rolle)
  return { ok, isSuperadmin, raterName: rep.full_name }
}

export interface RatingOption {
  id:         string
  text:       string
  color:      string
  sort_order: number
}

export interface RatingQuestion {
  id:         string
  text:       string
  sort_order: number
  options:    RatingOption[]
}

export async function GET() {
  const auth = await getAuth()
  if (!auth.ok) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = getAdminClient()
  const { data, error } = await supabase
    .from('rating_questions')
    .select('id, text, sort_order, rating_options(id, text, color, sort_order)')
    .order('sort_order', { ascending: true })

  if (error) return Response.json({ error: error.message }, { status: 500 })

  // Normalize nested options
  const questions: RatingQuestion[] = (data ?? []).map((q: any) => ({
    id:         q.id,
    text:       q.text,
    sort_order: q.sort_order,
    options:    (q.rating_options ?? []).sort((a: RatingOption, b: RatingOption) => a.sort_order - b.sort_order),
  }))

  return Response.json(questions)
}

export async function POST(request: Request) {
  const auth = await getAuth()
  if (!auth.ok || !auth.isSuperadmin) return Response.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json() as {
    text: string
    sort_order?: number
    options: { text: string; color: string; sort_order: number }[]
  }
  if (!body.text?.trim()) return Response.json({ error: 'text required' }, { status: 400 })

  const supabase = getAdminClient()

  // Get max sort_order
  const { data: existing } = await supabase
    .from('rating_questions')
    .select('sort_order')
    .order('sort_order', { ascending: false })
    .limit(1)

  const nextOrder = body.sort_order ?? ((existing?.[0]?.sort_order ?? -1) + 1)

  const { data: q, error: qErr } = await supabase
    .from('rating_questions')
    .insert({ text: body.text.trim(), sort_order: nextOrder })
    .select()
    .single()

  if (qErr || !q) return Response.json({ error: qErr?.message ?? 'Insert failed' }, { status: 500 })

  if (body.options?.length > 0) {
    const optRows = body.options.map((o, i) => ({
      question_id: q.id,
      text:        o.text,
      color:       o.color ?? '#E8F5E9',
      sort_order:  o.sort_order ?? i,
    }))
    const { error: oErr } = await supabase.from('rating_options').insert(optRows)
    if (oErr) return Response.json({ error: oErr.message }, { status: 500 })
  }

  return Response.json({ id: q.id }, { status: 201 })
}
