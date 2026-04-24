import { ProviderConfig } from './types'

export const whoopProvider: ProviderConfig = {
  id: 'whoop',
  name: 'Whoop',
  icon: '💪',
  clientId: process.env.WHOOP_CLIENT_ID!,
  clientSecret: process.env.WHOOP_CLIENT_SECRET!,
  authUrl: 'https://api.prod.whoop.com/oauth/oauth2/auth',
  tokenUrl: 'https://api.prod.whoop.com/oauth/oauth2/token',
  scopes: ['read:recovery', 'read:sleep', 'read:workout', 'read:profile', 'offline'],
  dataEndpoints: [
    {
      key: 'recovery',
      label: 'Recovery',
      url: 'https://api.prod.whoop.com/developer/v1/recovery?limit=1',
      transform: (data) => [
        { key: 'recoveryScore', label: 'Recovery Score', value: Math.round(data.records?.[0]?.score?.recovery_score ?? 0), unit: '%', date: new Date().toISOString(), category: 'recovery' },
        { key: 'hrv', label: 'HRV', value: Math.round(data.records?.[0]?.score?.hrv_rmssd_milli ?? 0), unit: 'ms', date: new Date().toISOString(), category: 'heart' },
        { key: 'restingHR', label: 'Resting HR', value: Math.round(data.records?.[0]?.score?.resting_heart_rate ?? 0), unit: 'bpm', date: new Date().toISOString(), category: 'heart' },
      ]
    },
  ]
}