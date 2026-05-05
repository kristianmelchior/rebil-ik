// GET /tl/api/leads?dealowner=<name>&from=<YYYY-MM-DD>&to=<YYYY-MM-DD>
// Returns raw lead rows filtered by dealowner_assigned_to and date range.
// Requires any valid TL session.

import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import { getRepByKode } from '@/lib/db'
import { SESSION_COOKIE_NAME, isTeamleder } from '@/lib/auth'
import { isTlSuperadmin } from '@/lib/tl/superadmin'

export interface LeadDetailRow {
  hs_object_id:          string
  dealeier_ik:           string | null
  rep_name:              string | null
  createdate:            string | null   // 'YYYY-MM-DD'
  teller_lead:           boolean | null
  lost_reason:           string | null
}

export interface LeadsResponse {
  asDealowner: LeadDetailRow[]   // dealowner_assigned_to = name
  asRepName:   LeadDetailRow[]   // rep_name = name AND dealowner_assigned_to ≠ name
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
  const dealowner = searchParams.get('dealowner')
  const from      = searchParams.get('from')
  const to        = searchParams.get('to')

  if (!dealowner || !from || !to) {
    return Response.json({ error: 'Missing params: dealowner, from, to required' }, { status: 400 })
  }

  const supabase = getAdminClient()
  const cols = 'hs_object_id, dealeier_ik, rep_name, createdate, teller_lead, lost_reason'

  const [ownerRes, repRes] = await Promise.all([
    // Table 1: dealeier_ik = selected rep
    supabase
      .from('leads')
      .select(cols)
      .eq('dealeier_ik', dealowner)
      .gte('createdate', from)
      .lte('createdate', to)
      .order('createdate', { ascending: false }),

    // Table 2: rep_name = selected rep AND dealeier_ik ≠ selected rep
    supabase
      .from('leads')
      .select(cols)
      .eq('rep_name', dealowner)
      .neq('dealeier_ik', dealowner)
      .gte('createdate', from)
      .lte('createdate', to)
      .order('createdate', { ascending: false }),
  ])

  if (ownerRes.error) return Response.json({ error: ownerRes.error.message }, { status: 500 })
  if (repRes.error)   return Response.json({ error: repRes.error.message },   { status: 500 })

  const body: LeadsResponse = {
    asDealowner: ownerRes.data ?? [],
    asRepName:   repRes.data   ?? [],
  }
  return Response.json(body)
}
