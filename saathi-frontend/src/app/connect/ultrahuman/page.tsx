'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function UltrahumanConnect() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/auth/ultrahuman/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? 'Failed to connect. Check your email and try again.')
        return
      }
      router.push('/dashboard?connected=ultrahuman')
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center p-8">
      <div className="w-full max-w-sm bg-white rounded-2xl border border-gray-200 p-8">
        <div className="text-2xl mb-2">💍</div>
        <h1 className="text-lg font-semibold text-gray-900 mb-1">Connect Ultrahuman Ring</h1>
        <p className="text-sm text-gray-400 mb-6">
          Enter the email address linked to your Ultrahuman account.
        </p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input
            type="email"
            required
            placeholder="your@email.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-gray-400 transition-colors"
          />
          {error && <p className="text-xs text-red-500">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="bg-gray-900 text-white rounded-xl px-4 py-3 text-sm font-medium hover:bg-gray-700 transition-colors disabled:opacity-50"
          >
            {loading ? 'Connecting...' : 'Connect →'}
          </button>
        </form>
        <a href="/connect" className="block text-center text-xs text-gray-400 mt-4 hover:text-gray-600">
          ← Back
        </a>
      </div>
    </main>
  )
}