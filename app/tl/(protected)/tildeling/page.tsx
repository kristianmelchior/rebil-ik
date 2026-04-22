import { cookies } from 'next/headers'
import { getRepByKode } from '@/lib/db'
import { SESSION_COOKIE_NAME } from '@/lib/auth'
import { isTlSuperadmin } from '@/lib/tl/superadmin'
import TildelingTab from '@/components/TildelingTab'

export default async function TlTildelingPage() {
  const cookieStore    = await cookies()
  const session        = cookieStore.get(SESSION_COOKIE_NAME)?.value ?? ''

  const isSuperSession = session.startsWith('__tl_super__')
  const rep            = isSuperSession ? null : await getRepByKode(session)
  const isAdmin        = isSuperSession || isTlSuperadmin(rep?.email)

  const defaultTlFilter = isAdmin ? undefined : (rep?.full_name ?? undefined)

  return <TildelingTab defaultTlFilter={defaultTlFilter} />
}
