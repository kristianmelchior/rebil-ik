// Shared auth for /api/feed/* social routes.

import { cookies } from 'next/headers'
import { getRepByKode } from '@/lib/db'
import { getFeedViewerKode } from '@/lib/feedViewer'
import { ADMIN_SESSION_COOKIE_NAME, SESSION_COOKIE_NAME } from '@/lib/auth'

export async function requireFeedViewer() {
  const cookieStore = await cookies()
  const isAdmin = cookieStore.get(ADMIN_SESSION_COOKIE_NAME)?.value === '1'
  const repSession = cookieStore.get(SESSION_COOKIE_NAME)?.value
  if (!isAdmin && !repSession) {
    return { error: Response.json({ error: 'Unauthorized' }, { status: 401 }) }
  }

  const kode = getFeedViewerKode(cookieStore)
  if (!kode) {
    return { error: Response.json({ error: 'Unauthorized' }, { status: 401 }) }
  }

  const rep = await getRepByKode(kode)
  if (!rep) {
    return { error: Response.json({ error: 'Unauthorized' }, { status: 401 }) }
  }

  return { kode, repName: rep.full_name }
}
