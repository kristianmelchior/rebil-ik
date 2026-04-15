import { cookies } from 'next/headers'
import { getRepByKode } from '@/lib/db'
import { SESSION_COOKIE_NAME } from '@/lib/auth'
import { isTlSuperadmin } from '@/lib/tl/superadmin'
import StatsTab from '@/components/StatsTab'

export default async function TlTabellPage() {
  const cookieStore    = await cookies()
  const session        = cookieStore.get(SESSION_COOKIE_NAME)?.value ?? ''

  const isSuperSession = session.startsWith('__tl_super__')
  const superEmail     = isSuperSession ? session.replace('__tl_super__', '') : null
  const rep            = isSuperSession ? null : await getRepByKode(session)
  const isAdmin        = isSuperSession || isTlSuperadmin(rep?.email)

  // Non-admin TLs default to their own team
  const defaultTlFilter = isAdmin ? undefined : (rep?.full_name ?? undefined)

  return <StatsTab defaultTlFilter={defaultTlFilter} />
}
