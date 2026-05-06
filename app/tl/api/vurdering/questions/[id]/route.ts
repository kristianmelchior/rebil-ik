// PUT    /tl/api/vurdering/questions/[id] — update question + options (superadmin)
// DELETE /tl/api/vurdering/questions/[id] — delete question (superadmin)

import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import { SESSION_COOKIE_NAME } from '@/lib/auth'
import { isTlSuperadmin } from '@/lib/tl/superadmin'
import { getRepByKode } from '@/lib/db'

function getAdminClient() {
  const url     = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const service = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_KEY)!
  return createClient(url, service, { auth: { persistSession: false } })
}

async function requireSuperadmin(): Promise<boolean> {
  const cookieStore = await cookies()
  const session     = cookieStore.get(SESSION_COOKIE_NAME)?.value
  if (!session) return false

  if (session.startsWith('__tl_super__')) {
    return isTlSuperadmin(session.replace('__tl_super__', ''))
  }
  const rep = await getRepByKode(session)
  return !!rep && isTlSuperadmin(rep.email)
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!await requireSuperadmin()) return Response.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const body = await request.json() as {
    text?:       string
    sort_order?: number
    options?: { id?: string; text: string; color: string; sort_order: number }[]
  }

  const supabase = getAdminClient()

  // Update question text / sort_order
  const updates: Record<string, unknown> = {}
  if (body.text !== undefined)       updates.text       = body.text.trim()
  if (body.sort_order !== undefined) updates.sort_order = body.sort_order

  if (Object.keys(updates).length > 0) {
    const { error } = await supabase.from('rating_questions').update(updates).eq('id', id)
    if (error) return Response.json({ error: error.message }, { status: 500 })
  }

  // Replace options if provided
  if (body.options !== undefined) {
    // Options WITH an id are existing (kept); options WITHOUT an id are new.
    const keptIds = body.options.map(o => o.id).filter(Boolean) as string[]

    // Fetch all current option IDs for this question, then delete only the
    // ones no longer in the incoming list. Using .in() is reliable; the
    // alternative .not('id','in','(uuid,...)')  is not for UUID arrays in
    // Supabase JS v2.
    const { data: currentOpts } = await supabase
      .from('rating_options')
      .select('id')
      .eq('question_id', id)

    const allCurrentIds = (currentOpts ?? []).map((r: { id: string }) => r.id)
    const toDelete = allCurrentIds.filter(oid => !keptIds.includes(oid))

    if (toDelete.length > 0) {
      const { error: delErr } = await supabase
        .from('rating_options')
        .delete()
        .in('id', toDelete)
      if (delErr) return Response.json({ error: delErr.message }, { status: 500 })
    }

    if (body.options.length > 0) {
      // Upsert: existing options keep their id (preserves ratings links),
      // new options (no id) get a fresh UUID from the database default.
      const rows = body.options.map((o, i) => ({
        ...(o.id ? { id: o.id } : {}),
        question_id: id,
        text:        o.text,
        color:       o.color ?? '#E8F5E9',
        sort_order:  o.sort_order ?? i,
      }))
      const { error } = await supabase
        .from('rating_options')
        .upsert(rows, { onConflict: 'id' })
      if (error) return Response.json({ error: error.message }, { status: 500 })
    }
  }

  return Response.json({ ok: true })
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!await requireSuperadmin()) return Response.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const supabase = getAdminClient()

  // Options cascade-delete via FK, ratings on question_id also cascade
  const { error } = await supabase.from('rating_questions').delete().eq('id', id)
  if (error) return Response.json({ error: error.message }, { status: 500 })

  return Response.json({ ok: true })
}
