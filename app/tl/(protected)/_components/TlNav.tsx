'use client'

import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useState, useEffect } from 'react'
import { currentIsoWeek } from '@/lib/tl/week'

const LEADS_VISITED_KEY = 'tl_leads_visited'

interface Props {
  isAdmin:     boolean
  displayName: string | null
  teamleders?: string[]
  ownTl?:      string
}

export default function TlNav({ isAdmin, displayName, teamleders, ownTl }: Props) {
  const pathname     = usePathname()
  const router       = useRouter()
  const searchParams = useSearchParams()
  const selectedTl   = searchParams.get('tl') ?? ownTl ?? ''

  function handleTlChange(value: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (value && value !== '__all__') params.set('tl', value)
    else params.delete('tl')
    router.push(`${pathname}?${params.toString()}`)
  }

  const [leadsVisited,   setLeadsVisited]   = useState(true) // start true to avoid flash
  const [bannerDismissed, setBannerDismissed] = useState(true) // avoid flash

  useEffect(() => {
    setLeadsVisited(!!localStorage.getItem(LEADS_VISITED_KEY))
    const week = currentIsoWeek()
    setBannerDismissed(!!localStorage.getItem(`vurdering_done_${week}`))
  }, [])

  useEffect(() => {
    if (pathname === '/tl/leads' && !leadsVisited) {
      localStorage.setItem(LEADS_VISITED_KEY, '1')
      setLeadsVisited(true)
    }
  }, [pathname, leadsVisited])

  const leadsIsNew = !leadsVisited && new Date() < new Date('2026-05-13')

  // Friday-afternoon banner: show if it's Friday ≥ noon and not dismissed
  const now         = new Date()
  const isFriday    = now.getDay() === 5
  const isAfterNoon = now.getHours() >= 12
  const showBanner  = isFriday && isAfterNoon && !bannerDismissed

  function dismissBanner() {
    const week = currentIsoWeek()
    localStorage.setItem(`vurdering_done_${week}`, '1')
    setBannerDismissed(true)
  }

  const navLinks = [
    { href: '/tl',              label: 'Oversikt'    },
    { href: '/tl/tabell',       label: 'Tabell'      },
    { href: '/tl/leads',        label: 'Leads',      isNew: leadsIsNew },
    { href: '/tl/vurdering',    label: 'Vurdering'   },
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
                className={`relative px-3 py-1.5 rounded text-sm transition-colors ${
                  isActive
                    ? 'bg-[#F5F5F5] text-text-primary font-medium'
                    : 'text-text-muted hover:text-text-primary hover:bg-[#F5F5F5]'
                }`}
              >
                {link.label}
                {'isNew' in link && link.isNew && (
                  <span className="absolute -top-1 -right-1 bg-[#A32D2D] text-white text-[9px] font-bold leading-none px-1 py-0.5 rounded-full">
                    NY
                  </span>
                )}
              </Link>
            )
          })}
        </nav>

        {teamleders && teamleders.length > 0 && (
          <select
            value={selectedTl}
            onChange={e => handleTlChange(e.target.value)}
            className="text-xs border border-border rounded px-2 py-1.5 bg-white text-text-primary"
          >
            <option value="__all__">Alle team</option>
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

      {/* Friday reminder banner */}
      {showBanner && (
        <div className="bg-[#FFF3E0] border-t border-[#FFE0B2]">
          <div className="max-w-7xl mx-auto px-6 py-2 flex items-center justify-between gap-4">
            <span className="text-sm text-[#E65100] font-medium">
              🗓 Husk å vurdere dine ansatte for denne uken!
            </span>
            <div className="flex items-center gap-3">
              <Link href="/tl/vurdering" className="text-xs font-semibold text-[#E65100] underline underline-offset-2 hover:opacity-70">
                Gå til vurdering →
              </Link>
              <button onClick={dismissBanner} className="text-xs text-[#BF360C] hover:opacity-70">
                Avvis
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  )
}
