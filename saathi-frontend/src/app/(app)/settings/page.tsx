'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { signOut } from '@/lib/api'
import { User, Users, Smartphone, Bell, Shield, Download, Pencil, Trash2, Plus, LogOut } from 'lucide-react'
import { useMember } from "@/lib/member-context";

const SECTIONS = [
  { id: 'profile',   label: 'Profile',          icon: User },
  { id: 'family',    label: 'Family members',    icon: Users },
  { id: 'devices',   label: 'Connected devices', icon: Smartphone },
  { id: 'privacy',   label: 'Privacy & data',    icon: Shield },
]

const RELATIONS = ['Self', 'Spouse', 'Parent', 'Child', 'Sibling', 'In-law', 'Other']

type Profile = { full_name: string; date_of_birth: string | null; gender: string | null; email: string }
type Member  = { id: string; name: string; relation: string; date_of_birth: string | null }

export default function SettingsPage() {
  const [active,   setActive]   = useState('profile')
  const [profile,  setProfile]  = useState<Profile>({ full_name: '', date_of_birth: null, gender: null, email: '' })
  const [members,  setMembers]  = useState<Member[]>([])
  const [saving,   setSaving]   = useState(false)
  const [saved,    setSaved]    = useState(false)
  const [addOpen,  setAddOpen]  = useState(false)
  const [newMember, setNewMember] = useState({ name: '', relation: 'Parent', phone: '', email: '', date_of_birth: '' })
  const router  = useRouter()
  const supabase = createClient()
  const [editMember, setEditMember]   = useState<Member | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<Member | null>(null)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const googleName = user.user_metadata?.full_name ?? ''
      const googleEmail = user.email ?? ''
      const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      setProfile({
        full_name: p?.full_name ?? googleName,
        date_of_birth: p?.date_of_birth ?? null,
        gender: p?.gender ?? null,
        email: googleEmail,
      })
    }
    load()
  }, [])

  useEffect(() => {
    if (window.location.hash === '#family') setActive('family')
  }, [])

  async function saveProfile() {
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('profiles').upsert({ id: user.id, full_name: profile.full_name, date_of_birth: profile.date_of_birth || null, gender: profile.gender || null, updated_at: new Date().toISOString() })
    setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 2000)
  }
  
  const { refreshMembers } = useMember()
  async function addMember() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || !newMember.name.trim()) return
    const { data } = await supabase.from('family_members').insert({ owner_id: user.id, name: newMember.name.trim(), relation: newMember.relation, date_of_birth: newMember.date_of_birth || null }).select().single()
    if (data) { setMembers(prev => [...prev, data]); setAddOpen(false); setNewMember({ name: '', relation: 'Parent', phone: '', email: '', date_of_birth: '' }) }
    await refreshMembers()
  }

  async function deleteMember(id: string) {
    await supabase.from('family_members').delete().eq('id', id)
    setMembers(prev => prev.filter(m => m.id !== id))
  }

  async function handleSignOut() {
    await signOut(); router.push('/landing')
  }

  function initials(name: string) {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
  }

  return (
    <div className="flex min-h-full bg-gray-50">
      {/* Side nav */}
      <aside className="w-56 bg-white border-r border-gray-200 flex flex-col py-6 px-3 sticky top-0 h-screen">

        <nav className="flex-1 space-y-0.5">
          {SECTIONS.map(s => {
            const Icon = s.icon
            return (
              <button key={s.id} onClick={() => setActive(s.id)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition-colors ${
                  active === s.id ? 'font-medium text-gray-900' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}
                style={active === s.id ? { background: '#F3F4F6' } : {}}>
                <Icon size={16} />
                {s.label}
              </button>
            )
          })}
        </nav>
      </aside>

      {/* Main */}
      <main className="flex-1 px-12 py-10 max-w-3xl">
        <h1 className="text-xl font-semibold text-gray-900 mb-1">Settings</h1>
        <p className="text-sm text-gray-400 mb-8">{profile.full_name} · {profile.email}</p>

        {/* Profile */}
        {active === 'profile' && (
          <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-5">Profile</h2>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide block mb-1">Full name</label>
                <input type="text" value={profile.full_name} onChange={e => setProfile(p => ({ ...p, full_name: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide block mb-1">Email</label>
                <input type="email" value={profile.email} disabled
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm bg-gray-50 text-gray-400 cursor-not-allowed" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide block mb-1">Date of birth</label>
                <input type="date" value={profile.date_of_birth ?? ''} onChange={e => setProfile(p => ({ ...p, date_of_birth: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide block mb-2">Gender</label>
                <div className="flex gap-2">
                  {['Male', 'Female', 'Other'].map(g => (
                    <button key={g} onClick={() => setProfile(p => ({ ...p, gender: g }))}
                      className="px-4 py-2 rounded-xl text-sm border transition-colors"
                      style={{ background: profile.gender === g ? '#0F2D52' : '#fff', color: profile.gender === g ? '#fff' : '#374151', borderColor: profile.gender === g ? '#0F2D52' : '#D1D5DB' }}>
                      {g}
                    </button>
                  ))}
                </div>
              </div>
              <button onClick={saveProfile} disabled={saving}
                className="text-sm font-medium text-white px-5 py-2.5 rounded-xl disabled:opacity-50 transition-colors"
                style={{ background: '#0F2D52' }}>
                {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save changes'}
              </button>
            </div>
          </div>
        )}

        {/* Family members */}
        {active === 'family' && (
          <div className="space-y-4">
            <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100">
                <h2 className="text-base font-semibold text-gray-900">Family members</h2>
                <p className="text-sm text-gray-400 mt-0.5">People whose health you keep track of here.</p>
              </div>

              {/* Self row */}
              <div className="px-6 py-4 flex items-center gap-4 border-b border-gray-100">
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium text-white flex-shrink-0"
                  style={{ background: '#1A56A0' }}>
                  {initials(profile.full_name || 'Me')}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900">{profile.full_name || 'You'}</p>
                  <p className="text-sm text-gray-400">Self · {profile.email}</p>
                </div>
                <span className="text-xs font-medium px-2.5 py-1 rounded-full"
                  style={{ background: '#ECFDF5', color: '#065F46' }}>ACTIVE</span>
              </div>

              {/* Family member rows */}
              {members.map(m => (
                <div key={m.id} className="px-6 py-4 flex items-center gap-4 border-b border-gray-100 last:border-0">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium flex-shrink-0"
                    style={{ background: '#F3F4F6', color: '#374151' }}>
                    {initials(m.name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900">{m.name}</p>
                    <p className="text-sm text-gray-400">{m.relation}{m.date_of_birth ? ` · ${m.date_of_birth}` : ''}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {/* here */}
                    {editMember?.id === m.id && (
                      <div className="px-6 pb-5 border-t border-gray-100 pt-4 space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide block mb-1">First name</label>
                            <input type="text" value={editMember.name.split(' ')[0]}
                              onChange={e => setEditMember(p => p ? { ...p, name: e.target.value + ' ' + p.name.split(' ').slice(1).join(' ') } : p)}
                              maxLength={50}
                              className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm focus:outline-none" />
                          </div>
                          <div>
                            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide block mb-1">Last name</label>
                            <input type="text" value={editMember.name.split(' ').slice(1).join(' ')}
                              onChange={e => setEditMember(p => p ? { ...p, name: p.name.split(' ')[0] + ' ' + e.target.value } : p)}
                              maxLength={50}
                              className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm focus:outline-none" />
                          </div>
                        </div>
                        <div>
                          <label className="text-xs font-medium text-gray-500 uppercase tracking-wide block mb-2">Relationship</label>
                          <div className="flex flex-wrap gap-2">
                            {RELATIONS.map(r => (
                              <button key={r} onClick={() => setEditMember(p => p ? { ...p, relation: r } : p)}
                                className="px-3 py-1.5 rounded-full text-sm border transition-colors"
                                style={{ background: editMember.relation === r ? '#0F2D52' : '#fff', color: editMember.relation === r ? '#fff' : '#374151', borderColor: editMember.relation === r ? '#0F2D52' : '#D1D5DB' }}>
                                {r}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <label className="text-xs font-medium text-gray-500 uppercase tracking-wide block mb-1">Date of birth</label>
                          <input type="date"
                            value={editMember.date_of_birth ?? ''}
                            max={new Date().toISOString().split('T')[0]}
                            min="1900-01-01"
                            onChange={e => setEditMember(p => p ? { ...p, date_of_birth: e.target.value } : p)}
                            className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm focus:outline-none" />
                        </div>
                        <div className="flex justify-end gap-2 pt-1">
                          <button onClick={() => setEditMember(null)} className="text-sm text-gray-500 px-4 py-2">Cancel</button>
                          <button onClick={async () => {
                            const cleanName = editMember.name.trim().replace(/[^a-zA-Z\s'-]/g, '')
                            await supabase.from('family_members').update({
                              name: cleanName, relation: editMember.relation, date_of_birth: editMember.date_of_birth || null
                            }).eq('id', editMember.id)
                            setMembers(prev => prev.map(mb => mb.id === editMember.id ? { ...mb, name: cleanName, relation: editMember.relation, date_of_birth: editMember.date_of_birth } : mb))
                            setEditMember(null)
                          }} className="text-sm font-medium text-white px-5 py-2 rounded-xl" style={{ background: '#0F2D52' }}>
                            Save changes
                          </button>
                        </div>
                      </div>
                    )}
{/* here */}
                    <button onClick={() => setEditMember(m)} className="text-gray-400 hover:text-gray-600 p-1 transition-colors"><Pencil size={14} /></button>
                    <button onClick={() => setDeleteConfirm(m)} className="text-gray-400 hover:text-red-500 p-1 transition-colors"><Trash2 size={14} /></button>
                  </div>
                </div>
              ))}
              {deleteConfirm && (
              <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
                <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full mx-4">
                  <p className="font-semibold text-gray-900 mb-2">Remove {deleteConfirm.name}?</p>
                  <p className="text-sm text-gray-500 mb-6">Remove {deleteConfirm.name} from linked family members? Their reports will remain in your account.</p>
                  <div className="flex gap-3">
                    <button onClick={() => setDeleteConfirm(null)}
                      className="flex-1 py-2.5 rounded-xl text-sm font-medium border border-gray-300 text-gray-700 hover:bg-gray-50">
                      Cancel
                    </button>
                    <button onClick={async () => {
                      await deleteMember(deleteConfirm.id)
                      setDeleteConfirm(null)
                    }} className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white"
                        style={{ background: '#DC2626' }}>
                      Delete member
                    </button>
                  </div>
                </div>
              </div>
            )}
            </div>

            {/* Add member */}
            {!addOpen ? (
              <button onClick={() => setAddOpen(true)}
                className="w-full bg-white border border-gray-200 rounded-2xl shadow-sm px-6 py-4 flex items-center gap-3 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-50 transition-colors">
                <div className="w-8 h-8 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center">
                  <Plus size={14} />
                </div>
                Add a family member
              </button>
            ) : (
              <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6">
                <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Plus size={16} /> Add a family member
                </h3>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="text-xs font-medium text-gray-500 uppercase tracking-wide block mb-1">First name</label>
                    <input type="text" placeholder="e.g. Ravi" value={newMember.name.split(' ')[0]}
                      onChange={e => setNewMember(p => ({ ...p, name: e.target.value + ' ' + p.name.split(' ').slice(1).join(' ') }))}
                      className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm focus:outline-none" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500 uppercase tracking-wide block mb-1">Last name</label>
                    <input type="text" placeholder="e.g. Sharma"
                      onChange={e => setNewMember(p => ({ ...p, name: p.name.split(' ')[0] + ' ' + e.target.value }))}
                      className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm focus:outline-none" />
                  </div>
                </div>
                <div className="mb-3">
                  <label className="text-xs font-medium text-gray-500 uppercase tracking-wide block mb-2">Relationship</label>
                  <div className="flex flex-wrap gap-2">
                    {RELATIONS.map(r => (
                      <button key={r} onClick={() => setNewMember(p => ({ ...p, relation: r }))}
                        className="px-3 py-1.5 rounded-full text-sm border transition-colors"
                        style={{ background: newMember.relation === r ? '#0F2D52' : '#fff', color: newMember.relation === r ? '#fff' : '#374151', borderColor: newMember.relation === r ? '#0F2D52' : '#D1D5DB' }}>
                        {r}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="mb-3">
                  <label className="text-xs font-medium text-gray-500 uppercase tracking-wide block mb-1">Date of birth <span className="text-gray-400 normal-case">(optional — helps contextualise ranges)</span></label>
                  <input type="date" value={newMember.date_of_birth} onChange={e => setNewMember(p => ({ ...p, date_of_birth: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm focus:outline-none" />
                </div>
                <p className="text-xs text-gray-400 mb-4">Reports uploaded for this member will be stored separately under their profile.</p>
                <div className="flex items-center justify-end gap-3">
                  <button onClick={() => setAddOpen(false)} className="text-sm text-gray-500 hover:text-gray-700">Cancel</button>
                  <button onClick={addMember} disabled={!newMember.name.trim()}
                    className="text-sm font-medium text-white px-5 py-2 rounded-xl disabled:opacity-40"
                    style={{ background: '#0F2D52' }}>
                    Add member
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Connected devices */}
        {active === 'devices' && (
          <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-1">Connected devices</h2>
            <p className="text-sm text-gray-400 mb-5">Wearable data syncs automatically when you open the dashboard.</p>
            <div className="space-y-3">
              {[
                { name: 'Fitbit', status: 'connected', last: 'Last sync: today' },
                { name: 'Garmin', status: 'soon' },
                { name: 'Whoop',  status: 'soon' },
              ].map(d => (
                <div key={d.name} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
                  <div>
                    <p className="font-medium text-gray-900">{d.name}</p>
                    {d.last && <p className="text-xs text-gray-400 mt-0.5">{d.last}</p>}
                    {d.status === 'soon' && <p className="text-xs text-gray-400 mt-0.5">Coming soon</p>}
                  </div>
                  {d.status === 'connected' ? (
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-medium px-2.5 py-1 rounded-full" style={{ background: '#ECFDF5', color: '#065F46' }}>Connected</span>
                      <a href="/api/auth/fitbit" className="text-xs text-gray-400 hover:text-gray-600">Reconnect</a>
                    </div>
                  ) : (
                    <span className="text-xs text-gray-400">Pending</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Privacy */}
        {active === 'privacy' && (
          <div className="space-y-4">
            <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6">
              <h2 className="text-base font-semibold text-gray-900 mb-4">Privacy & data</h2>
              <div className="space-y-4 text-sm text-gray-600 leading-relaxed">
                <p>Your health data is stored encrypted and never shared with third parties. It is never used to train AI models.</p>
                <p>Saathi uses OpenAI&apos;s API to power the chat and brief features. Your data is sent to OpenAI only to generate responses and is not retained by them for training.</p>
              </div>
            </div>
            <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">Export your data</p>
                  <p className="text-sm text-gray-400 mt-0.5">Download all your reports and chat history as JSON.</p>
                </div>
                <button className="flex items-center gap-2 text-sm font-medium border border-gray-300 rounded-xl px-4 py-2 hover:bg-gray-50 transition-colors">
                  <Download size={14} /> Export
                </button>
              </div>
              <div className="border-t border-gray-100 pt-4 flex items-center justify-between">
                <div>
                  <p className="font-medium text-red-600">Delete account</p>
                  <p className="text-sm text-gray-400 mt-0.5">Permanently delete your account and all data.</p>
                </div>
                <button className="text-sm font-medium border border-red-200 text-red-600 rounded-xl px-4 py-2 hover:bg-red-50 transition-colors">
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
