// GET /tl/api/pipeline/flagged?tl=<name>
// Returns deals with owner mismatches for the Opprydding section.
// Requires any valid TL session.

import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import { getRepByKode } from '@/lib/db'
import { SESSION_COOKIE_NAME, isTeamleder } from '@/lib/auth'
import { isTlSuperadmin } from '@/lib/tl/superadmin'

export interface FlaggedDeal {
  deal_id:    string
  deal_name:  string | null
  stage_name: string | null
  owner_name: string | null  // from hubspot_owner_id → reps
  ik_name:    string | null  // from referent___owner → reps
  reason:     'no_owner' | 'owner_not_rep' | 'owner_mismatch'
}

function getAdminClient() {
  const url     = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_KEY
  return createClient(url, service!, { auth: { persistSession: false } })
}

export async function GET(request: Request) {
  const cookieStore    = await cookies()
  const session        = cookieStore.get(SESSION_COOKIE_NAME)?.value
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const isSuperSession = session.startsWith('__tl_super__')
  const superEmail     = isSuperSession ? session.replace('__tl_super__', '') : null
  const rep            = isSuperSession ? null : await getRepByKode(session)

  const allowed =
    (isSuperSession && isTlSuperadmin(superEmail)) ||
    (rep && (isTlSuperadmin(rep.email) || isTeamleder(rep.rolle)))
  if (!allowed) return Response.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const tl = searchParams.get('tl') || null

  const { data, error } = await getAdminClient()
    .rpc('get_flagged_deals', { p_tl: tl })

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data ?? [])
}
