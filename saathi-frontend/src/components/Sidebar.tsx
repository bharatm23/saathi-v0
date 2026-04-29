'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LayoutDashboard, FileText, MessageSquare, ClipboardList, Sparkles, LogOut, Settings } from 'lucide-react'
import { signOut } from '@/lib/api'

const items = [
  { href: '/',        label: 'Dashboard', icon: LayoutDashboard },
  { href: '/reports', label: 'Reports',   icon: FileText        },
  { href: '/chat',    label: 'Chat',      icon: MessageSquare   },
  { href: '/brief',   label: 'Brief',     icon: ClipboardList   },
  { href: '/digest',  label: 'Digest',    icon: Sparkles        },
  { href: '/settings', label: 'Settings', icon: Settings }
]

export function Sidebar() {
  const pathname = usePathname()
  const router   = useRouter()

  async function handleSignOut() {
    await signOut()
    router.push('/landing')
    router.refresh()
  }

  return (
    <aside className="w-56 shrink-0 bg-navy text-white flex flex-col sticky top-0 h-screen">
      <Link href="/landing" className="flex items-center gap-2 px-5 pt-6 pb-8">
        <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
          <rect width="32" height="32" rx="8" fill="white" fillOpacity="0.15"/>
          <path d="M16 23s-7-4.5-7-9.5A4.5 4.5 0 0 1 16 10.5 4.5 4.5 0 0 1 23 13.5C23 18.5 16 23 16 23z" fill="white"/>
        </svg>
        <div>
          <p className="text-white font-bold text-lg leading-none">Saathi</p>
          <p className="text-blue-300 text-xs mt-0.5">Your family&apos;s health memory</p>
        </div>
      </Link>
      <nav className="px-3 flex-1 space-y-1">
        {items.map(it => {
          const active = it.href === '/' ? pathname === '/' : pathname.startsWith(it.href)
          const Icon = it.icon
          return (
            <Link key={it.href} href={it.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-[14px] transition-colors ${
                active ? 'bg-white/15 text-white font-medium' : 'text-blue-200 hover:text-white hover:bg-white/5'
              }`}>
              <Icon size={18} strokeWidth={1.8} />
              <span>{it.label}</span>
            </Link>
          )
        })}
      </nav>
      <div className="px-3 pb-4 space-y-1">
        <button onClick={handleSignOut}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[14px] text-blue-200 hover:text-white hover:bg-white/5 transition-colors">
          <LogOut size={18} strokeWidth={1.8} />
          <span>Sign out</span>
        </button>
        <div className="px-3 py-3 border-t border-white/10 text-[11px] leading-[1.45] text-blue-400">
          Saathi shows your data<br />Not medical advice
        </div>
      </div>
    </aside>
  )
}
