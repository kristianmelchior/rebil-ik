// Resolve which rep kode acts as the viewer for feed social (reactions/comments).

import {
  SESSION_COOKIE_NAME,
  ADMIN_SESSION_COOKIE_NAME,
  ADMIN_VIEW_KODE_COOKIE_NAME,
} from '@/lib/auth'

/** Same identity as dashboard data: admin views as selected rep; else session rep. */
export function getFeedViewerKode(cookieStore: {
  get(name: string): { value: string } | undefined
}): string | null {
  const isAdmin = cookieStore.get(ADMIN_SESSION_COOKIE_NAME)?.value === '1'
  const adminView = cookieStore.get(ADMIN_VIEW_KODE_COOKIE_NAME)?.value
  const repSession = cookieStore.get(SESSION_COOKIE_NAME)?.value
  if (isAdmin) return adminView ?? null
  return repSession ?? null
}
