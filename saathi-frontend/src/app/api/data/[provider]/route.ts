import { NextRequest, NextResponse } from 'next/server'
import { providers } from '@/lib/providers'
import { getSession } from '@/lib/session'
import { Period } from '@/lib/providers/types'
import { getCachedMetrics, setCachedMetrics } from '@/lib/db'
import { getSupabaseUserId } from '@/lib/db'

async function getValidToken(session: any, id: string, provider: any): Promise<string | null> {
  const t = session.tokens?.[id]
  if (!t) return null
  if (id === 'ultrahuman') return t.accessToken ?? null
  if (Date.now() < t.expiresAt - 60_000) return t.accessToken

  const res = await fetch(provider.tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${provider.clientId}:${provider.clientSecret}`).toString('base64')}`,
    },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: t.refreshToken }),
  })
  if (!res.ok) return null
  const tokens = await res.json()
  session.tokens[id] = {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresAt: Date.now() + tokens.expires_in * 1000,
  }
  await session.save()
  return tokens.access_token
}

// shiftDays shifts the anchor date backwards for comparison period fetches
function resolvePeriod(period: Period, syncDate: string, shiftDays = 0) {
  const base = new Date(syncDate)
  base.setDate(base.getDate() - shiftDays)
  const anchorDate = base.toISOString().split('T')[0]

  if (period === '30d') {
    const start = new Date(base)
    start.setDate(base.getDate() - 30)
    return { fitbitPeriod: '1m', startDate: start.toISOString().split('T')[0], anchorDate }
  }
  if (period === '1y') {
    const start = new Date(base)
    start.setFullYear(base.getFullYear() - 1)
    return { fitbitPeriod: '1y', startDate: start.toISOString().split('T')[0], anchorDate }
  }
  return { fitbitPeriod: '1d', startDate: anchorDate, anchorDate }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  const { provider: id } = await params
  const { searchParams } = new URL(req.url)
  const endpointKey = searchParams.get('endpoint')
  const syncDate = searchParams.get('syncDate')
  const period = (searchParams.get('period') ?? 'day') as Period
  const shift = parseInt(searchParams.get('shift') ?? '0')

  const provider = providers[id as keyof typeof providers]
  if (!provider) return NextResponse.json({ error: 'Unknown provider' }, { status: 400 })

  const session = await getSession()
  const token = await getValidToken(session, id, provider)
  if (!token) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const date = syncDate ?? new Date().toISOString().split('T')[0]

  const userId = await getSupabaseUserId()
  if (userId && endpointKey !== 'sync') {
    const cached = await getCachedMetrics(userId, id, period, endpointKey!, date)
    if (cached) return NextResponse.json({ metrics: cached, fromCache: true })
  }

  const endpoint = provider.dataEndpoints.find(e => e.key === endpointKey)
  if (!endpoint) return NextResponse.json({ error: 'Unknown endpoint' }, { status: 400 })
  // const { fitbitPeriod, startDate, anchorDate } = resolvePeriod(period, date, shift)
  const { fitbitPeriod, anchorDate } = resolvePeriod(period, date, shift)
  let { startDate } = resolvePeriod(period, date, shift)
  // Skip activityLog for comparison fetches — Fitbit rejects shifted date queries
  if (endpointKey === 'activityLog' && period !== 'day') {
    return NextResponse.json({ metrics: [] })
  }

  // Cap sleep range to 100 days max (Fitbit API limit)
  if (endpointKey === 'sleep' && period === '1y') {
    const cappedStart = new Date(anchorDate)
    cappedStart.setDate(cappedStart.getDate() - 99)
    startDate = cappedStart.toISOString().split('T')[0]
  }

  const syncMs = new Date(anchorDate).getTime()
  const startUnix = Math.floor((syncMs - 86400000) / 1000)
  const endUnix = Math.floor((syncMs + 86400000) / 1000)

  const useTimeseries = period !== 'day' && !!endpoint.timeseriesUrl
  const rawUrl = useTimeseries ? endpoint.timeseriesUrl! : endpoint.url

  const url = rawUrl
    .replace(/SYNC_DATE/g, anchorDate)
    .replace(/UNIX_START/g, String(startUnix))
    .replace(/UNIX_END/g, String(endUnix))
    .replace(/PERIOD_START/g, startDate)
    .replace(/PERIOD/g, fitbitPeriod)

  const headers: Record<string, string> =
    id === 'ultrahuman'
      ? {
          Authorization: `Bearer ${process.env.ULTRAHUMAN_AUTH_TOKEN}`,
          'X-Partner-Id': process.env.ULTRAHUMAN_PARTNER_ID!,
          'X-User-Email': token,
        }
      : { Authorization: `Bearer ${token}` }

  const dataRes = await fetch(url, { headers })
  if (!dataRes.ok) return NextResponse.json({ error: 'Fetch failed', status: dataRes.status }, { status: dataRes.status })

    const raw = await dataRes.json()
    if (userId && endpointKey !== 'sync') {
      await setCachedMetrics(userId, id, period, endpointKey!, date, endpoint.transform(raw, period))
    }
  
    // ── Saathi wearable sync ──────────────────────────────────
    if (userId && id === 'fitbit' && period === 'day' && endpointKey !== 'sync' && endpointKey !== 'activityLog') {
      const SAATHI_API = process.env.SAATHI_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'
      console.log('🔵 Wearable sync firing — userId:', userId, 'date:', anchorDate, 'api:', SAATHI_API)
      const metricsFlat = Object.fromEntries(
        endpoint.transform(raw, 'day').map((m: any) => [m.key, m.value])
      )
      fetch(`${SAATHI_API}/ingest/wearable`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, date: anchorDate, data: metricsFlat }),
      }).then(r => console.log('🟢 Wearable sync response:', r.status))
        .catch(e => console.log('🔴 Wearable sync failed:', e.message))
    }
    // Backfill historical snapshots from timeseries data
    if (userId && id === 'fitbit' && period !== 'day' && endpointKey !== 'activityLog' && endpointKey !== 'sync') {
      const transformed = endpoint.transform(raw, period)
      const m = transformed[0]
      if (m) {
        const SAATHI_API = process.env.SAATHI_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'
        fetch(`${SAATHI_API}/ingest/wearable/period`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: userId,
            period,
            sync_date: anchorDate,
            metric_key: m.key,
            avg: m.avg, min: m.min, max: m.max, trend: m.trend,
          }),
        }).catch(() => {})
      }
    }

    return NextResponse.json({ metrics: endpoint.transform(raw, period) })
}