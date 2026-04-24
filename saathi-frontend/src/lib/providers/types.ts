export interface ProviderConfig {
  id: string
  name: string
  icon: string
  clientId: string
  clientSecret: string
  authUrl: string
  tokenUrl: string
  scopes: string[]
  dataEndpoints: DataEndpoint[]
}

export interface DataEndpoint {
  key: string
  label: string
  url: string
  timeseriesUrl?: string
  transform: (data: any, period?: Period) => HealthMetric[]
}

export type Period = 'day' | '30d' | '1y'

export interface HealthMetric {
  key: string
  label: string
  value: number | string
  unit: string
  date: string
  category: 'activity' | 'sleep' | 'recovery' | 'heart' | 'body'
  avg?: string
  min?: string
  max?: string
  trend?: 'up' | 'down' | 'stable'
  dataPoints?: { date: string; value: number }[]
  extra?: any
}

export interface StoredTokens {
  accessToken: string
  refreshToken: string
  expiresAt: number
}