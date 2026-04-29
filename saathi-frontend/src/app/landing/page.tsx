'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { ArrowRight, FileText, MessageSquare, CalendarCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase'

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

export default function LandingPage() {
  const [loggedIn, setLoggedIn] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setLoggedIn(!!user))
  }, [])

  async function handleSignOut() {
    await supabase.auth.signOut()
    setLoggedIn(false)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Nav */}
      <nav className="bg-white border-b border-gray-200 px-8 py-4 flex items-center justify-between">
        <SaathiLogo />
        {loggedIn ? (
          <button onClick={handleSignOut}
            className="text-sm font-medium text-white px-5 py-2 rounded-xl"
            style={{ background: '#0F2D52' }}>
            Sign out
          </button>
        ) : (
          <Link href="/login"
            className="text-sm font-medium text-white px-5 py-2 rounded-xl"
            style={{ background: '#0F2D52' }}>
            Sign in
          </Link>
        )}
      </nav>

      {/* Hero */}
      <section className="max-w-2xl mx-auto px-8 pt-24 pb-20">
        <div className="inline-flex items-center gap-2 bg-white border border-gray-200 rounded-full px-4 py-1.5 text-xs font-medium text-gray-500 uppercase tracking-wide mb-8">
          <span className="w-1.5 h-1.5 rounded-full bg-teal-500" />
          Phase 0 · Private Beta
        </div>
        <h1 className="text-5xl font-bold text-gray-900 leading-tight mb-6">
          Your family&apos;s health,<br />remembered.
        </h1>
        <p className="text-lg text-gray-500 leading-relaxed mb-10 max-w-lg">
          Saathi keeps every lab report, every wearable trend, every doctor&apos;s note
          in one calm place — so you walk into the next appointment with the
          answers, not the panic.
        </p>
        <div className="flex items-center gap-4 mb-6">
          {loggedIn ? (
            <Link href="/"
              className="inline-flex items-center gap-2 text-sm font-semibold text-white px-6 py-3 rounded-xl"
              style={{ background: '#0F2D52' }}>
              Dashboard <ArrowRight size={16} />
            </Link>
          ) : (
            <Link href="/login"
              className="inline-flex items-center gap-2 text-sm font-semibold text-white px-6 py-3 rounded-xl"
              style={{ background: '#0F2D52' }}>
              Get started <ArrowRight size={16} />
            </Link>
          )}
        </div>
        <p className="text-xs text-gray-400">Free during beta · your data stays encrypted and private</p>
      </section>

      {/* Feature cards */}
      <section className="max-w-4xl mx-auto px-8 pb-24">
        <div className="grid grid-cols-3 gap-5">
          {[
            { icon: FileText,      title: 'Upload once',      body: 'PDF, image, or typed. Saathi pulls the numbers automatically.' },
            { icon: MessageSquare, title: 'Ask anything',     body: 'Talk to your data. See where every answer came from.' },
            { icon: CalendarCheck, title: 'Walk in prepared', body: 'One-tap appointment briefs and weekly digests.' },
          ].map(({ icon: Icon, title, body }) => (
            <div key={title} className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4 bg-gray-100">
                <Icon size={18} className="text-gray-600" />
              </div>
              <p className="font-semibold text-gray-900 mb-2">{title}</p>
              <p className="text-sm text-gray-500 leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Trust strip */}
      <section className="border-t border-gray-200 bg-white py-12">
        <div className="max-w-2xl mx-auto px-8 text-center">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400 mb-3">Privacy & data</p>
          <p className="text-sm text-gray-500 leading-relaxed">
            Your health data never trains AI models. Reports are stored encrypted.
            You can export or delete everything at any time.
          </p>
        </div>
      </section>
    </div>
  )
}
