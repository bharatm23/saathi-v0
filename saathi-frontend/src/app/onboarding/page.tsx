'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { Plus, X } from 'lucide-react'

type FamilyMember = { name: string; relation: string }

export default function OnboardingPage() {
  const [step,    setStep]    = useState(1)
  const [name,    setName]    = useState('')
  const [dob,     setDob]     = useState('')
  const [gender,  setGender]  = useState('')
  const [members, setMembers] = useState<FamilyMember[]>([])
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')
  const router   = useRouter()
  const supabase = createClient()

  const RELATIONS = ['Parent', 'Sibling', 'Spouse', 'Child', 'Other']

  function addMember() {
    setMembers(prev => [...prev, { name: '', relation: 'Parent' }])
  }

  function updateMember(i: number, field: keyof FamilyMember, val: string) {
    setMembers(prev => prev.map((m, idx) => idx === i ? { ...m, [field]: val } : m))
  }

  function removeMember(i: number) {
    setMembers(prev => prev.filter((_, idx) => idx !== i))
  }

  async function handleFinish() {
    if (!name.trim()) { setError('Please enter your name.'); return }
    setLoading(true); setError('')
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not signed in')

      // Save profile
      const { error: profileError } = await supabase.from('profiles').upsert({
        id: user.id,
        full_name: name.trim(),
        date_of_birth: dob || null,
        gender: gender || null,
        updated_at: new Date().toISOString(),
      })
      if (profileError) throw profileError

      // Save family members
      const validMembers = members.filter(m => m.name.trim())
      if (validMembers.length) {
        const { error: membersError } = await supabase.from('family_members').insert(
          validMembers.map(m => ({ owner_id: user.id, name: m.name.trim(), relation: m.relation }))
        )
        if (membersError) throw membersError
      }

      router.push('/')
      router.refresh()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 w-full max-w-sm">

        {/* Header */}
        <div className="mb-6">
          <p className="text-xs font-medium text-gray-400 mb-1">Step {step} of 2</p>
          <div className="flex gap-1.5 mb-4">
            {[1, 2].map(s => (
              <div key={s} className="h-1 flex-1 rounded-full"
                style={{ background: s <= step ? '#0F2D52' : '#E5E7EB' }} />
            ))}
          </div>
          <h1 className="text-lg font-semibold text-gray-900">
            {step === 1 ? 'About you' : 'Family members'}
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            {step === 1
              ? 'Help Saathi personalise your health memory.'
              : 'Add family members whose health you track. You can skip this.'}
          </p>
        </div>

        {/* Step 1 — Profile */}
        {step === 1 && (
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Full name *</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)}
                placeholder="Your name"
                className="w-full px-4 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Date of birth</label>
              <input type="date" value={dob} onChange={e => setDob(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Gender</label>
              <div className="flex gap-2">
                {['Male', 'Female', 'Other'].map(g => (
                  <button key={g} onClick={() => setGender(g)}
                    className="flex-1 py-2 rounded-xl text-sm border transition-colors"
                    style={{
                      background:   gender === g ? '#0F2D52' : '#fff',
                      color:        gender === g ? '#fff'    : '#374151',
                      borderColor:  gender === g ? '#0F2D52' : '#D1D5DB',
                    }}>
                    {g}
                  </button>
                ))}
              </div>
            </div>
            {error && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
            <button onClick={() => { if (!name.trim()) { setError('Please enter your name.'); return }; setError(''); setStep(2) }}
              className="w-full py-2.5 rounded-xl text-sm font-medium text-white mt-2"
              style={{ background: '#0F2D52' }}>
              Continue
            </button>
          </div>
        )}

        {/* Step 2 — Family */}
        {step === 2 && (
          <div className="space-y-3">
            {members.map((m, i) => (
              <div key={i} className="flex gap-2 items-start">
                <div className="flex-1 space-y-2">
                  <input type="text" value={m.name} placeholder="Name"
                    onChange={e => updateMember(i, 'name', e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm focus:outline-none" />
                  <select value={m.relation} onChange={e => updateMember(i, 'relation', e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm focus:outline-none bg-white">
                    {RELATIONS.map(r => <option key={r}>{r}</option>)}
                  </select>
                </div>
                <button onClick={() => removeMember(i)} className="mt-2 text-gray-400 hover:text-gray-600">
                  <X size={16} />
                </button>
              </div>
            ))}

            <button onClick={addMember}
              className="w-full py-2 rounded-xl text-sm border border-dashed border-gray-300 text-gray-500 hover:border-gray-400 flex items-center justify-center gap-1.5">
              <Plus size={14} /> Add family member
            </button>

            {error && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

            <div className="flex gap-2 pt-1">
              <button onClick={() => setStep(1)}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium border border-gray-300 text-gray-700 hover:bg-gray-50">
                Back
              </button>
              <button onClick={handleFinish} disabled={loading}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white disabled:opacity-50"
                style={{ background: '#0F2D52' }}>
                {loading ? 'Saving…' : 'Finish'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
