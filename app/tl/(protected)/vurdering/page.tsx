import { cookies } from 'next/headers'
import { getRepByKode, getAllRepsWithDetails } from '@/lib/db'
import { SESSION_COOKIE_NAME, isTeamleder } from '@/lib/auth'
import { isTlSuperadmin } from '@/lib/tl/superadmin'
import VurderingSection from '../_components/VurderingSection'

export default async function VurderingPage() {
  const cookieStore    = await cookies()
  const session        = cookieStore.get(SESSION_COOKIE_NAME)?.value ?? ''
  const isSuperSession = session.startsWith('__tl_super__')
  const rep            = isSuperSession ? null : await getRepByKode(session)
  const isAdmin        = isSuperSession || isTlSuperadmin(rep?.email)

  const allReps = await getAllRepsWithDetails().catch(() => [])

  // TL sees own team; admin sees all
  const reps = isAdmin
    ? allReps
    : allReps.filter(r => r.teamleder === rep?.full_name)

  const raterName = rep?.full_name ?? (session.startsWith('__tl_super__') ? session.replace('__tl_super__', '') : '')

  // Teamleders list for superadmin team-switching
  const teamleders = isAdmin
    ? [...new Set(allReps.map(r => r.teamleder).filter(Boolean))].sort()
    : []

  return (
    <VurderingSection
      reps={reps}
      raterName={raterName}
      isAdmin={isAdmin}
      teamleders={teamleders}
      ownTeamleder={rep?.full_name ?? null}
    />
  )
}
