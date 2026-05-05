import { cookies } from 'next/headers'
import { getRepByKode, getAllRepsWithDetails } from '@/lib/db'
import { SESSION_COOKIE_NAME } from '@/lib/auth'
import { isTlSuperadmin } from '@/lib/tl/superadmin'
import LeadsSection from '../_components/LeadsSection'

export default async function TlLeadsPage() {
  const cookieStore    = await cookies()
  const session        = cookieStore.get(SESSION_COOKIE_NAME)?.value ?? ''
  const isSuperSession = session.startsWith('__tl_super__')
  const rep            = isSuperSession ? null : await getRepByKode(session)
  const isAdmin        = isSuperSession || isTlSuperadmin(rep?.email)

  // Reps for the dropdown — admins see all, TLs see only their team
  const allReps = await getAllRepsWithDetails().catch(() => [])
  const reps = isAdmin
    ? allReps
    : allReps.filter(r => r.teamleder === rep?.full_name)

  return <LeadsSection reps={reps} />
}
