import { ProviderConfig, Period } from './types'

const today = () => new Date().toISOString().split('T')[0]
const daysAgo = (n: number) => {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().split('T')[0]
}

// Compute avg / min / max / trend from a Fitbit time series array
function summarise(arr: { dateTime: string; value: string }[], decimals = 0) {
  const nums = arr.map(i => parseFloat(i.value)).filter(n => n > 0)
  if (nums.length === 0) return { avg: '—', min: '—', max: '—', trend: 'stable' as const, dataPoints: [] }

  const avg = nums.reduce((a, b) => a + b, 0) / nums.length
  const min = Math.min(...nums)
  const max = Math.max(...nums)

  // trend: compare first half avg vs second half avg
  const mid = Math.floor(nums.length / 2)
  const firstHalf = nums.slice(0, mid).reduce((a, b) => a + b, 0) / (mid || 1)
  const secondHalf = nums.slice(mid).reduce((a, b) => a + b, 0) / (nums.length - mid || 1)
  const diff = secondHalf - firstHalf
  const trend = (diff > firstHalf * 0.03 ? 'up' : diff < -firstHalf * 0.03 ? 'down' : 'stable') as 'up' | 'down' | 'stable'

  const dataPoints = arr
    .map(i => ({ date: i.dateTime, value: parseFloat(i.value) }))
    .filter(p => p.value > 0)

  return {
    avg: avg.toFixed(decimals),
    min: min.toFixed(decimals),
    max: max.toFixed(decimals),
    trend,
    dataPoints,
  }
}

export const fitbitProvider: ProviderConfig = {
  id: 'fitbit',
  name: 'Fitbit',
  icon: '🏃',
  clientId: process.env.FITBIT_CLIENT_ID!,
  clientSecret: process.env.FITBIT_CLIENT_SECRET!,
  authUrl: 'https://www.fitbit.com/oauth2/authorize',
  tokenUrl: 'https://api.fitbit.com/oauth2/token',
  scopes: ['activity', 'heartrate', 'sleep', 'weight', 'profile', 'settings'],
  dataEndpoints: [
    {
      key: 'sync',
      label: 'Device Info',
      url: 'https://api.fitbit.com/1/user/-/devices.json',
      transform: (data) => {
        const device = Array.isArray(data) && data.length > 0 ? data[0] : null
        return [{
          key: 'lastSync',
          label: 'Last Sync',
          value: device?.lastSyncTime ?? 'never',
          unit: '',
          date: device?.lastSyncTime ?? '',
          category: 'activity'
        }]
      }
    },
    {
      key: 'steps',
      label: 'Steps',
      url: 'https://api.fitbit.com/1/user/-/activities/date/SYNC_DATE.json',
      timeseriesUrl: 'https://api.fitbit.com/1/user/-/activities/steps/date/SYNC_DATE/PERIOD.json',
      transform: (data, period) => {
        if (period && period !== 'day') {
          const arr = data['activities-steps'] ?? []
          const s = summarise(arr)
          return [{
            key: 'steps', label: 'Steps', value: s.avg,
            unit: 'steps/day', date: '',
            category: 'activity', ...s
          }]
        }
        return [{
          key: 'steps', label: 'Steps',
          value: data.summary?.steps ?? '—',
          unit: 'steps', date: '',
          category: 'activity'
        }]
      }
    },
    {
      key: 'calories',
      label: 'Calories',
      url: 'https://api.fitbit.com/1/user/-/activities/date/SYNC_DATE.json',
      timeseriesUrl: 'https://api.fitbit.com/1/user/-/activities/calories/date/SYNC_DATE/PERIOD.json',
      transform: (data, period) => {
        if (period && period !== 'day') {
          const arr = data['activities-calories'] ?? []
          const s = summarise(arr)
          return [{
            key: 'calories', label: 'Calories Burned', value: s.avg,
            unit: 'kcal/day', date: '',
            category: 'activity', ...s
          }]
        }
        return [{
          key: 'calories', label: 'Calories Burned',
          value: data.summary?.caloriesOut ?? '—',
          unit: 'kcal', date: '',
          category: 'activity'
        }]
      }
    },
    {
      key: 'distance',
      label: 'Distance',
      url: 'https://api.fitbit.com/1/user/-/activities/date/SYNC_DATE.json',
      timeseriesUrl: 'https://api.fitbit.com/1/user/-/activities/distance/date/SYNC_DATE/PERIOD.json',
      transform: (data, period) => {
        if (period && period !== 'day') {
          const arr = data['activities-distance'] ?? []
          const s = summarise(arr, 2)
          return [{
            key: 'distance', label: 'Distance', value: s.avg,
            unit: 'km/day', date: '',
            category: 'activity', ...s
          }]
        }
        return [{
          key: 'distance', label: 'Distance',
          value: data.summary?.distances?.[0]?.distance?.toFixed(2) ?? '—',
          unit: 'km', date: '',
          category: 'activity'
        }]
      }
    },
    {
      key: 'activeMinutes',
      label: 'Active Minutes',
      url: 'https://api.fitbit.com/1/user/-/activities/date/SYNC_DATE.json',
      timeseriesUrl: 'https://api.fitbit.com/1/user/-/activities/minutesVeryActive/date/SYNC_DATE/PERIOD.json',
      transform: (data, period) => {
        if (period && period !== 'day') {
          const arr = data['activities-minutesVeryActive'] ?? []
          const s = summarise(arr)
          return [{
            key: 'activeMinutes', label: 'Active Minutes', value: s.avg,
            unit: 'min/day', date: '',
            category: 'activity', ...s
          }]
        }
        const active = (data.summary?.veryActiveMinutes ?? 0) + (data.summary?.fairlyActiveMinutes ?? 0)
        return [{
          key: 'activeMinutes', label: 'Active Minutes',
          value: active || '—',
          unit: 'min', date: '',
          category: 'activity'
        }]
      }
    },
    {
      key: 'heartrate',
      label: 'Heart Rate',
      url: 'https://api.fitbit.com/1/user/-/activities/heart/date/SYNC_DATE/1d.json',
      timeseriesUrl: 'https://api.fitbit.com/1/user/-/activities/heart/date/SYNC_DATE/PERIOD.json',
      transform: (data, period) => {
        if (period && period !== 'day') {
          const arr: any[] = data['activities-heart'] ?? []
          const restingArr = arr
            .filter(e => e.value?.restingHeartRate > 0)
            .map(e => ({ dateTime: e.dateTime, value: String(e.value.restingHeartRate) }))
          const s = summarise(restingArr)
          return [{
            key: 'restingHR', label: 'Resting Heart Rate', value: s.avg,
            unit: 'bpm avg', date: '',
            category: 'heart', ...s
          }]
        }
        const entry = data['activities-heart']?.[0]?.value
        const zones = entry?.heartRateZones ?? []
        return [
          {
            key: 'restingHR', label: 'Resting Heart Rate',
            value: entry?.restingHeartRate ?? '—',
            unit: 'bpm', date: '',
            category: 'heart'
          },
          {
            key: 'fatBurnMins', label: 'Fat Burn Zone',
            value: zones.find((z: any) => z.name === 'Fat Burn')?.minutes ?? '—',
            unit: 'min', date: '',
            category: 'heart'
          },
        ]
      }
    },
    {
      key: 'sleep',
      label: 'Sleep',
      url: 'https://api.fitbit.com/1.2/user/-/sleep/date/SYNC_DATE.json',
      timeseriesUrl: 'https://api.fitbit.com/1.2/user/-/sleep/date/PERIOD_START/today.json',
      transform: (data, period) => {
        if (period && period !== 'day') {
          const logs: any[] = data.sleep ?? []
          const durationArr = logs
            .filter(s => s.minutesAsleep > 0)
            .map(s => ({ dateTime: s.dateOfSleep, value: String((s.minutesAsleep / 60).toFixed(2)) }))
          const effArr = logs
            .filter(s => s.efficiency > 0)
            .map(s => ({ dateTime: s.dateOfSleep, value: String(s.efficiency) }))
          const durS = summarise(durationArr, 1)
          const effS = summarise(effArr, 0)
          return [
            {
              key: 'sleepDuration', label: 'Sleep Duration', value: durS.avg,
              unit: 'hrs/night', date: '',
              category: 'sleep', ...durS
            },
            {
              key: 'sleepEfficiency', label: 'Sleep Efficiency', value: effS.avg,
              unit: '% avg', date: '',
              category: 'sleep', ...effS
            },
          ]
        }
        const s = data.sleep?.[0]
        return [
          {
            key: 'sleepDuration', label: 'Sleep Duration',
            value: s ? (s.minutesAsleep / 60).toFixed(1) : '—',
            unit: 'hrs', date: '',
            category: 'sleep'
          },
          {
            key: 'sleepEfficiency', label: 'Sleep Efficiency',
            value: s?.efficiency ?? '—',
            unit: '%', date: '',
            category: 'sleep'
          },
          {
            key: 'deepSleep', label: 'Deep Sleep',
            value: s?.levels?.summary?.deep?.minutes
              ? (s.levels.summary.deep.minutes / 60).toFixed(1) : '—',
            unit: 'hrs', date: '',
            category: 'sleep'
          },
        ]
      }
    },
    {
      key: 'weight',
      label: 'Weight',
      url: 'https://api.fitbit.com/1/user/-/body/weight/date/SYNC_DATE/SYNC_DATE.json',
      timeseriesUrl: 'https://api.fitbit.com/1/user/-/body/weight/date/SYNC_DATE/PERIOD.json',
      transform: (data, period) => {
        if (period && period !== 'day') {
          const arr = data['body-weight'] ?? []
          const s = summarise(arr, 1)
          return [{
            key: 'weight', label: 'Weight', value: s.avg,
            unit: 'kg avg', date: '',
            category: 'body', ...s
          }]
        }
        const w = data['body-weight']?.[0]?.value
        return [{
          key: 'weight', label: 'Weight',
          value: w != null ? parseFloat(w).toFixed(1) : '—',
          unit: 'kg', date: '',
          category: 'body'
        }]
      }
    },
    {
      key: 'activityLog',
      label: 'Activities',
      url: 'https://api.fitbit.com/1/user/-/activities/list.json?beforeDate=SYNC_DATE&sort=desc&offset=0&limit=10',
      timeseriesUrl: 'https://api.fitbit.com/1/user/-/activities/list.json?afterDate=PERIOD_START&beforeDate=SYNC_DATE&sort=desc&offset=0&limit=50',
      transform: (data) => {
        const acts = data?.activities ?? []
        return [{
          key: 'activityLog',
          label: 'Activity Log',
          value: acts.length,
          unit: 'sessions',
          date: '',
          category: 'activity' as const,
          extra: acts.map((a: any) => ({
            name: a.activityName ?? 'Activity',
            date: a.startTime ?? '',
            durationMins: Math.round((a.duration ?? 0) / 60000),
            calories: a.calories ?? 0,
            hr: a.averageHeartRate ?? null,
            steps: a.steps ?? null,
            distanceKm: a.distance ? parseFloat((a.distance / 1000).toFixed(2)) : null,
          }))
        }]
      }
    },
  ]
}