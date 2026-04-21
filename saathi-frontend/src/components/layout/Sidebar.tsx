'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Activity, FileText, MessageCircle, CalendarCheck, BarChart2 } from 'lucide-react'
import { clsx } from 'clsx'

const NAV = [
  { href: '/dashboard', label: 'Health Dashboard', icon: Activity,      sub: 'Wearable metrics'   },
  { href: '/reports',   label: 'Lab Reports',       icon: FileText,      sub: 'Upload & history'   },
  { href: '/chat',      label: 'Talk to Your Data', icon: MessageCircle, sub: 'Ask Saathi'         },
  { href: '/brief',     label: 'Appointment Brief', icon: CalendarCheck, sub: 'Pre-visit prep'     },
  { href: '/digest',    label: 'Health Digest',     icon: BarChart2,     sub: 'Weekly summary'     },
]

export function Sidebar() {
  const path = usePathname()

  return (
    <aside className="w-56 flex-shrink-0 flex flex-col h-full" style={{ background: '#0F2D52' }}>
      {/* Logo */}
      <div className="px-5 py-6 border-b border-white/10">
        <p className="text-white font-bold text-lg tracking-tight">Saathi</p>
        <p className="text-xs mt-0.5" style={{ color: '#93c5fd' }}>Your family's health memory</p>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {NAV.map(({ href, label, icon: Icon, sub }) => {
          const active = path === href || path.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              className={clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors',
                active
                  ? 'bg-white/15 text-white'
                  : 'text-blue-200 hover:bg-white/10 hover:text-white'
              )}
            >
              <Icon size={15} className="flex-shrink-0" />
              <div className="min-w-0">
                <p className="font-medium leading-tight truncate">{label}</p>
                <p className={clsx('text-xs leading-tight truncate', active ? 'text-blue-200' : 'text-blue-400')}>
                  {sub}
                </p>
              </div>
            </Link>
          )
        })}
      </nav>

      {/* Footer disclaimer */}
      <div className="px-4 py-4 border-t border-white/10">
        <p className="text-xs leading-relaxed" style={{ color: '#60a5fa' }}>
          Saathi shows your data.<br />
          Not medical advice.
        </p>
      </div>
    </aside>
  )
}
