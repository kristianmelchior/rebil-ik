// Auth guard for all protected TL routes.
// Requires a valid session with teamleder role — redirects to /tl/login otherwise.

import Link from 'next/link'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getRepByKode } from '@/lib/db'
import { SESSION_COOKIE_NAME, isTeamleder } from '@/lib/auth'
import { isTlSuperadmin } from '@/lib/tl/superadmin'

export default async function TlProtectedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const cookieStore = await cookies()
  const kode = cookieStore.get(SESSION_COOKIE_NAME)?.value

  if (!kode) redirect('/tl/login')

  const rep = await getRepByKode(kode)
  if (!rep || !isTeamleder(rep.rolle)) redirect('/tl/login')

  const isAdmin = isTlSuperadmin(rep.email)

  return (
    <div className="min-h-screen bg-[#F5F5F5]">
      <header className="bg-white border-b border-border px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/tl" className="font-semibold text-text-primary hover:opacity-75 transition-opacity">
            Rebil TL
          </Link>
        </div>
        <div className="flex items-center gap-4">
          {isAdmin && (
            <Link
              href="/tl/admin"
              className="text-xs text-text-muted hover:text-text-primary transition-colors"
            >
              Administrer brukere
            </Link>
          )}
          <span className="text-sm text-text-muted">{rep.full_name}</span>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-6 py-8">
        {children}
      </main>
    </div>
  )
}
