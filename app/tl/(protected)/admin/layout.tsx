// Superadmin guard for /tl/admin.
// Requires the logged-in rep's email to be in TL_SUPERADMIN_EMAILS env var.

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getRepByKode } from '@/lib/db'
import { SESSION_COOKIE_NAME } from '@/lib/auth'
import { isTlSuperadmin } from '@/lib/tl/superadmin'

export default async function TlAdminLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies()
  const kode = cookieStore.get(SESSION_COOKIE_NAME)?.value
  if (!kode) redirect('/tl/login')

  const rep = await getRepByKode(kode)
  if (!rep || !isTlSuperadmin(rep.email)) redirect('/tl')

  return <>{children}</>
}
