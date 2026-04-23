const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'
const USER_ID = "a6c75706-96a9-4465-aea2-7807f8df17d8" // POC hardcoded

export interface LabMetric {
  value: number | string
  unit: string | null
  reference_range: string | null
  flag: string | null
  interpretation_bands: string | null
  stage_classification: string | null
  interpretation_text: string | null
  panel: string | null
}

export interface StructuredData {
  labs: Record<string, LabMetric>
  clinical_notes: Record<string, { value: string }>
  risk_scores: Record<string, { score: string | number; interpretation?: string; acceptable_score?: string | number; time_horizon?: string }>
  vitals: Record<string, { value: string | number; unit: string }>
  impressions: string[]
}

export interface ChatSource {
  type: 'lab_report' | 'wearable'
  id?: string
  date?: string
  lab?: string
  date_range?: string
  count?: number
}

export interface ChatResponse {
  response: string
  sources: ChatSource[]
  blocked: boolean
  disclaimer: string
}

export interface IngestResult {
  success: boolean
  report_id?: string
  metrics_extracted?: string[]
  clinical_notes?: string[]
  risk_scores?: string[]
  impressions?: string[]
  report_date?: string
  lab_name?: string
  patient_name?: string
  error?: string
}

export interface BriefResult {
  brief: string
  appointment_type: string
  data_sources: { lab_reports: number; wearable_days: number }
  disclaimer: string
}

export interface DigestResult {
  digest: string
  period_days: number
  disclaimer: string
}

export async function sendChatMessage(userId: string, query: string): Promise<ChatResponse> {
  const res = await fetch(`${BASE}/rag/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId, query }),
  })
  if (!res.ok) throw new Error(`Chat error: ${res.status}`)
  return res.json()
}

export async function uploadLabReport(userId: string, file: File): Promise<IngestResult> {
  const form = new FormData()
  form.append('file', file)
  form.append('user_id', userId)
  const res = await fetch(`${BASE}/ingest/report`, { method: 'POST', body: form })
  if (!res.ok) throw new Error(`Upload error: ${res.status}`)
  return res.json()
}

export async function generateBrief(userId: string, appointmentType: string): Promise<BriefResult> {
  const res = await fetch(`${BASE}/brief/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId, appointment_type: appointmentType }),
  })
  if (!res.ok) throw new Error(`Brief error: ${res.status}`)
  return res.json()
}

export async function generateDigest(userId: string, periodDays = 7): Promise<DigestResult> {
  const res = await fetch(`${BASE}/digest/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId, period_days: periodDays }),
  })
  if (!res.ok) throw new Error(`Digest error: ${res.status}`)
  return res.json()
}

export async function fetchChat(query: string) {
  const res = await fetch(`${BASE}/rag/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: USER_ID, query }),
  })
  if (!res.ok) throw new Error("Chat failed")
  return res.json() as Promise<{
    response: string
    sources: { type: string; lab?: string; date?: string; date_range?: string }[]
    blocked: boolean
    disclaimer: string
  }>
}

export async function fetchBrief(appointmentType: string) {
  const res = await fetch(`${BASE}/brief/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: USER_ID, appointment_type: appointmentType }),
  })
  if (!res.ok) throw new Error("Brief failed")
  return res.json() as Promise<{ brief: string; disclaimer: string }>
}

export async function fetchDigest(period: number) {
  const res = await fetch(`${BASE}/digest/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: USER_ID, period_days: period }),
  })
  if (!res.ok) throw new Error("Digest failed")
  return res.json() as Promise<{ digest: string; disclaimer: string }>
}

// export async function uploadReport(file: File) {
//   const form = new FormData()
//   form.append("file", file)
//   form.append("user_id", USER_ID)
//   const res = await fetch(`${BASE}/ingest/report`, { method: "POST", body: form })
//   if (!res.ok) throw new Error("Upload failed")
//   return res.json() as Promise<{
//     success: boolean
//     metrics_extracted?: string[]
//     impressions?: string[]
//     report_date?: string
//     lab_name?: string
//     error?: string
//   }>
// }

export async function uploadReport(file: File) {
  const form = new FormData()
  form.append("file", file)
  form.append("user_id", USER_ID)
  
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 120000) // 2 min timeout
  
  try {
    const res = await fetch(`${BASE}/ingest/report`, { 
      method: "POST", 
      body: form,
      signal: controller.signal,
    })
    clearTimeout(timeout)
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.detail ?? `Upload error: ${res.status}`)
    }
    return res.json()
  } catch (e: any) {
    clearTimeout(timeout)
    if (e.name === 'AbortError') throw new Error('Request timed out — backend may be waking up, try again in 30s')
    throw e
  }
}