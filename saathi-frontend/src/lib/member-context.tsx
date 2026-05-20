'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { createClient } from '@/lib/supabase'

export type Member = {
  id: string
  name: string
  relation: string
  isSelf?: boolean
}

type MemberContextType = {
  members: Member[]
  selected: Member | null
  setSelected: (m: Member) => void
  reportCount: number
  connectedDevices: string[]
  loading: boolean
}

const MemberContext = createContext<MemberContextType>({
  members: [], selected: null, setSelected: () => {},
  reportCount: 0, connectedDevices: [], loading: true,
})

export function MemberProvider({ children }: { children: ReactNode }) {
  const [members,          setMembers]          = useState<Member[]>([])
  const [selected,         setSelected]         = useState<Member | null>(null)
  const [reportCount,      setReportCount]      = useState(0)
  const [connectedDevices, setConnectedDevices] = useState<string[]>([])
  const [loading,          setLoading]          = useState(true)
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }

      const rawName = user.user_metadata?.full_name ?? user.email?.split('@')[0] ?? 'You'
      const parts   = rawName.trim().split(' ')
      const display = parts.length > 1
        ? `${parts[0]} ${parts[parts.length - 1][0]}`
        : parts[0]
      const self: Member = { id: user.id, name: display, relation: 'Self', isSelf: true }

      const { data: fam } = await supabase
        .from('family_members').select('id,name,relation').eq('owner_id', user.id).order('created_at')

      const all: Member[] = [self, ...(fam ?? []).map(m => ({ id: m.id, name: m.name, relation: m.relation }))]
      setMembers(all)
      setSelected(self)

      // Report count for self
      const { count } = await supabase
        .from('lab_reports').select('*', { count: 'exact', head: true })
        .eq('user_id', user.id).is('member_id', null)
      setReportCount(count ?? 0)

      // Connected devices from session cookie
      try {
        const res = await fetch('/api/devices/status')
        if (res.ok) {
          const data = await res.json()
          const devices: string[] = []
          if (data.fitbit?.connected) devices.push('Fitbit')
          if (data.garmin?.connected) devices.push('Garmin')
          setConnectedDevices(devices)
        }
      } catch {}

      setLoading(false)
    }
    load()
  }, [])

  // Reload report count when selected member changes
  useEffect(() => {
    if (!selected) return
    async function loadCount() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const q = selected!.isSelf
        ? supabase.from('lab_reports').select('*', { count: 'exact', head: true })
            .eq('user_id', user.id).is('member_id', null)
        : supabase.from('lab_reports').select('*', { count: 'exact', head: true })
            .eq('user_id', user.id).eq('member_id', selected!.id)
      const { count } = await q
      setReportCount(count ?? 0)
    }
    loadCount()
  }, [selected])

  return (
    <MemberContext.Provider value={{ members, selected, setSelected, reportCount, connectedDevices, loading }}>
      {children}
    </MemberContext.Provider>
  )
}

export function useMember() {
  return useContext(MemberContext)
}
