// src/lib/api.ts
import { createClient } from '@/lib/supabase'

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

async function getUserId(): Promise<string> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  return user.id
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Not authenticated')
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${session.access_token}`,
  }
}

export async function fetchChat(query: string) {
  const [userId, headers] = await Promise.all([getUserId(), getAuthHeaders()])
  const res = await fetch(`${BASE}/rag/query`, {
    method: 'POST', headers,
    body: JSON.stringify({ user_id: userId, query }),
  })
  if (!res.ok) throw new Error(`Chat failed: ${res.status}`)
  return res.json()
}

export async function fetchBrief(appointmentType: string) {
  const [userId, headers] = await Promise.all([getUserId(), getAuthHeaders()])
  const res = await fetch(`${BASE}/brief/generate`, {
    method: 'POST', headers,
    body: JSON.stringify({ user_id: userId, appointment_type: appointmentType }),
  })
  if (!res.ok) throw new Error('Brief failed')
  return res.json()
}

export async function fetchDigest(period: number) {
  const [userId, headers] = await Promise.all([getUserId(), getAuthHeaders()])
  const res = await fetch(`${BASE}/digest/generate`, {
    method: 'POST', headers,
    body: JSON.stringify({ user_id: userId, period_days: period }),
  })
  if (!res.ok) throw new Error('Digest failed')
  return res.json()
}

export async function uploadReport(file: File, memberId?: string) {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Not authenticated')

  const userId = session.user.id
  const ext = file.name.split('.').pop() ?? 'pdf'
  const storagePath = `${userId}/${Date.now()}.${ext}`

  // Step 1: Upload directly to Supabase Storage (bypasses Vercel 4.5MB limit)
  const { error: storageError } = await supabase.storage
    .from('lab-reports')
    .upload(storagePath, file, { contentType: file.type, upsert: false })

  if (storageError) throw new Error(`Storage upload failed: ${storageError.message}`)

  // Step 2: Tell backend to fetch + process from storage
  const res = await fetch(`${BASE}/ingest/report`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({
      storage_path: storagePath,
      file_name: file.name,
      user_id: userId,
      member_id: memberId ?? null,
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail ?? `Processing error: ${res.status}`)
  }
  return res.json()
}

// Fetch user's lab reports directly from Supabase
export async function fetchLabReports() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('lab_reports')
    .select('id, file_name, lab_name, report_date, structured_data, uploaded_at, source')
    .eq('user_id', user.id)
    .order('report_date', { ascending: false })
    .limit(20)

  if (error) throw error
  return data ?? []
}

export async function signOut() {
  const supabase = createClient()
  await supabase.auth.signOut()
}
