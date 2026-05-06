// GET /api/vurdering-preview
// Returns this week's TL rating for the logged-in rep.
// TEMPORARILY restricted to Benjamin Parr only (test phase).

import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import { SESSION_COOKIE_NAME, ADMIN_SESSION_COOKIE_NAME } from '@/lib/auth'
import { getRepByKode } from '@/lib/db'
import { currentIsoWeek } from '@/lib/tl/week'

// ── Hardcoded test gate ───────────────────────────────────────────────────────
const TEST_NAME = 'Benjamin Parr'

function getAdminClient() {
  const url     = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const service = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_KEY)!
  return createClient(url, service, { auth: { persistSession: false } })
}

export interface PreviewOption {
  text:  string
  color: string
}

export interface PreviewQuestion {
  text:           string
  selectedOption: PreviewOption | null
}

export interface VurderingPreview {
  week:      string
  raterName: string
  questions: PreviewQuestion[]
  comment:   string | null
}

export async function GET(request: Request) {
  const cookieStore = await cookies()
  const isAdminSession = cookieStore.get(ADMIN_SESSION_COOKIE_NAME)?.value === '1'

  const sessionKode = cookieStore.get(SESSION_COOKIE_NAME)?.value
  if (!sessionKode) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const queryKode = searchParams.get('kode')

  // Admins can preview any rep by passing ?kode=xxx
  // Regular reps can only fetch their own data
  const kode = isAdminSession && queryKode ? queryKode : sessionKode

  const rep = await getRepByKode(kode)
  if (!rep) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  // ── TEST GATE: only Benjamin Parr (unless admin previewing) ────────────────
  if (!isAdminSession && rep.full_name !== TEST_NAME) {
    return Response.json({ error: 'Not available' }, { status: 403 })
  }
  // ──────────────────────────────────────────────────────────────────────────

  const week     = currentIsoWeek()
  const supabase = getAdminClient()

  // Fetch questions + options
  const { data: questions, error: qErr } = await supabase
    .from('rating_questions')
    .select('id, text, sort_order, rating_options(id, text, color, sort_order)')
    .order('sort_order', { ascending: true })

  if (qErr) return Response.json({ error: qErr.message }, { status: 500 })

  // Fetch this week's ratings for this rep
  const { data: ratings, error: rErr } = await supabase
    .from('ratings')
    .select('question_id, option_id, rater_name')
    .eq('week', week)
    .eq('kode', kode)

  if (rErr) return Response.json({ error: rErr.message }, { status: 500 })

  // Fetch comment
  const { data: commentRows } = await supabase
    .from('rating_comments')
    .select('comment, rater_name')
    .eq('week', week)
    .eq('kode', kode)
    .limit(1)

  if (!ratings || ratings.length === 0) {
    // No ratings yet this week
    return Response.json(null)
  }

  // Build option map per question
  const ratingMap = new Map<string, string>() // question_id → option_id
  let raterName = ''
  for (const r of ratings) {
    ratingMap.set(r.question_id, r.option_id)
    if (!raterName) raterName = r.rater_name
  }

  const previewQuestions: PreviewQuestion[] = (questions ?? []).map((q: any) => {
    const selectedOptionId = ratingMap.get(q.id)
    const opts: { id: string; text: string; color: string; sort_order: number }[] =
      (q.rating_options ?? []).sort((a: any, b: any) => a.sort_order - b.sort_order)
    const selected = selectedOptionId ? opts.find(o => o.id === selectedOptionId) : undefined

    return {
      text:           q.text,
      selectedOption: selected ? { text: selected.text, color: selected.color } : null,
    }
  })

  const result: VurderingPreview = {
    week,
    raterName,
    questions: previewQuestions,
    comment:   commentRows?.[0]?.comment ?? null,
  }

  return Response.json(result)
}
