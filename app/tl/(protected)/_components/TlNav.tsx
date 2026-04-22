'use client'

import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

interface Props {
  isAdmin:     boolean
  displayName: string | null
  teamleders?: string[]
}

export default function TlNav({ isAdmin, displayName, teamleders }: Props) {
  const pathname     = usePathname()
  const router       = useRouter()
  const searchParams = useSearchParams()
  const selectedTl   = searchParams.get('tl') ?? ''

  function handleTlChange(value: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (value) params.set('tl', value)
    else params.delete('tl')
    router.push(`${pathname}?${params.toString()}`)
  }

  const navLinks = [
    { href: '/tl',             label: 'Oversikt'   },
    { href: '/tl/tabell',      label: 'Tabell'     },
    ...(isAdmin ? [{ href: '/tl/admin', label: 'Administrer' }] : []),
  ]

  return (
    <header className="bg-white border-b border-border">
      <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
      <div className="flex items-center gap-5">
        <span className="font-semibold text-text-primary">Rebil TL</span>
        <nav className="flex items-center gap-1">
          {navLinks.map(link => {
            const isActive = pathname === link.href
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`px-3 py-1.5 rounded text-sm transition-colors ${
                  isActive
                    ? 'bg-[#F5F5F5] text-text-primary font-medium'
                    : 'text-text-muted hover:text-text-primary hover:bg-[#F5F5F5]'
                }`}
              >
                {link.label}
              </Link>
            )
          })}
        </nav>

        {isAdmin && teamleders && teamleders.length > 0 && (
          <select
            value={selectedTl}
            onChange={e => handleTlChange(e.target.value)}
            className="text-xs border border-border rounded px-2 py-1.5 bg-white text-text-primary"
          >
            <option value="">Alle team</option>
            {teamleders.map(tl => (
              <option key={tl} value={tl}>{tl}</option>
            ))}
          </select>
        )}
      </div>

      <div className="flex items-center gap-4">
        <span className="text-sm text-text-muted">{displayName}</span>
        <Link
          href="/"
          className="text-xs text-text-muted hover:text-text-primary border border-border rounded px-3 py-1.5 transition-colors hover:bg-[#F5F5F5]"
        >
          ← IK-dash
        </Link>
      </div>
      </div>
    </header>
  )
}
