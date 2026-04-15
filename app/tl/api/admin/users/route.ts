// GET /tl/api/admin/users — returns all reps. Requires superadmin session.

import { cookies } from 'next/headers'
import { getRepByKode } from '@/lib/db'
import { SESSION_COOKIE_NAME } from '@/lib/auth'
import { getAllRepsAdmin } from '@/lib/tl/admin-db'
import { isTlSuperadmin } from '@/lib/tl/superadmin'

export async function GET() {
  const cookieStore = await cookies()
  const session = cookieStore.get(SESSION_COOKIE_NAME)?.value
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const isSuperSession = session.startsWith('__tl_super__')
  const superEmail     = isSuperSession ? session.replace('__tl_super__', '') : null
  const rep            = isSuperSession ? null : await getRepByKode(session)

  const allowed = (isSuperSession && isTlSuperadmin(superEmail)) || (rep && isTlSuperadmin(rep.email))
  if (!allowed) return Response.json({ error: 'Forbidden' }, { status: 403 })

  try {
    const reps = await getAllRepsAdmin()
    return Response.json(reps)
  } catch {
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
