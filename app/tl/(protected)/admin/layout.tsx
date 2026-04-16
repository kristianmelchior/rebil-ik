// Superadmin guard for /tl/admin.
// Requires the logged-in rep's email to be in TL_SUPERADMIN_EMAILS env var.

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getRepByKode } from '@/lib/db'
import { SESSION_COOKIE_NAME } from '@/lib/auth'
import { isTlSuperadmin } from '@/lib/tl/superadmin'

export default async function TlAdminLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies()
  const session = cookieStore.get(SESSION_COOKIE_NAME)?.value
  if (!session) redirect('/tl/login')

  const isSuperSession = session.startsWith('__tl_super__')
  const superEmail     = isSuperSession ? session.replace('__tl_super__', '') : null

  if (isSuperSession) {
    if (!isTlSuperadmin(superEmail)) redirect('/tl')
  } else {
    const rep = await getRepByKode(session)
    if (!rep || !isTlSuperadmin(rep.email)) redirect('/tl')
  }

  return <>{children}</>
}
