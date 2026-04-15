// GET  /tl/api/admin/rotten-rules — fetch all rotten-deal rules
// PUT  /tl/api/admin/rotten-rules — replace all rotten-deal rules
// Both require superadmin session.

import { cookies } from 'next/headers'
import { getRepByKode } from '@/lib/db'
import { SESSION_COOKIE_NAME } from '@/lib/auth'
import { getRottenRules, upsertRottenRules } from '@/lib/tl/admin-db'
import type { RottenRule } from '@/lib/tl/admin-db'
import { isTlSuperadmin } from '@/lib/tl/superadmin'

async function authorize() {
  const cookieStore  = await cookies()
  const session      = cookieStore.get(SESSION_COOKIE_NAME)?.value
  if (!session) return null

  const isSuperSession = session.startsWith('__tl_super__')
  const superEmail     = isSuperSession ? session.replace('__tl_super__', '') : null
  const rep            = isSuperSession ? null : await getRepByKode(session)

  const allowed = (isSuperSession && isTlSuperadmin(superEmail)) || (rep && isTlSuperadmin(rep.email))
  return allowed ? true : null
}

export async function GET() {
  if (!await authorize()) return Response.json({ error: 'Forbidden' }, { status: 403 })

  try {
    const rules = await getRottenRules()
    return Response.json(rules)
  } catch {
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  if (!await authorize()) return Response.json({ error: 'Forbidden' }, { status: 403 })

  let body: unknown
  try { body = await request.json() } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!Array.isArray(body)) {
    return Response.json({ error: 'Expected array' }, { status: 400 })
  }

  const rules: RottenRule[] = []
  for (const item of body) {
    if (
      typeof item !== 'object' || item === null ||
      typeof (item as Record<string, unknown>).stage_id !== 'string' ||
      !['create_date', 'last_activity_at'].includes((item as Record<string, unknown>).key as string) ||
      typeof (item as Record<string, unknown>).days !== 'number'
    ) {
      return Response.json({ error: 'Invalid rule shape' }, { status: 400 })
    }
    rules.push(item as RottenRule)
  }

  try {
    await upsertRottenRules(rules)
    return Response.json({ ok: true })
  } catch {
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
