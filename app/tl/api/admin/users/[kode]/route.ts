// PATCH /tl/api/admin/users/[kode] — update a rep's rolle. Requires superadmin session.

import { cookies } from 'next/headers'
import { getRepByKode } from '@/lib/db'
import { SESSION_COOKIE_NAME, TEAMLEDER_ROLES } from '@/lib/auth'
import { updateRepRolle } from '@/lib/tl/admin-db'
import { isTlSuperadmin } from '@/lib/tl/superadmin'

const ALLOWED_ROLES = [...TEAMLEDER_ROLES, 'IK', 'Senior', 'Spesialist', 'Inkjøpskonsulent'] as const

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ kode: string }> }
) {
  const cookieStore = await cookies()
  const sessionKode = cookieStore.get(SESSION_COOKIE_NAME)?.value
  if (!sessionKode) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = await getRepByKode(sessionKode)
  if (!admin || !isTlSuperadmin(admin.email)) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { kode } = await params
  let body: { rolle?: unknown }
  try { body = await request.json() } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const rolle = typeof body.rolle === 'string' ? body.rolle : null
  if (!rolle || !(ALLOWED_ROLES as readonly string[]).includes(rolle)) {
    return Response.json({ error: 'Invalid rolle' }, { status: 400 })
  }

  try {
    await updateRepRolle(kode, rolle)
    return Response.json({ ok: true })
  } catch {
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
