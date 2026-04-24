'use client'
import { useState, useEffect, useCallback } from 'react'
import { tokens, cardStyle } from '@/lib/design-tokens'
import { PLAYGROUND_SCENARIOS } from '@/lib/playground-data'
import { buildDashboardConfig, buildInsightsSummary, DashboardConfig } from '@/lib/layout'
import { HealthMetric, Period } from '@/lib/providers/types'

type DataPoint = { date: string; value: number }

const PERIOD_OPTIONS: { value: Period; label: string }[] = [
  { value: '30d', label: '30 days' },
  { value: 'day', label: 'Last day' },
]

const LOW_THRESHOLDS: Record<string, number> = { steps: 3000, distance: 1.5, activeMinutes: 15, sleepDuration: 6 }
const HIGH_THRESHOLDS: Record<string, number> = { restingHR: 80 }

function isLowPerf(m: HealthMetric): boolean {
  const v = parseFloat(String(m.avg ?? m.value))
  if (isNaN(v)) return false
  if (LOW_THRESHOLDS[m.key]) return v < LOW_THRESHOLDS[m.key]
  if (HIGH_THRESHOLDS[m.key]) return v > HIGH_THRESHOLDS[m.key]
  return false
}

function fmtVal(v: number): string {
  if (v >= 10000) return Math.round(v / 1000) + 'k'
  if (v >= 1000) return (v / 1000).toFixed(1) + 'k'
  if (v % 1 !== 0) return v.toFixed(1)
  return String(v)
}

function threeTicks(vals: number[]): number[] {
  if (!vals.length) return [0, 5, 10]
  const mn = Math.min(...vals), mx = Math.max(...vals)
  if (mn === mx) return [0, mn, mx * 2]
  const mag = Math.pow(10, Math.floor(Math.log10(mx - mn || 1)))
  const snap = (n: number) => Math.round(n / mag) * mag
  return [snap(mn), snap((mn + mx) / 2), snap(mx)]
}

function LineChart({ current }: { current: DataPoint[] }) {
  if (current.length < 2) return <p className="text-xs mt-3" style={{ color: tokens.textLabel }}>Not enough data</p>
  const W = 400, H = 90, PL = 30, PR = 8, PT = 14, PB = 14
  const pW = W - PL - PR, pH = H - PT - PB
  const ticks = threeTicks(current.map(p => p.value))
  const tMn = ticks[0], tMx = ticks[ticks.length - 1], rng = tMx - tMn || 1
  const tx = (i: number) => PL + (i / Math.max(current.length - 1, 1)) * pW
  const ty = (v: number) => PT + pH - Math.min(1, Math.max(0, (v - tMn) / rng)) * pH
  const path = current.map((p, i) => (i === 0 ? 'M' : 'L') + tx(i).toFixed(1) + ',' + ty(p.value).toFixed(1)).join(' ')
  const mxI = current.reduce((mi, p, i) => p.value > current[mi].value ? i : mi, 0)
  const mnI = current.reduce((mi, p, i) => p.value < current[mi].value ? i : mi, 0)
  const anc = (i: number) => i < current.length * 0.15 ? 'start' : i > current.length * 0.85 ? 'end' : 'middle'
  return (
    <div className="w-full mt-3">
      <svg viewBox={'0 0 ' + W + ' ' + H} className="w-full" style={{ height: H, overflow: 'visible' }} preserveAspectRatio="none">
        {ticks.map((t, ti) => (
          <g key={ti}>
            <line x1={PL} y1={ty(t).toFixed(1)} x2={W - PR} y2={ty(t).toFixed(1)} stroke="#E8E4DA" strokeWidth="0.5"/>
            <text x={PL - 4} y={ty(t)} textAnchor="end" dominantBaseline="middle" fontSize="8" fill={tokens.textLabel}>{fmtVal(t)}</text>
          </g>
        ))}
        <path d={path} fill="none" stroke={tokens.textPrimary} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        <circle cx={tx(mxI).toFixed(1)} cy={ty(current[mxI].value).toFixed(1)} r="3" fill={tokens.accentGreen}/>
        <text x={tx(mxI)} y={ty(current[mxI].value) - 6} textAnchor={anc(mxI)} fontSize="7.5" fill={tokens.accentGreen} fontWeight="600">{fmtVal(current[mxI].value)}</text>
        {mxI !== mnI && <>
          <circle cx={tx(mnI).toFixed(1)} cy={ty(current[mnI].value).toFixed(1)} r="3" fill={tokens.chartBar}/>
          <text x={tx(mnI)} y={Math.min(ty(current[mnI].value) + 13, H - 2)} textAnchor={anc(mnI)} fontSize="7.5" fill={tokens.chartBar} fontWeight="600">{fmtVal(current[mnI].value)}</text>
        </>}
      </svg>
    </div>
  )
}

function MetricCard({ metric, size, period }: { metric: HealthMetric; size: 'small' | 'large'; period: Period }) {
  const isTS = period !== 'day'
  const dv = isTS ? (metric.avg ?? metric.value) : metric.value
  const hasV = dv !== '—' && dv !== '' && dv !== 0
  const warn = isTS && hasV && isLowPerf(metric)
  const hasCh = isTS && (metric.dataPoints?.length ?? 0) >= 2

  return (
    <div className={'flex flex-col ' + (size === 'large' ? 'col-span-2' : '')}
      style={{ ...cardStyle, borderRadius: tokens.radiusLg, padding: tokens.cardPad,
        backgroundColor: warn ? '#FEF6F6' : tokens.bgCard }}>
      <p className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: tokens.textLabel }}>{metric.label}</p>
      <div className="flex items-baseline gap-1.5 mt-1">
        <span className={'font-bold leading-none ' + (size === 'large' ? 'text-4xl' : 'text-3xl')}
          style={{ color: hasV ? tokens.textPrimary : '#D4CFC8' }}>
          {hasV ? dv : '—'}
        </span>
        {hasV && <span className="text-xs" style={{ color: tokens.textLabel }}>{metric.unit}</span>}
      </div>
      {hasCh && <LineChart current={metric.dataPoints!} />}
      {warn && <p className="text-[10px] mt-2 font-medium" style={{ color: tokens.accentRed }}>Consistently low</p>}
    </div>
  )
}

function InsightsStrip({ insights, loading }: { insights: string[]; loading: boolean }) {
  if (loading) return (
    <div className="flex gap-3 mb-5">
      {[0,1,2].map(i => <div key={i} className="flex-1 h-16 rounded-xl animate-pulse" style={{ backgroundColor: '#E8E4DA' }}/>)}
    </div>
  )
  if (!insights.length) return null
  const labels = ['Change', 'Pattern', 'Action']
  return (
    <div className="flex flex-col md:flex-row gap-3 mb-5">
      {insights.map((ins, i) => (
        <div key={i} className="flex-1 rounded-xl px-4 py-3" style={{ backgroundColor: tokens.bgDark, borderRadius: tokens.radiusMd }}>
          <p className="text-[10px] uppercase tracking-widest mb-1 font-semibold" style={{ color: tokens.textDarkMuted }}>{labels[i]}</p>
          <p className="text-xs leading-relaxed" style={{ color: tokens.textDark }}>{ins}</p>
        </div>
      ))}
    </div>
  )
}

export default function Playground() {
  const [scenarioId, setScenarioId] = useState('heavy-cardio')
  const [period, setPeriod] = useState<Period>('30d')
  const [config, setConfig] = useState<DashboardConfig | null>(null)
  const [metrics, setMetrics] = useState<HealthMetric[]>([])
  const [insights, setInsights] = useState<string[]>([])
  const [insLoad, setInsLoad] = useState(false)

  useEffect(() => {
    const scenario = PLAYGROUND_SCENARIOS.find(s => s.id === scenarioId)
    if (!scenario) return
    const m = period === 'day'
      ? scenario.metrics.map(m => ({ ...m, avg: undefined, dataPoints: undefined }))
      : scenario.metrics
    setMetrics(m)
    setConfig(buildDashboardConfig(m, period))
    setInsights([])
  }, [scenarioId, period])

  const fetchInsights = useCallback(async () => {
    if (!metrics.length) return
    setInsLoad(true)
    try {
      const summary = buildInsightsSummary(metrics, period)
      const res = await fetch('/api/insights', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentSummary: summary, period }),
      })
      if (res.ok) { const { insights } = await res.json(); setInsights(insights) }
    } catch {}
    setInsLoad(false)
  }, [metrics, period])

  useEffect(() => {
    if (period !== 'day' && metrics.length) fetchInsights()
  }, [metrics])

  return (
    <div className="flex min-h-screen" style={{ backgroundColor: tokens.bg }}>
      <main className="flex-1 ml-[80px] px-6 py-6">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold" style={{ color: tokens.textPrimary }}>Trends</h1>
            <span className="text-[10px] uppercase tracking-widest px-2.5 py-1 rounded-full font-semibold"
              style={{ backgroundColor: tokens.accentAmberBg, color: '#8B6914' }}>Demo</span>
          </div>
          <a href="/connect" className="text-xs font-medium px-4 py-2 rounded-lg transition-colors hover:opacity-80"
            style={{ backgroundColor: tokens.bgDark, color: tokens.textDark, borderRadius: tokens.radiusMd }}>
            Connect my device →
          </a>
        </div>

        {/* Scenario selector */}
        <div className="grid grid-cols-4 gap-2 mb-5">
          {PLAYGROUND_SCENARIOS.map(s => (
            <button key={s.id} onClick={() => setScenarioId(s.id)}
              className="text-left p-4 rounded-xl transition-all"
              style={{
                ...cardStyle,
                borderRadius: tokens.radiusMd,
                backgroundColor: scenarioId === s.id ? tokens.bgDark : tokens.bgCard,
                boxShadow: scenarioId === s.id ? 'none' : cardStyle.boxShadow,
              }}>
              <p className="text-xs font-semibold" style={{ color: scenarioId === s.id ? tokens.textDark : tokens.textPrimary }}>
                {s.label}
              </p>
              <p className="text-[10px] mt-0.5" style={{ color: scenarioId === s.id ? tokens.textDarkMuted : tokens.textLabel }}>
                {s.description}
              </p>
            </button>
          ))}
        </div>

        {/* Period selector */}
        <div className="flex items-center gap-2 mb-5">
          {PERIOD_OPTIONS.map(opt => (
            <button key={opt.value} onClick={() => setPeriod(opt.value)}
              className="text-xs px-4 py-2 rounded-lg font-medium transition-colors"
              style={{
                backgroundColor: period === opt.value ? tokens.textPrimary : 'transparent',
                color: period === opt.value ? tokens.textDark : tokens.textSecondary,
                border: '1px solid ' + (period === opt.value ? tokens.textPrimary : tokens.border),
              }}>
              {opt.label}
            </button>
          ))}
        </div>

        {/* Insights */}
        {period !== 'day' && (insLoad || insights.length > 0) && (
          <InsightsStrip insights={insights} loading={insLoad} />
        )}

        {/* Metric sections */}
        {config && config.sections.map((section: DashboardConfig['sections'][0]) => (
          <div key={section.category} className="mb-5">
            <p className="text-[11px] uppercase tracking-widest font-semibold mb-3" style={{ color: tokens.textLabel }}>
              {section.label}
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {section.metrics.map((ml: DashboardConfig['sections'][0]['metrics'][0], idx: number) => (
                <MetricCard key={section.category + ':' + ml.metric.key + ':' + idx}
                  metric={ml.metric} size={ml.size} period={period} />
              ))}
            </div>
          </div>
        ))}
      </main>
    </div>
  )
}