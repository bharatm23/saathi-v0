'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, Upload, CheckCircle2, Loader2 } from 'lucide-react'
import { uploadReport } from '@/lib/api'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'

type Step = 1 | 2 | 3 | 4

function SaathiLogo() {
  return (
    <Link href="/landing" className="flex items-center gap-2 flex-shrink-0">
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
        <rect width="32" height="32" rx="8" fill="#0F2D52"/>
        <path d="M16 23s-7-4.5-7-9.5A4.5 4.5 0 0 1 16 10.5 4.5 4.5 0 0 1 23 13.5C23 18.5 16 23 16 23z" fill="white"/>
      </svg>
      <span className="font-semibold text-gray-900 text-lg">Saathi</span>
    </Link>
  )
}

function StepBar({ current }: { current: Step }) {
  return (
    <div className="flex items-center gap-2 w-40">
      {([1, 2, 3, 4] as Step[]).map(s => (
        <div key={s} className="h-1 flex-1 rounded-full transition-colors duration-300"
          style={{ background: s <= current ? '#0F2D52' : '#E5E7EB' }} />
      ))}
    </div>
  )
}

function Step1({ onNext }: { onNext: () => void }) {
  const [name, setName] = useState('')
  const [dob,  setDob]  = useState('')
  const supabase = createClient()

  async function save() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    // Pre-fill from Google if available
    const googleName = user.user_metadata?.full_name ?? ''
    await supabase.from('profiles').upsert({
      id: user.id,
      full_name: name || googleName,
      date_of_birth: dob || null,
      updated_at: new Date().toISOString(),
    })
    document.cookie = 'onboarding_done=1; path=/; max-age=31536000'
    onNext()
  }

  // Pre-fill from Google on mount
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user?.user_metadata?.full_name) setName(user.user_metadata.full_name)
    })
  }, [])

  return (
    <div className="max-w-lg mx-auto">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-400 mb-1">Step 1 of 3 · Your profile</p>
      <h2 className="text-3xl font-bold text-gray-900 mb-3">Tell us about yourself</h2>
      <p className="text-base text-gray-500 mb-8">This helps Saathi contextualise your lab ranges correctly.</p>
      <div className="space-y-4 mb-8">
        <div>
          <label className="text-xs font-medium text-gray-500 uppercase tracking-wide block mb-1">Full name</label>
          <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Your name"
            className="w-full px-4 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-500 uppercase tracking-wide block mb-1">Date of birth <span className="text-gray-400 normal-case">(optional — helps contextualise lab ranges)</span></label>
          <input type="date" value={dob} onChange={e => setDob(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
        </div>
      </div>
      <div className="flex items-center justify-between">
        <button onClick={() => { document.cookie = 'onboarding_done=1; path=/; max-age=31536000'; onNext() }}
          className="text-sm text-gray-400 hover:text-gray-600">Skip for now</button>
        <button onClick={save}
          className="inline-flex items-center gap-2 text-sm font-semibold text-white px-6 py-2.5 rounded-xl"
          style={{ background: '#0F2D52' }}>
          Continue <ArrowRight size={15} />
        </button>
      </div>
    </div>
  )
}

function Step2({ onNext }: { onNext: () => void }) {
  const DEVICES = [
    { id: 'fitbit',     label: 'Fitbit',     sub: 'Steps, sleep, heart rate', available: true },
    { id: 'garmin',     label: 'Garmin',     sub: 'Coming soon',              available: false },
    { id: 'whoop',      label: 'Whoop',      sub: 'Coming soon',              available: false },
    { id: 'ultrahuman', label: 'Ultrahuman', sub: 'Coming soon',              available: false },
  ]
  return (
    <div className="max-w-lg mx-auto">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-400 mb-1">Step 1 of 3 · Connect wearable</p>
      <h2 className="text-3xl font-bold text-gray-900 mb-3">Connect your device</h2>
      <p className="text-base text-gray-500 mb-8 leading-relaxed">
        Saathi pulls your daily activity, sleep, and heart rate so your health picture is always complete.
      </p>
      <div className="space-y-3 mb-8">
        {DEVICES.map(d => (
          <div key={d.id}
            className={`border rounded-2xl p-4 flex items-center justify-between transition-all ${
              d.available
                ? 'border-gray-200 bg-white hover:border-blue-300 cursor-pointer'
                : 'border-gray-200 bg-gray-50 opacity-50 cursor-not-allowed'
            }`}
            onClick={() => d.available && (window.location.href = `/api/auth/${d.id}`)}>
            <div>
              <p className={`font-medium ${d.available ? 'text-gray-900' : 'text-gray-400'}`}>{d.label}</p>
              <p className="text-xs text-gray-400 mt-0.5">{d.sub}</p>
            </div>
            {d.available && (
              <span className="text-sm font-medium px-4 py-1.5 rounded-xl text-white" style={{ background: '#0F2D52' }}>
                Connect
              </span>
            )}
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between">
        <button onClick={onNext} className="text-sm text-gray-400 hover:text-gray-600 transition-colors">Skip for now</button>
        <button onClick={onNext}
          className="inline-flex items-center gap-2 text-sm font-semibold text-white px-6 py-2.5 rounded-xl"
          style={{ background: '#0F2D52' }}>
          Continue <ArrowRight size={15} />
        </button>
      </div>
    </div>
  )
}

type UploadState = 'idle' | 'uploading' | 'done' | 'error'

function Step3({ onNext }: { onNext: () => void }) {
  const [state,    setState]    = useState<UploadState>('idle')
  const [filename, setFilename] = useState('')
  const [dragging, setDragging] = useState(false)
  const [error,    setError]    = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = useCallback(async (file: File) => {
    setFilename(file.name); setState('uploading'); setError('')
    try {
      const result = await uploadReport(file)
      if (result.success) setState('done')
      else { setState('error'); setError(result.error ?? 'Extraction failed') }
    } catch (e: any) { setState('error'); setError(e.message ?? 'Upload failed') }
  }, [])

  return (
    <div className="max-w-lg mx-auto">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-400 mb-1">Step 2 of 3 · First lab report</p>
      <h2 className="text-3xl font-bold text-gray-900 mb-3">Upload your latest report</h2>
      <p className="text-base text-gray-500 mb-8 leading-relaxed">
        One PDF or image is enough to get started. Saathi extracts the numbers and builds your baseline.
      </p>
      {state === 'done' ? (
        <div className="bg-white border border-gray-200 rounded-2xl p-6 flex items-center gap-4 mb-8">
          <CheckCircle2 size={24} className="text-teal-600 flex-shrink-0" />
          <div>
            <p className="font-medium text-gray-900">{filename}</p>
            <p className="text-sm text-gray-400 mt-0.5">Extracted successfully</p>
          </div>
        </div>
      ) : (
        <div
          onDragOver={e => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}
          onClick={() => state === 'idle' && inputRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-14 text-center mb-4 transition-colors ${
            dragging ? 'border-blue-400 bg-blue-50' : 'border-gray-300 bg-white hover:border-gray-400 cursor-pointer'
          }`}
        >
          <input ref={inputRef} type="file" accept="application/pdf,image/*" hidden
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
          {state === 'uploading' ? (
            <div className="flex flex-col items-center gap-3">
              <Loader2 size={28} className="text-gray-400 animate-spin" />
              <p className="text-sm text-gray-500">Extracting from {filename}…</p>
            </div>
          ) : (
            <>
              <Upload size={28} className="mx-auto text-gray-400 mb-3" strokeWidth={1.5} />
              <p className="font-medium text-gray-900 mb-1">Drop a PDF or image</p>
              <p className="text-sm text-gray-400 mb-4">or click to choose · max 20MB</p>
              <span className="text-sm font-medium text-white px-5 py-2 rounded-xl" style={{ background: '#0F2D52' }}>
                Choose file
              </span>
            </>
          )}
        </div>
      )}
      {error && <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2 mb-4">{error}</p>}
      <p className="text-xs text-amber-600 flex items-center gap-1.5 mb-8">
        <span>⚠</span> Handwritten reports can&apos;t be parsed yet — please upload printed PDFs.
      </p>
      <div className="flex items-center justify-between">
        <button onClick={onNext} className="text-sm text-gray-400 hover:text-gray-600 transition-colors">Skip for now</button>
        <button onClick={onNext} disabled={state === 'uploading'}
          className="inline-flex items-center gap-2 text-sm font-semibold text-white px-6 py-2.5 rounded-xl disabled:opacity-40"
          style={{ background: '#0F2D52' }}>
          Continue <ArrowRight size={15} />
        </button>
      </div>
    </div>
  )
}

function Step4({ onDone }: { onDone: () => void }) {
  const USECASES = [
    { title: 'Before every appointment', tag: 'Appointment Brief',
      body: 'Generate a one-page brief of your last 3 reports and 28 days of wearable data. Walk in knowing your numbers — not scrambling to remember them.' },
    { title: 'When results feel confusing', tag: 'Chat',
      body: 'Ask "what was my ferritin last time?" or "has my TSH changed?" Saathi answers from your actual records — with the source and date, every time.' },
    { title: 'For the family member who manages everything', tag: 'Family memory',
      body: 'Add parents, your partner, your children. Track their reports separately. One digest covers the whole family, once a week.' },
  ]
  return (
    <div className="max-w-lg mx-auto">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-400 mb-1">Step 3 of 3</p>
      <h2 className="text-3xl font-bold text-gray-900 mb-3">What Saathi does for you</h2>
      <p className="text-base text-gray-500 mb-8 leading-relaxed">
        Health data is scattered across PDFs, WhatsApp forwards, and memory.
        Saathi is the single place that holds it all — and actually helps you use it.
      </p>
      <div className="space-y-4 mb-10">
        {USECASES.map(uc => (
          <div key={uc.title} className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
            <div className="flex items-start justify-between gap-4 mb-2">
              <p className="font-semibold text-gray-900">{uc.title}</p>
              <span className="text-xs font-medium px-2.5 py-1 rounded-full flex-shrink-0"
                style={{ background: '#EFF6FF', color: '#1A56A0' }}>
                {uc.tag}
              </span>
            </div>
            <p className="text-sm text-gray-500 leading-relaxed">{uc.body}</p>
          </div>
        ))}
      </div>
      <button onClick={onDone}
        className="w-full inline-flex items-center justify-center gap-2 text-sm font-semibold text-white py-3 rounded-xl"
        style={{ background: '#0F2D52' }}>
        Go to Dashboard <ArrowRight size={15} />
      </button>
      <p className="text-xs text-gray-400 text-center mt-3">Saathi shows your data · Not medical advice</p>
    </div>
  )
}

export default function OnboardingPage() {
  const [step, setStep] = useState<Step>(1)
  const router = useRouter()

  function goToDashboard() {
    document.cookie = 'onboarding_done=1; path=/; max-age=31536000'
    router.replace('/')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header — no sidebar, no nav links */}
      <div className="bg-white border-b border-gray-200 px-8 py-4 flex items-center justify-between">
        <SaathiLogo />
        <StepBar current={step} />
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-400">Step {step} of 3</span>
          <button onClick={goToDashboard} className="text-sm text-gray-400 hover:text-gray-600 transition-colors">Skip</button>
        </div>
      </div>

      <div className="px-8 py-16">
        {step === 1 && <Step1 onNext={() => setStep(2)} />}
        {step === 2 && <Step2 onNext={() => setStep(3)} />}
        {step === 3 && <Step3 onNext={() => setStep(4)} />}
        {step === 4 && <Step4 onDone={goToDashboard} />}
      </div>
    </div>
  )
}
