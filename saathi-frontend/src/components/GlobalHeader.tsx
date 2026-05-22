'use client'

import { useRef, useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { ChevronDown, Plus, Activity, FileText, Check } from 'lucide-react'
import { useMember, type Member } from '@/lib/member-context'
import { cn } from '@/lib/utils'

function truncate(s: string, max = 23) {
  return s.length > max ? s.slice(0, max - 1) + '…' : s
}

function Divider() {
  return <div className="w-px h-4 bg-gray-200 flex-shrink-0" />
}

function MemberAvatar({ name, active }: { name: string; active?: boolean }) {
  const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
  return (
    <span className={cn(
      'w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 transition-colors',
      active ? 'text-white' : 'text-white'
    )} style={{ background: active ? '#1A56A0' : '#9CA3AF' }}>
      {initials}
    </span>
  )
}

function MemberDropdown() {
  const { members, selected, setSelected } = useMember()
  const [open, setOpen] = useState(false)
  const ref  = useRef<HTMLDivElement>(null)
  const router = useRouter()

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  if (!selected) return null

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className={cn(
          'flex items-center gap-2 px-3 h-8 rounded-lg text-[13px] font-medium transition-colors',
          open ? 'bg-gray-100' : 'hover:bg-gray-50'
        )}
      >
        <MemberAvatar name={selected.name} active />
        <span className="text-gray-900">{truncate(selected.name)}</span>
        {selected.isSelf && <span className="text-gray-400 text-[11px] font-normal">· You</span>}
        <ChevronDown size={13} className={cn('text-gray-400 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 w-56 bg-white border border-gray-200 rounded-xl shadow-lg py-1 z-50">
          {members.map(m => (
            <button key={m.id} onClick={() => { setSelected(m); setOpen(false) }}
              className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-gray-50 text-left transition-colors">
              <MemberAvatar name={m.name} active={selected.id === m.id} />
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-medium text-gray-900 truncate">{m.name}</div>
                <div className="text-[11px] text-gray-400">{m.isSelf ? 'You' : m.relation}</div>
              </div>
              {selected.id === m.id && <Check size={13} className="text-blue-600 flex-shrink-0" />}
            </button>
          ))}
          <div className="border-t border-gray-100 mt-1 pt-1">
            <button
              onClick={() => { router.push('/settings#family'); setOpen(false) }}
              className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 text-[13px] text-blue-600 font-medium transition-colors">
              <Plus size={13} /> Add member
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function WearablesChip() {
  const { connectedDevices } = useMember()
  const pathname = usePathname()
  const isDashboard = pathname === '/' || pathname === '/dashboard'
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  if (connectedDevices.length === 0) return (
    <div className="flex items-center gap-1.5 text-[12px] text-gray-400">
      <Activity size={13} />
      <span>No device connected</span>
    </div>
  )

  if (connectedDevices.length === 1 || !isDashboard) return (
    <div className="flex items-center gap-1.5 text-[12px] text-gray-600">
      <Activity size={13} className="text-teal-600" />
      <span>{connectedDevices.join(', ')}</span>
    </div>
  )

  // Multiple devices + on dashboard → dropdown
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 text-[12px] text-gray-600 hover:text-gray-900 transition-colors">
        <Activity size={13} className="text-teal-600" />
        <span>{connectedDevices.length} devices</span>
        <ChevronDown size={11} className={cn('text-gray-400 transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 w-44 bg-white border border-gray-200 rounded-xl shadow-lg py-1 z-50">
          {connectedDevices.map(d => (
            <div key={d} className="flex items-center gap-2 px-3 py-2 text-[13px] text-gray-700">
              <Activity size={12} className="text-teal-600" />
              {d}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ReportCount() {
  const { reportCount, selected } = useMember()
  return (
    <div className="flex items-center gap-1.5 text-[12px] text-gray-600">
      <FileText size={13} className="text-blue-500" />
      <span>
        {reportCount} report{reportCount !== 1 ? 's' : ''}
        {selected && !selected.isSelf ? ` · ${selected.name.split(' ')[0]}` : ''}
      </span>
    </div>
  )
}

export function GlobalHeader() {
  const { loading } = useMember()

  if (loading) return (
    <div className="sticky top-0 z-40 bg-white border-b border-gray-100 h-11 flex items-center px-6">
      <div className="h-4 w-48 bg-gray-100 rounded animate-pulse" />
    </div>
  )

  return (
    <div className="sticky top-0 z-40 bg-white/95 backdrop-blur-sm border-b border-gray-100 h-11 flex items-center px-6 gap-3">
      <MemberDropdown />
      <Divider />
      <WearablesChip />
      <Divider />
      <ReportCount />
    </div>
  )
}
