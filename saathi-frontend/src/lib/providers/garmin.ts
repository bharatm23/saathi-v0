import { ProviderConfig } from './types'

export const garminProvider: ProviderConfig = {
  id: 'garmin',
  name: 'Garmin',
  icon: '⌚',
  clientId: process.env.GARMIN_CLIENT_ID!,
  clientSecret: process.env.GARMIN_CLIENT_SECRET!,
  authUrl: 'https://connect.garmin.com/oauth2/authorize',
  tokenUrl: 'https://connect.garmin.com/oauth2/token',
  scopes: [],  // Garmin uses no explicit scopes — access is controlled by the partnership agreement
  dataEndpoints: [
    {
      key: 'sync',
      label: 'User Info',
      url: 'https://apis.garmin.com/wellness-api/rest/user/id',
      transform: (data) => [{
        key: 'lastSync',
        label: 'Last Sync',
        value: new Date().toISOString(), // Garmin pushes via webhooks — connection time = synced
        unit: '',
        date: new Date().toISOString(),
        category: 'activity'
      }]
    },
    {
      key: 'activities',
      label: 'Activities',
      url: 'https://apis.garmin.com/wellness-api/rest/activities?uploadStartTimeInSeconds=UNIX_START&uploadEndTimeInSeconds=UNIX_END',
      transform: (data) => {
        const activities = Array.isArray(data) ? data : []
        const latest = activities[0]
        return [
          {
            key: 'activityType',
            label: 'Last Activity',
            value: latest?.activityType ?? '—',
            unit: '',
            date: latest?.startTimeLocal ?? '',
            category: 'activity'
          },
          {
            key: 'steps',
            label: 'Steps',
            value: latest?.steps ?? '—',
            unit: 'steps',
            date: latest?.startTimeLocal ?? '',
            category: 'activity'
          },
          {
            key: 'distance',
            label: 'Distance',
            value: latest?.distanceInMeters
              ? (latest.distanceInMeters / 1000).toFixed(2)
              : '—',
            unit: 'km',
            date: latest?.startTimeLocal ?? '',
            category: 'activity'
          },
          {
            key: 'duration',
            label: 'Duration',
            value: latest?.durationInSeconds
              ? Math.round(latest.durationInSeconds / 60)
              : '—',
            unit: 'min',
            date: latest?.startTimeLocal ?? '',
            category: 'activity'
          },
          {
            key: 'calories',
            label: 'Calories',
            value: latest?.activeKilocalories ?? '—',
            unit: 'kcal',
            date: latest?.startTimeLocal ?? '',
            category: 'activity'
          },
        ]
      }
    },
    {
      key: 'heartrate',
      label: 'Heart Rate',
      url: 'https://apis.garmin.com/wellness-api/rest/dailies?uploadStartTimeInSeconds=UNIX_START&uploadEndTimeInSeconds=UNIX_END',
      transform: (data) => {
        const dailies = Array.isArray(data) ? data : []
        const latest = dailies[0]
        return [
          {
            key: 'restingHR',
            label: 'Resting Heart Rate',
            value: latest?.restingHeartRateInBeatsPerMinute ?? '—',
            unit: 'bpm',
            date: latest?.calendarDate ?? '',
            category: 'heart'
          },
          {
            key: 'maxHR',
            label: 'Max Heart Rate',
            value: latest?.maxHeartRateInBeatsPerMinute ?? '—',
            unit: 'bpm',
            date: latest?.calendarDate ?? '',
            category: 'heart'
          },
          {
            key: 'avgStress',
            label: 'Avg Stress Level',
            value: latest?.averageStressLevel ?? '—',
            unit: '/100',
            date: latest?.calendarDate ?? '',
            category: 'recovery'
          },
          {
            key: 'bodyBattery',
            label: 'Body Battery',
            value: latest?.bodyBatteryHighestValue ?? '—',
            unit: '/100',
            date: latest?.calendarDate ?? '',
            category: 'recovery'
          },
        ]
      }
    },
    {
      key: 'sleep',
      label: 'Sleep',
      url: 'https://apis.garmin.com/wellness-api/rest/sleeps?uploadStartTimeInSeconds=UNIX_START&uploadEndTimeInSeconds=UNIX_END',
      transform: (data) => {
        const sleeps = Array.isArray(data) ? data : []
        const latest = sleeps[0]
        return [
          {
            key: 'sleepDuration',
            label: 'Sleep Duration',
            value: latest?.durationInSeconds
              ? (latest.durationInSeconds / 3600).toFixed(1)
              : '—',
            unit: 'hrs',
            date: latest?.calendarDate ?? '',
            category: 'sleep'
          },
          {
            key: 'deepSleep',
            label: 'Deep Sleep',
            value: latest?.deepSleepDurationInSeconds
              ? (latest.deepSleepDurationInSeconds / 3600).toFixed(1)
              : '—',
            unit: 'hrs',
            date: latest?.calendarDate ?? '',
            category: 'sleep'
          },
          {
            key: 'remSleep',
            label: 'REM Sleep',
            value: latest?.remSleepInSeconds
              ? (latest.remSleepInSeconds / 3600).toFixed(1)
              : '—',
            unit: 'hrs',
            date: latest?.calendarDate ?? '',
            category: 'sleep'
          },
          {
            key: 'awakeDuration',
            label: 'Awake Time',
            value: latest?.awakeDurationInSeconds
              ? Math.round(latest.awakeDurationInSeconds / 60)
              : '—',
            unit: 'min',
            date: latest?.calendarDate ?? '',
            category: 'sleep'
          },
        ]
      }
    },
  ]
}