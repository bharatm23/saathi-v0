import { HealthMetric } from './providers/types'

export interface PlaygroundScenario {
  id: string
  label: string
  description: string
  metrics: HealthMetric[]
}

function makePoints(dates: string[], values: number[]) {
  return dates.map((date, i) => ({ date, value: values[i] }))
}

// Generate 30 days of dates ending today
function last30Days(): string[] {
  return Array.from({ length: 30 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (29 - i))
    return d.toISOString().split('T')[0]
  })
}

const dates = last30Days()

// Helper: avg of array
const avg = (arr: number[], dec = 0) =>
  (arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(dec)

export const PLAYGROUND_SCENARIOS: PlaygroundScenario[] = [
  // ─── Heavy Gym / Strength ─────────────────────────────────
  {
    id: 'heavy-gym',
    label: 'Heavy gym month',
    description: 'Lifting 5x/week, high calories burned, lower cardio steps',
    metrics: (() => {
      const steps    = [4200,3800,5100,4400,3900,4100,8200,4300,3700,5200,4100,3800,4600,8100,4200,3900,5300,4400,3600,4800,8300,4100,3700,5100,4200,3900,4700,8200,4000,3800]
      const calories = [2800,2750,2900,2820,2780,2700,3100,2850,2720,2950,2830,2760,2880,3050,2800,2740,2920,2860,2700,2830,3080,2790,2710,2900,2810,2750,2860,3020,2770,2730]
      const distance = [3.1,2.8,3.9,3.3,2.9,3.0,6.2,3.2,2.7,3.8,3.0,2.8,3.4,6.0,3.1,2.9,4.0,3.3,2.6,3.5,6.3,3.0,2.7,3.7,3.1,2.9,3.5,6.1,2.9,2.8]
      const active   = [45,42,55,48,40,38,85,46,39,58,44,40,50,82,45,41,57,47,37,52,88,43,38,55,44,41,51,84,41,40]
      const hr       = [52,52,53,52,51,52,54,52,51,53,52,51,52,54,52,51,53,52,51,52,55,52,51,53,52,51,52,54,52,51]
      const sleep    = [7.2,7.5,7.1,7.8,6.9,8.1,7.4,7.3,7.6,7.0,7.8,7.2,7.5,7.3,7.1,7.9,7.0,7.6,7.2,7.4,7.3,7.0,7.8,7.1,7.5,7.2,7.4,7.3,7.1,7.6]
      const weight   = [78.2,78.0,77.9,77.8,77.8,77.7,77.6,77.5,77.5,77.4,77.3,77.3,77.2,77.1,77.1,77.0,76.9,76.9,76.8,76.8,76.7,76.7,76.6,76.5,76.5,76.4,76.4,76.3,76.3,76.2]
      return [
        { key: 'steps', label: 'Steps', value: steps[29], unit: 'steps/day', date: '', category: 'activity', avg: avg(steps), min: String(Math.min(...steps)), max: String(Math.max(...steps)), trend: 'stable', dataPoints: makePoints(dates, steps) },
        { key: 'calories', label: 'Calories Burned', value: calories[29], unit: 'kcal/day', date: '', category: 'activity', avg: avg(calories), min: String(Math.min(...calories)), max: String(Math.max(...calories)), trend: 'stable', dataPoints: makePoints(dates, calories) },
        { key: 'distance', label: 'Distance', value: distance[29], unit: 'km/day', date: '', category: 'activity', avg: avg(distance, 1), min: String(Math.min(...distance)), max: String(Math.max(...distance)), trend: 'stable', dataPoints: makePoints(dates, distance) },
        { key: 'activeMinutes', label: 'Active Minutes', value: active[29], unit: 'min/day', date: '', category: 'activity', avg: avg(active), min: String(Math.min(...active)), max: String(Math.max(...active)), trend: 'up', dataPoints: makePoints(dates, active) },
        { key: 'restingHR', label: 'Resting Heart Rate', value: hr[29], unit: 'bpm', date: '', category: 'heart', avg: avg(hr), min: String(Math.min(...hr)), max: String(Math.max(...hr)), trend: 'down', dataPoints: makePoints(dates, hr) },
        { key: 'sleepDuration', label: 'Sleep Duration', value: sleep[29], unit: 'hrs/night', date: '', category: 'sleep', avg: avg(sleep, 1), min: String(Math.min(...sleep)), max: String(Math.max(...sleep)), trend: 'stable', dataPoints: makePoints(dates, sleep) },
        { key: 'weight', label: 'Weight', value: weight[29], unit: 'kg', date: '', category: 'body', avg: avg(weight, 1), min: String(Math.min(...weight)), max: String(Math.max(...weight)), trend: 'down', dataPoints: makePoints(dates, weight) },
      ] as HealthMetric[]
    })(),
  },

  // ─── Heavy Cardio ─────────────────────────────────────────
  {
    id: 'heavy-cardio',
    label: 'Heavy cardio month',
    description: 'Running & cycling daily, high steps, strong heart metrics',
    metrics: (() => {
      const steps    = [11200,12400,9800,13100,10500,14200,8900,11800,12600,10200,13400,11100,12800,9600,13700,11400,12200,10800,13900,11600,12100,10400,13200,11900,12500,10700,13600,11300,12000,10900]
      const calories = [3200,3450,3050,3600,3150,3700,2950,3300,3500,3100,3650,3250,3480,3000,3720,3280,3420,3180,3750,3320,3400,3130,3580,3350,3460,3200,3700,3290,3380,3160]
      const distance = [8.4,9.3,7.4,9.9,7.9,10.7,6.7,8.9,9.5,7.7,10.1,8.3,9.6,7.2,10.3,8.6,9.2,8.1,10.5,8.7,9.1,7.8,9.8,8.9,9.3,8.0,10.2,8.5,9.0,8.2]
      const active   = [68,75,58,82,64,88,54,71,78,62,84,67,76,56,86,69,74,65,89,70,73,63,81,72,77,64,85,68,72,66]
      const hr       = [48,47,49,46,48,45,49,47,46,48,45,47,46,49,44,47,46,48,44,46,47,49,45,46,47,48,44,47,46,48]
      const sleep    = [7.8,8.0,7.5,8.2,7.6,8.4,7.3,7.9,8.1,7.5,8.3,7.8,8.0,7.4,8.5,7.7,7.9,7.6,8.6,7.8,7.9,7.5,8.2,7.9,8.0,7.6,8.4,7.7,7.9,7.6]
      const weight   = [72.1,71.9,71.8,71.6,71.5,71.3,71.2,71.1,70.9,70.8,70.7,70.5,70.4,70.3,70.2,70.0,69.9,69.8,69.7,69.6,69.5,69.4,69.3,69.2,69.1,69.0,68.9,68.8,68.7,68.6]
      return [
        { key: 'steps', label: 'Steps', value: steps[29], unit: 'steps/day', date: '', category: 'activity', avg: avg(steps), min: String(Math.min(...steps)), max: String(Math.max(...steps)), trend: 'stable', dataPoints: makePoints(dates, steps) },
        { key: 'calories', label: 'Calories Burned', value: calories[29], unit: 'kcal/day', date: '', category: 'activity', avg: avg(calories), min: String(Math.min(...calories)), max: String(Math.max(...calories)), trend: 'stable', dataPoints: makePoints(dates, calories) },
        { key: 'distance', label: 'Distance', value: distance[29], unit: 'km/day', date: '', category: 'activity', avg: avg(distance, 1), min: String(Math.min(...distance)), max: String(Math.max(...distance)), trend: 'stable', dataPoints: makePoints(dates, distance) },
        { key: 'activeMinutes', label: 'Active Minutes', value: active[29], unit: 'min/day', date: '', category: 'activity', avg: avg(active), min: String(Math.min(...active)), max: String(Math.max(...active)), trend: 'up', dataPoints: makePoints(dates, active) },
        { key: 'restingHR', label: 'Resting Heart Rate', value: hr[29], unit: 'bpm', date: '', category: 'heart', avg: avg(hr), min: String(Math.min(...hr)), max: String(Math.max(...hr)), trend: 'down', dataPoints: makePoints(dates, hr) },
        { key: 'sleepDuration', label: 'Sleep Duration', value: sleep[29], unit: 'hrs/night', date: '', category: 'sleep', avg: avg(sleep, 1), min: String(Math.min(...sleep)), max: String(Math.max(...sleep)), trend: 'stable', dataPoints: makePoints(dates, sleep) },
        { key: 'weight', label: 'Weight', value: weight[29], unit: 'kg', date: '', category: 'body', avg: avg(weight, 1), min: String(Math.min(...weight)), max: String(Math.max(...weight)), trend: 'down', dataPoints: makePoints(dates, weight) },
      ] as HealthMetric[]
    })(),
  },

  // ─── Light Walks ──────────────────────────────────────────
  {
    id: 'light-walks',
    label: 'Light walk month',
    description: '30-min daily walks, moderate activity, balanced recovery',
    metrics: (() => {
      const steps    = [6800,7100,6500,7300,6900,7200,6600,7000,7400,6700,7100,6800,7200,6500,7300,6900,7000,6700,7200,6800,7100,6600,7300,6900,7000,6800,7200,6700,7100,6900]
      const calories = [2100,2150,2080,2180,2120,2160,2090,2140,2190,2100,2150,2110,2160,2080,2180,2120,2140,2100,2160,2110,2140,2090,2170,2120,2140,2110,2160,2100,2140,2120]
      const distance = [5.1,5.3,4.9,5.5,5.2,5.4,5.0,5.3,5.6,5.1,5.4,5.1,5.4,4.9,5.5,5.2,5.3,5.0,5.4,5.1,5.3,5.0,5.5,5.2,5.3,5.1,5.4,5.0,5.3,5.2]
      const active   = [32,35,30,37,33,36,31,34,38,32,35,33,36,30,37,33,34,31,36,32,34,31,37,33,35,32,36,32,34,33]
      const hr       = [62,63,62,63,62,62,63,62,62,63,62,62,63,62,63,62,63,62,62,63,62,62,63,62,63,62,62,63,62,62]
      const sleep    = [7.0,7.2,6.9,7.3,7.1,7.2,7.0,7.1,7.3,7.0,7.2,7.0,7.2,6.9,7.3,7.1,7.1,7.0,7.2,7.0,7.1,7.0,7.3,7.1,7.2,7.0,7.2,7.0,7.1,7.1]
      const weight   = [75.0,75.0,75.1,74.9,75.0,75.0,75.1,74.9,75.0,75.0,75.0,75.1,74.9,75.0,75.0,75.0,75.1,74.9,75.0,75.0,75.0,75.1,74.9,75.0,75.0,75.0,75.0,75.1,74.9,75.0]
      return [
        { key: 'steps', label: 'Steps', value: steps[29], unit: 'steps/day', date: '', category: 'activity', avg: avg(steps), min: String(Math.min(...steps)), max: String(Math.max(...steps)), trend: 'stable', dataPoints: makePoints(dates, steps) },
        { key: 'calories', label: 'Calories Burned', value: calories[29], unit: 'kcal/day', date: '', category: 'activity', avg: avg(calories), min: String(Math.min(...calories)), max: String(Math.max(...calories)), trend: 'stable', dataPoints: makePoints(dates, calories) },
        { key: 'distance', label: 'Distance', value: distance[29], unit: 'km/day', date: '', category: 'activity', avg: avg(distance, 1), min: String(Math.min(...distance)), max: String(Math.max(...distance)), trend: 'stable', dataPoints: makePoints(dates, distance) },
        { key: 'activeMinutes', label: 'Active Minutes', value: active[29], unit: 'min/day', date: '', category: 'activity', avg: avg(active), min: String(Math.min(...active)), max: String(Math.max(...active)), trend: 'stable', dataPoints: makePoints(dates, active) },
        { key: 'restingHR', label: 'Resting Heart Rate', value: hr[29], unit: 'bpm', date: '', category: 'heart', avg: avg(hr), min: String(Math.min(...hr)), max: String(Math.max(...hr)), trend: 'stable', dataPoints: makePoints(dates, hr) },
        { key: 'sleepDuration', label: 'Sleep Duration', value: sleep[29], unit: 'hrs/night', date: '', category: 'sleep', avg: avg(sleep, 1), min: String(Math.min(...sleep)), max: String(Math.max(...sleep)), trend: 'stable', dataPoints: makePoints(dates, sleep) },
        { key: 'weight', label: 'Weight', value: weight[29], unit: 'kg', date: '', category: 'body', avg: avg(weight, 1), min: String(Math.min(...weight)), max: String(Math.max(...weight)), trend: 'stable', dataPoints: makePoints(dates, weight) },
      ] as HealthMetric[]
    })(),
  },

  // ─── Sedentary ────────────────────────────────────────────
  {
    id: 'sedentary',
    label: 'Sedentary month',
    description: 'Desk work, minimal movement — a wake-up call',
    metrics: (() => {
      const steps    = [2100,1800,2400,1900,2200,1700,2300,2000,1800,2500,1900,2100,1700,2300,2000,1800,2400,1900,2100,1700,2300,2000,1800,2500,1900,2000,1700,2300,2100,1900]
      const calories = [1650,1600,1680,1610,1660,1590,1670,1620,1600,1690,1610,1650,1590,1670,1620,1600,1680,1610,1650,1590,1670,1620,1600,1690,1610,1620,1590,1670,1650,1610]
      const distance = [1.6,1.4,1.8,1.4,1.7,1.3,1.7,1.5,1.4,1.9,1.4,1.6,1.3,1.7,1.5,1.4,1.8,1.4,1.6,1.3,1.7,1.5,1.4,1.9,1.4,1.5,1.3,1.7,1.6,1.4]
      const active   = [8,6,10,7,9,5,9,7,6,11,7,8,5,9,7,6,10,7,8,5,9,7,6,11,7,7,5,9,8,7]
      const hr       = [74,75,74,76,75,76,75,74,76,74,75,76,75,74,76,75,74,76,75,74,76,75,74,74,75,76,75,74,75,76]
      const sleep    = [5.8,5.5,6.1,5.6,5.9,5.4,6.0,5.7,5.5,6.2,5.6,5.8,5.4,6.0,5.7,5.5,6.1,5.6,5.8,5.4,6.0,5.7,5.5,6.2,5.6,5.7,5.4,6.0,5.8,5.6]
      const weight   = [82.0,82.1,82.2,82.3,82.3,82.4,82.5,82.5,82.6,82.7,82.7,82.8,82.9,82.9,83.0,83.1,83.1,83.2,83.3,83.3,83.4,83.5,83.5,83.6,83.7,83.7,83.8,83.9,83.9,84.0]
      return [
        { key: 'steps', label: 'Steps', value: steps[29], unit: 'steps/day', date: '', category: 'activity', avg: avg(steps), min: String(Math.min(...steps)), max: String(Math.max(...steps)), trend: 'stable', dataPoints: makePoints(dates, steps) },
        { key: 'calories', label: 'Calories Burned', value: calories[29], unit: 'kcal/day', date: '', category: 'activity', avg: avg(calories), min: String(Math.min(...calories)), max: String(Math.max(...calories)), trend: 'stable', dataPoints: makePoints(dates, calories) },
        { key: 'distance', label: 'Distance', value: distance[29], unit: 'km/day', date: '', category: 'activity', avg: avg(distance, 1), min: String(Math.min(...distance)), max: String(Math.max(...distance)), trend: 'stable', dataPoints: makePoints(dates, distance) },
        { key: 'activeMinutes', label: 'Active Minutes', value: active[29], unit: 'min/day', date: '', category: 'activity', avg: avg(active), min: String(Math.min(...active)), max: String(Math.max(...active)), trend: 'down', dataPoints: makePoints(dates, active) },
        { key: 'restingHR', label: 'Resting Heart Rate', value: hr[29], unit: 'bpm', date: '', category: 'heart', avg: avg(hr), min: String(Math.min(...hr)), max: String(Math.max(...hr)), trend: 'up', dataPoints: makePoints(dates, hr) },
        { key: 'sleepDuration', label: 'Sleep Duration', value: sleep[29], unit: 'hrs/night', date: '', category: 'sleep', avg: avg(sleep, 1), min: String(Math.min(...sleep)), max: String(Math.max(...sleep)), trend: 'down', dataPoints: makePoints(dates, sleep) },
        { key: 'weight', label: 'Weight', value: weight[29], unit: 'kg', date: '', category: 'body', avg: avg(weight, 1), min: String(Math.min(...weight)), max: String(Math.max(...weight)), trend: 'up', dataPoints: makePoints(dates, weight) },
      ] as HealthMetric[]
    })(),
  },
]

export function getScenario(id: string): PlaygroundScenario | null {
  return PLAYGROUND_SCENARIOS.find(s => s.id === id) ?? null
}