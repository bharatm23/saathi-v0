import { Redis } from '@upstash/redis'

const kv = Redis.fromEnv()

import { HealthMetric } from './providers/types'

const TTL = {
  day:  60 * 60 * 6,
  '30d': 60 * 60 * 24,
  '1y':  60 * 60 * 48,
}

export async function saveConnection(
  userId: string,
  provider: string,
  accessToken: string,
  refreshToken: string | null,
  expiresAt: number | null
) {
  await kv.set(
    'conn:' + userId + ':' + provider,
    { accessToken, refreshToken, expiresAt, connectedAt: Date.now() },
    { ex: 60 * 60 * 24 * 365 }
  )
}

export async function getConnection(userId: string, provider: string) {
  return kv.get<{ accessToken: string; refreshToken: string | null; expiresAt: number | null }>(
    'conn:' + userId + ':' + provider
  )
}

export async function getCachedMetrics(
  userId: string,
  provider: string,
  period: string,
  syncDate: string,
  endpoint: string
): Promise<HealthMetric[] | null> {
  return null;
  return kv.get<HealthMetric[]>(
    'metrics:' + userId + ':' + provider + ':' + endpoint + ':' + period + ':' + syncDate
  )
}

export async function setCachedMetrics(
  userId: string,
  provider: string,
  period: string,
  syncDate: string,
  endpoint: string,
  metrics: HealthMetric[]
) {
  return null; 
  const ttl = TTL[period as keyof typeof TTL] ?? TTL.day
  await kv.set(
    'metrics:' + userId + ':' + provider + ':' + endpoint + ':' + period + ':' + syncDate,
    metrics,
    { ex: ttl }
  )
}

export async function getPlaygroundScenario(id: string) {
  return kv.get<any>('playground:' + id)
}

export async function getAllPlaygroundScenarios() {
  const ids = await kv.smembers<string[]>('playground:index') ?? []
  if (!ids.length) return []
  const scenarios = await Promise.all(
    ids.map(id => kv.get<{ id: string; label: string; description: string }>('playground:' + id))
  )
  return scenarios.filter(Boolean) as { id: string; label: string; description: string }[]
}

export async function upsertPlaygroundScenario(
  id: string,
  label: string,
  description: string,
  metrics: any
) {
  await kv.set('playground:' + id, { id, label, description, metrics })
  await kv.sadd('playground:index', id)
}