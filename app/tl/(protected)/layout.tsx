// Auth guard for all protected TL routes.
// Requires a valid session with teamleder role — redirects to /tl/login otherwise.

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getRepByKode } from '@/lib/db'
import { SESSION_COOKIE_NAME, isTeamleder } from '@/lib/auth'
import { isTlSuperadmin } from '@/lib/tl/superadmin'
import { getTeamleders } from '@/lib/tl/admin-db'
import TlNav from './_components/TlNav'

export default async function TlProtectedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const cookieStore = await cookies()
  const session = cookieStore.get(SESSION_COOKIE_NAME)?.value

  if (!session) redirect('/tl/login')

  // Superadmin without a rep entry uses __tl_super__<email> as session value
  const isSuperSession = session.startsWith('__tl_super__')
  const superEmail     = isSuperSession ? session.replace('__tl_super__', '') : null

  if (isSuperSession && !isTlSuperadmin(superEmail)) redirect('/tl/login')

  const rep     = isSuperSession ? null : await getRepByKode(session)
  const isAdmin = isSuperSession || isTlSuperadmin(rep?.email)

  if (!rep && !isSuperSession) redirect('/tl/login')
  if (!isAdmin && !isTeamleder(rep!.rolle)) redirect('/tl/login')

  const displayName = rep?.full_name ?? superEmail
  const teamleders  = isAdmin ? await getTeamleders().catch(() => []) : []

  return (
    <div className="min-h-screen bg-[#F5F5F5]">
      <TlNav isAdmin={isAdmin} displayName={displayName} teamleders={teamleders} />
      <main className="max-w-7xl mx-auto px-6 py-8">
        {children}
      </main>
    </div>
  )
}
