import { ProviderConfig } from './types'

export const ultrahumanProvider: ProviderConfig = {
  id: 'ultrahuman',
  name: 'Ultrahuman',
  icon: '💍',
  clientId: process.env.ULTRAHUMAN_PARTNER_ID!,
  clientSecret: process.env.ULTRAHUMAN_AUTH_TOKEN!,
  // Ultrahuman uses token-based auth, not full OAuth
  // The authUrl below handles the user email linkage
  authUrl: 'https://partner.ultrahuman.com/api/v1/auth',
  tokenUrl: 'https://partner.ultrahuman.com/api/v1/auth/token',
  scopes: [],
  dataEndpoints: [
    {
      key: 'sync',
      label: 'Last Sync',
      url: 'https://partner.ultrahuman.com/api/v1/metrics?date=SYNC_DATE',
      transform: (data) => [{
        key: 'lastSync',
        label: 'Last Sync',
        value: data?.date ? new Date(data.date).toISOString() : 'never',
        unit: '',
        date: data?.date ?? '',
        category: 'activity'
      }]
    },
    {
      key: 'recovery',
      label: 'Recovery',
      url: 'https://partner.ultrahuman.com/api/v1/metrics?date=SYNC_DATE',
      transform: (data) => [
        {
          key: 'recoveryScore',
          label: 'Recovery Score',
          value: data?.recovery_score ?? '—',
          unit: '/100',
          date: data?.date ?? '',
          category: 'recovery'
        },
        {
          key: 'movementIndex',
          label: 'Movement Index',
          value: data?.movement_index ?? '—',
          unit: '/100',
          date: data?.date ?? '',
          category: 'activity'
        },
      ]
    },
    {
      key: 'sleep',
      label: 'Sleep',
      url: 'https://partner.ultrahuman.com/api/v1/metrics?date=SYNC_DATE',
      transform: (data) => {
        const sleep = data?.sleep
        return [
          {
            key: 'sleepScore',
            label: 'Sleep Score',
            value: sleep?.score ?? '—',
            unit: '/100',
            date: data?.date ?? '',
            category: 'sleep'
          },
          {
            key: 'sleepDuration',
            label: 'Sleep Duration',
            value: sleep?.total_duration
              ? (sleep.total_duration / 60).toFixed(1)
              : '—',
            unit: 'hrs',
            date: data?.date ?? '',
            category: 'sleep'
          },
          {
            key: 'deepSleep',
            label: 'Deep Sleep',
            value: sleep?.deep_sleep_duration
              ? (sleep.deep_sleep_duration / 60).toFixed(1)
              : '—',
            unit: 'hrs',
            date: data?.date ?? '',
            category: 'sleep'
          },
          {
            key: 'remSleep',
            label: 'REM Sleep',
            value: sleep?.rem_duration
              ? (sleep.rem_duration / 60).toFixed(1)
              : '—',
            unit: 'hrs',
            date: data?.date ?? '',
            category: 'sleep'
          },
          {
            key: 'sleepEfficiency',
            label: 'Sleep Efficiency',
            value: sleep?.efficiency ?? '—',
            unit: '%',
            date: data?.date ?? '',
            category: 'sleep'
          },
        ]
      }
    },
    {
      key: 'heartrate',
      label: 'Heart Rate',
      url: 'https://partner.ultrahuman.com/api/v1/metrics?date=SYNC_DATE',
      transform: (data) => [
        {
          key: 'hrv',
          label: 'HRV',
          value: data?.hrv ?? '—',
          unit: 'ms',
          date: data?.date ?? '',
          category: 'heart'
        },
        {
          key: 'restingHR',
          label: 'Resting Heart Rate',
          value: data?.resting_heart_rate ?? '—',
          unit: 'bpm',
          date: data?.date ?? '',
          category: 'heart'
        },
        {
          key: 'skinTemp',
          label: 'Skin Temperature',
          value: data?.skin_temperature ?? '—',
          unit: '°C',
          date: data?.date ?? '',
          category: 'body'
        },
      ]
    },
  ]
}