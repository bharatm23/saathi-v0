// src/lib/db.ts
import { createClient } from '@supabase/supabase-js'
import { getSession } from '@/lib/session'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const TTL_HOURS: Record<string, number> = { day: 2, '30d': 24, '1y': 48 }

function isStale(cachedAt: string, ttlHours: number): boolean {
  return (Date.now() - new Date(cachedAt).getTime()) > ttlHours * 3600 * 1000
}

export async function getCachedMetrics(
  userId: string, provider: string, period: string,
  endpointKey: string, syncDate: string
) {
  const ttl = TTL_HOURS[period] ?? 24
  const { data } = await supabase
    .from('wearable_syncs')
    .select('data, upload_timestamp')
    .eq('user_id', userId).eq('provider', provider)
    .eq('endpoint_key', endpointKey).eq('period', period)
    .eq('sync_date', syncDate)
    .single()

  if (!data) return null
  if (isStale(data.upload_timestamp, ttl)) return null
  return data.data
}

export async function setCachedMetrics(
  userId: string, provider: string, period: string,
  endpointKey: string, syncDate: string, metrics: any
) {
  await supabase.from('wearable_syncs').upsert({
    user_id: userId, provider, endpoint_key: endpointKey,
    period, sync_date: syncDate, data: metrics, upload_timestamp: new Date().toISOString()
  }, { onConflict: 'user_id,provider,endpoint_key,period,sync_date' })
}

export async function getCachedLLM(userId: string, cacheKey: string) {
  const { data } = await supabase
    .from('llm_cache')
    .select('data, upload_timestamp')
    .eq('user_id', userId).eq('cache_key', cacheKey)
    .single()

  if (!data) return null
  if (isStale(data.upload_timestamp, 24)) return null
  return data.data
}

export async function getSupabaseUserId(): Promise<string | null> {
  // Try Supabase auth cookie first
  const { createServerSupabaseClient } = await import('@/lib/supabase-server')
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) return user.id
  } catch {}
  // Fall back to iron-session userId
  const session = await getSession()
  return session.userId ?? null
}

export async function setCachedLLM(
  userId: string, cacheKey: string, type: string, period: string, result: any
) {
  await supabase.from('llm_cache').upsert({
    user_id: userId, cache_key: cacheKey, type, period,
    data: result, upload_timestamp: new Date().toISOString()
  }, { onConflict: 'user_id,cache_key' })
}

// Legacy stubs (iron-session token storage — keep for OAuth flow)
export async function saveConnection() { return null }
export async function getConnection()  { return null }