// GET  /tl/api/opprydding-settings  — returns { ansvarlig_tl: string | null }
// POST /tl/api/opprydding-settings  — saves { ansvarlig_tl: string | null }, admin only

import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import { getRepByKode } from '@/lib/db'
import { SESSION_COOKIE_NAME, isTeamleder } from '@/lib/auth'
import { isTlSuperadmin } from '@/lib/tl/superadmin'

const SETTING_KEY = 'opprydding_ansvarlig_tl'

function getAdminClient() {
  const url     = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_KEY
  return createClient(url, service!, { auth: { persistSession: false } })
}

async function resolveAuth() {
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

  const isAdmin =
    (isSuperSession && isTlSuperadmin(superEmail)) ||
    !!(rep && isTlSuperadmin(rep.email))

  return { isAdmin }
}

export async function GET() {
  const auth = await resolveAuth()
  if (!auth) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { data } = await getAdminClient()
    .from('settings')
    .select('value')
    .eq('key', SETTING_KEY)
    .maybeSingle()

  return Response.json({ ansvarlig_tl: data?.value ?? null })
}

export async function POST(request: Request) {
  const auth = await resolveAuth()
  if (!auth) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  if (!auth.isAdmin) return Response.json({ error: 'Forbidden' }, { status: 403 })

  const { ansvarlig_tl } = await request.json() as { ansvarlig_tl: string | null }

  const { error } = await getAdminClient()
    .from('settings')
    .upsert({ key: SETTING_KEY, value: ansvarlig_tl ?? null }, { onConflict: 'key' })

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}
