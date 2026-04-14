// GET /tl/api/admin/users — returns all reps. Requires superadmin session.

import { cookies } from 'next/headers'
import { getRepByKode } from '@/lib/db'
import { SESSION_COOKIE_NAME } from '@/lib/auth'
import { getAllRepsAdmin } from '@/lib/tl/admin-db'
import { isTlSuperadmin } from '@/lib/tl/superadmin'

export async function GET() {
  const cookieStore = await cookies()
  const kode = cookieStore.get(SESSION_COOKIE_NAME)?.value
  if (!kode) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const rep = await getRepByKode(kode)
  if (!rep || !isTlSuperadmin(rep.email)) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const reps = await getAllRepsAdmin()
    return Response.json(reps)
  } catch {
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
