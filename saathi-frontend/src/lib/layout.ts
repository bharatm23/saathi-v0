import { HealthMetric, Period } from './providers/types'

export type ChartType = 'line' | 'bar' | 'stat' | 'hidden'

export interface MetricLayout {
  metric: HealthMetric
  chartType: ChartType
  size: 'small' | 'large'
  priority: number
}

export interface SectionLayout {
  category: string
  label: string
  color: string
  metrics: MetricLayout[]
  visible: boolean
}

export interface DashboardConfig {
  sections: SectionLayout[]
  statsBar: HealthMetric[]
  availablePeriods: Period[]
  isEmpty: boolean
}

const CATEGORY_META: Record<string, { label: string; color: string; priority: number }> = {
  activity: { label: 'Activity',  color: '#E8E0D0', priority: 1 },
  heart:    { label: 'Heart',     color: '#F0E8E8', priority: 2 },
  sleep:    { label: 'Sleep',     color: '#E8E8F0', priority: 3 },
  body:     { label: 'Body',      color: '#E8F0E8', priority: 4 },
  recovery: { label: 'Recovery',  color: '#F0EDE8', priority: 5 },
}

const STATS_BAR_KEYS = ['weight', 'restingHR', 'steps', 'sleepDuration', 'recoveryScore']
const LARGE_WHEN_CHART = ['steps', 'distance', 'sleepDuration', 'restingHR', 'calories']

function resolveChartType(metric: HealthMetric, period: Period): ChartType {
  if (period === 'day') return 'stat'
  const points = metric.dataPoints ?? []
  if (points.length >= 7) return metric.category === 'sleep' ? 'bar' : 'line'
  if (metric.avg && metric.avg !== '—') return 'stat'
  return 'hidden'
}

function hasData(m: HealthMetric): boolean {
  return m.value !== '—' && m.value !== 0 && m.value !== '' &&
    m.value !== null && m.avg !== '—'
}

export function buildDashboardConfig(
  metrics: HealthMetric[],
  period: Period
): DashboardConfig {
  if (metrics.length === 0) {
    return { sections: [], statsBar: [], availablePeriods: ['day'], isEmpty: true }
  }

  // Deduplicate by key — use deduped everywhere below
  const seen = new Set<string>()
  const deduped = metrics.filter(m => {
    if (seen.has(m.key)) return false
    seen.add(m.key)
    return true
  })

  // Stats bar — uses deduped
  const statsBar = STATS_BAR_KEYS
    .map(key => deduped.find(m => m.key === key))
    .filter((m): m is HealthMetric => !!m && hasData(m))

  // Group by category — uses deduped
  const byCategory = deduped.reduce((acc, m) => {
    if (!acc[m.category]) acc[m.category] = []
    acc[m.category].push(m)
    return acc
  }, {} as Record<string, HealthMetric[]>)

  const sections: SectionLayout[] = Object.entries(byCategory)
    .map(([category, catMetrics]) => {
      const meta = CATEGORY_META[category] ?? { label: category, color: '#E8E0D0', priority: 99 }
      const metricLayouts: MetricLayout[] = catMetrics
        .map(m => {
          const chartType = resolveChartType(m, period)
          const isLarge = LARGE_WHEN_CHART.includes(m.key) && chartType === 'line'
          return {
            metric: m,
            chartType,
            size: (isLarge ? 'large' : 'small') as 'large' | 'small',
            priority: hasData(m) ? 0 : 1,
          }
        })
        .filter(ml => ml.chartType !== 'hidden')
        .sort((a, b) => a.priority - b.priority)

      return {
        category,
        label: meta.label,
        color: meta.color,
        metrics: metricLayouts,
        visible: metricLayouts.some(ml => hasData(ml.metric)),
      }
    })
    .filter(s => s.visible)
    .sort((a, b) =>
      (CATEGORY_META[a.category]?.priority ?? 99) -
      (CATEGORY_META[b.category]?.priority ?? 99)
    )

  // Which periods have data — uses deduped
  const availablePeriods: Period[] = ['day']
  if (deduped.some(m => (m.dataPoints?.length ?? 0) >= 7)) availablePeriods.push('30d')
  if (deduped.some(m => (m.dataPoints?.length ?? 0) >= 30)) availablePeriods.push('1y')

  return {
    sections,
    statsBar,
    availablePeriods,
    isEmpty: sections.length === 0,
  }
}

export function buildInsightsSummary(
  metrics: HealthMetric[],
  period: Period
): string {
  const lines = metrics
    .filter(hasData)
    .map(m => {
      if (period === 'day') return m.label + ': ' + m.value + ' ' + m.unit
      return m.label + ': avg ' + m.avg + ' ' + m.unit + ', min ' + m.min + ', max ' + m.max + ', trend ' + (m.trend ?? 'stable')
    })
  return lines.join('\n')
}