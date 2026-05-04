// GET /tl/api/pipeline/flagged?tl=<name>
// Returns deals with owner mismatches for the Opprydding section.
// Requires any valid TL session.

import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import { getRepByKode } from '@/lib/db'
import { SESSION_COOKIE_NAME, isTeamleder } from '@/lib/auth'
import { isTlSuperadmin } from '@/lib/tl/superadmin'

export interface FlaggedDeal {
  deal_id:          string
  deal_name:        string | null
  stage_name:       string | null
  owner_name:       string | null  // from hubspot_owner_id → reps (null if not in reps)
  hubspot_owner_id: string | null  // raw HS owner id (set even if owner_name is null)
  ik_name:          string | null  // from referent___owner → reps
  ik_kode:          string | null
  create_date:      string | null
  reason:           'no_owner' | 'owner_not_rep' | 'owner_mismatch'
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
  const tlParam = searchParams.get('tl')
  const tl = (!tlParam || tlParam === '__all__') ? null : tlParam

  const supabase = getAdminClient()

  const { data: settingData } = await supabase
    .from('settings').select('value').eq('key', 'opprydding_ansvarlig_tl').maybeSingle()
  const ansvarligTl = settingData?.value ?? null

  const { data, error } = await supabase
    .rpc('get_flagged_deals', { p_tl: tl, p_ansvarlig_tl: ansvarligTl })

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data ?? [])
}
