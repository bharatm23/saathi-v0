'use client'
import { useEffect, useState, useCallback, useRef, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { tokens, cardStyle, snapshotStyle } from '@/lib/design-tokens'
import { Period, HealthMetric } from '@/lib/providers/types'
import { buildDashboardConfig, buildInsightsSummary, DashboardConfig } from '@/lib/layout'
import { createClient } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { useMember } from '@/lib/member-context'

const DATA_ENDPOINTS = ['steps','calories','distance','activeMinutes','heartrate','sleep','weight','activityLog']

const PERIOD_OPTIONS: { value: Period; label: string }[] = [
  { value: 'day', label: 'Last sync' },
  { value: '30d', label: '30 days' },
  { value: '1y',  label: '1 year' },
]

type DataPoint = { date: string; value: number }
type Activity = {
  name: string; date: string; durationMins: number
  calories: number; hr: number | null; steps: number | null; distanceKm: number | null
}

const LOW_THRESHOLDS: Record<string, number> = { steps: 3000, distance: 1.5, activeMinutes: 15, sleepDuration: 6 }
const HIGH_THRESHOLDS: Record<string, number> = { restingHR: 80 }

function isLowPerf(m: HealthMetric): boolean {
  const v = parseFloat(String(m.avg ?? m.value))
  if (isNaN(v)) return false
  if (LOW_THRESHOLDS[m.key]) return v < LOW_THRESHOLDS[m.key]
  if (HIGH_THRESHOLDS[m.key]) return v > HIGH_THRESHOLDS[m.key]
  return false
}

function computeEfficiencyScore(metrics: HealthMetric[]): number {
  const scores: { s: number; w: number }[] = []
  const add = (key: string, w: number, calc: (v: number) => number) => {
    const m = metrics.find(x => x.key === key)
    const v = m?.avg ? parseFloat(m.avg) : m?.value ? parseFloat(String(m.value)) : null
    if (v !== null && !isNaN(v!)) scores.push({ s: Math.min(100, Math.max(0, calc(v!))), w })
  }
  add('steps', 0.25, v => (v / 10000) * 100)
  add('activeMinutes', 0.25, v => (v / 30) * 100)
  add('sleepDuration', 0.20, v => ((v - 5) / 3) * 100)
  add('sleepEfficiency', 0.15, v => ((v - 70) / 25) * 100)
  add('restingHR', 0.15, v => ((80 - v) / 30) * 100)
  if (!scores.length) return 0
  const tw = scores.reduce((s, x) => s + x.w, 0)
  return Math.round(scores.reduce((s, x) => s + x.s * x.w, 0) / tw)
}

function computePrimeWindow(metrics: HealthMetric[]) {
  const hr = metrics.find(m => m.key === 'restingHR')
  const hrVal = hr?.value ? parseFloat(String(hr.value)) : 65
  const sleep = metrics.find(m => m.key === 'sleepDuration')
  const sleepVal = sleep?.value ? parseFloat(String(sleep.value)) : 7
  if (hrVal < 58 && sleepVal >= 7.5) return { start: '06:30', end: '08:00', reason: 'Low resting HR and strong sleep — peak AM recovery state' }
  if (hrVal < 65 && sleepVal >= 6.5) return { start: '17:00', end: '18:30', reason: 'Good recovery markers — afternoon peak performance window' }
  if (sleepVal < 6) return { start: '18:30', end: '19:30', reason: 'Low sleep — lighter evening session recommended' }
  return { start: '16:30', end: '18:00', reason: 'Moderate recovery — afternoon training window optimal' }
}

function downloadReminder(startTime: string, label: string) {
  const [h, m] = startTime.split(':').map(Number)
  const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(h, m, 0, 0)
  const e = new Date(d.getTime() + 90 * 60000)
  const fmt = (x: Date) => x.toISOString().replace(/[-:.]/g, '').slice(0, 15) + 'Z'
  const ics = ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Health Dashboard//EN',
    'BEGIN:VEVENT','DTSTART:'+fmt(d),'DTEND:'+fmt(e),
    'SUMMARY:Training – '+label,'DESCRIPTION:Health Dashboard prime window reminder',
    'BEGIN:VALARM','TRIGGER:-PT15M','ACTION:DISPLAY','DESCRIPTION:Training in 15 min','END:VALARM',
    'END:VEVENT','END:VCALENDAR'].join('\r\n')
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }))
  a.download = 'training-reminder.ics'; a.click()
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

function toMonthly(pts: DataPoint[]): DataPoint[] {
  const map = new Map<string, number[]>()
  for (const p of pts) {
    const k = p.date.slice(0, 7)
    if (!map.has(k)) map.set(k, [])
    map.get(k)!.push(p.value)
  }
  return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b))
    .map(([k, vs]) => ({ date: k, value: Math.round((vs.reduce((a, b) => a + b, 0) / vs.length) * 10) / 10 }))
}

type Tone = 'companion' | 'analyst' | 'coach' | 'clinical'

const TONE_META: { key: Tone; label: string }[] = [
  { key: 'companion', label: 'Companion' },
  { key: 'analyst', label: 'Analyst' },
  { key: 'coach', label: 'Coach' },
  { key: 'clinical', label: 'Clinical' },
]

// Consistent card header style
const CARD_HEADER: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.08em',
  color: 'rgb(107,101,96)',
}

const SNAPSHOT_HEADER: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.08em',
  color: 'rgb(245,240,232)',
}

function getBestPeriodCallout(metrics: HealthMetric[], isYearly: boolean): string | null {
  const stepsM = metrics.find(m => m.key === 'steps')
  if (!stepsM?.dataPoints?.length) return null
  if (isYearly) {
    const monthly = toMonthly(stepsM.dataPoints)
    if (monthly.length < 2) return null
    const best = monthly.reduce((a, b) => b.value > a.value ? b : a)
    const avg = monthly.reduce((a, b) => a + b.value, 0) / monthly.length
    const pct = Math.round(((best.value - avg) / avg) * 100)
    const bestMonth = new Date(best.date + '-01').toLocaleString('default', { month: 'long' })
    return bestMonth + ' was your peak — ' + pct + '% above your yearly average'
  } else {
    const pts = stepsM.dataPoints
    const weeks: number[][] = []
    pts.forEach((p, i) => { const w = Math.floor(i / 7); if (!weeks[w]) weeks[w] = []; weeks[w].push(p.value) })
    const weekAvgs = weeks.map(w => w.reduce((a, b) => a + b, 0) / w.length)
    const bestW = weekAvgs.reduce((mi, v, i) => v > weekAvgs[mi] ? i : mi, 0)
    const overallAvg = pts.reduce((a, b) => a + b.value, 0) / pts.length
    const pct = Math.round(((weekAvgs[bestW] - overallAvg) / overallAvg) * 100)
    return 'Week ' + (bestW + 1) + ' was your strongest — ' + pct + '% above your monthly average'
  }
}

function getTrendCallout(metrics: HealthMetric[], key: string): string | null {
  const m = metrics.find(x => x.key === key)
  if (!m?.dataPoints || m.dataPoints.length < 10) return null
  const pts = m.dataPoints
  const half = Math.floor(pts.length / 2)
  const first = pts.slice(0, half).reduce((a, b) => a + b.value, 0) / half
  const second = pts.slice(half).reduce((a, b) => a + b.value, 0) / (pts.length - half)
  const pct = Math.round(((second - first) / (first || 1)) * 100)
  if (Math.abs(pct) < 4) return 'Holding steady — consistent effort throughout'
  if (pct > 0) return 'Up ' + pct + '% in the second half — momentum is building ↑'
  return 'Down ' + Math.abs(pct) + '% in the second half — time to refocus ↓'
}

function getDailyReadinessCallout(metrics: HealthMetric[]): string {
  const hr = metrics.find(m => m.key === 'restingHR')
  const sleep = metrics.find(m => m.key === 'sleepDuration')
  const hrVal = hr?.value ? parseFloat(String(hr.value)) : null
  const sleepVal = sleep?.value ? parseFloat(String(sleep.value)) : null
  if (hrVal && hrVal < 55 && sleepVal && sleepVal >= 7.5) return 'Primed for a hard session today'
  if (hrVal && hrVal < 62 && sleepVal && sleepVal >= 6.5) return 'Good readiness — moderate to high intensity'
  if (sleepVal && sleepVal < 6) return 'Low sleep — keep today light and recover'
  if (hrVal && hrVal > 72) return 'Elevated HR — consider an easy day'
  return 'Moderate readiness — solid effort is on the cards'
}

// Replace the ToneToggle component:
function ToneToggle({ tones, onTonesChange }: {
  tones: Tone[]
  onTonesChange: (t: Tone[]) => void
}) {
  const companion = tones.includes('companion')
  const analyticalTone = (['analyst', 'coach', 'clinical'] as Tone[]).find(t => tones.includes(t)) ?? 'analyst'

  const toggleCompanion = () => {
    const next: Tone[] = companion
      ? tones.filter(t => t !== 'companion')
      : [...tones.filter(t => t !== 'companion'), 'companion' as Tone]
    if (next.length === 0) return
    onTonesChange(next)
  }

  const setAnalyticalTone = (t: Tone) => {
    const base: Tone[] = tones.filter(x => !(['analyst','coach','clinical'] as Tone[]).includes(x))
    onTonesChange([...base, t])
  }

  return (
    <div className="flex items-center gap-2">
      {/* Companion toggle */}
      <button
        onClick={toggleCompanion}
        className="text-[10px] px-2.5 py-1 rounded-lg font-bold uppercase tracking-wide transition-all flex items-center gap-1"
        style={{
          backgroundColor: companion ? '#E8F5EE' : tokens.bg,
          color: companion ? '#2D7A52' : tokens.textSecondary,
          border: '1px solid ' + (companion ? '#B8DFC8' : tokens.border),
        }}
      >
        <span>{companion ? '✓' : '+'}</span> Companion
      </button>

      {/* Divider */}
      <div className="w-px h-4" style={{ backgroundColor: tokens.border }}/>

      {/* Analytical single-select */}
      {(['analyst', 'coach', 'clinical'] as Tone[]).map(t => (
        <button
          key={t}
          onClick={() => setAnalyticalTone(t)}
          className="text-[10px] px-2.5 py-1 rounded-lg font-bold uppercase tracking-wide transition-all"
          style={{
            backgroundColor: analyticalTone === t ? tokens.textPrimary : tokens.bg,
            color: analyticalTone === t ? tokens.textDark : tokens.textSecondary,
            border: '1px solid ' + (analyticalTone === t ? tokens.textPrimary : tokens.border),
          }}
        >
          {t}
        </button>
      ))}
    </div>
  )
}

// ─── Story Card ───────────────────────────────────────────────
interface StoryData {
  headline: string
  narrative: string
  actions: string[]
  callout?: string
}

// Change StoryCard props to include loading:
function StoryCard({
  period, metrics, previousMetrics, tones, onTonesChange, dataLoading
}: {
  period: Period
  metrics: HealthMetric[]
  previousMetrics: Record<string, DataPoint[]>
  tones: Tone[]
  onTonesChange: (t: Tone[]) => void
  dataLoading: boolean
}) {
  const [story, setStory] = useState<StoryData | null>(null)
  const [loading, setLoading] = useState(false)
  const prevKey = useRef('')

  const fetchStory = useCallback(async () => {
    if (!metrics.length) return
    setLoading(true)

    const fmt = (m: HealthMetric) => {
      if (period === 'day') return m.label + ': ' + m.value + ' ' + m.unit
      return m.label + ': avg ' + (m.avg ?? m.value) + ' ' + m.unit + (m.trend ? ', trend ' + m.trend : '')
    }
    const currentSummary = metrics.filter(m => m.value !== '—').map(fmt).join('\n')
    const prevSummary = Object.entries(previousMetrics).length
      ? Object.entries(previousMetrics).map(([k, pts]) => {
          const avg = (pts.reduce((a, b) => a + b.value, 0) / pts.length).toFixed(1)
          const m = metrics.find(x => x.key === k)
          return (m?.label ?? k) + ': avg ' + avg + ' ' + (m?.unit ?? '')
        }).join('\n')
      : ''

    try {
      const res = await fetch('/api/story', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          metrics: currentSummary,
          previousMetrics: prevSummary || undefined,
          period,
          tones,
        }),
      })
      if (res.ok) setStory(await res.json())
    } catch {}
    setLoading(false)
  }, [metrics, previousMetrics, period, tones])
  
  useEffect(() => {
    if (dataLoading) return  // ← add this line
    const key = period + '|' + tones.join(',') + '|' + metrics.length
    if (key === prevKey.current) return
    prevKey.current = key
    if (metrics.length) fetchStory()
  }, [metrics, period, tones, fetchStory, dataLoading])

  const handleToggle = (next: Tone[]) => {
    onTonesChange(next)
  }

  const periodLabels: Record<Period, string> = {
    day: "Today's Story",
    '30d': 'Your Month in Review',
    '1y': 'Your Year in Review',
  }

  const readinessCallout = period === 'day' ? getDailyReadinessCallout(metrics) : null

  if (loading) return (
    <div className="rounded-2xl p-6 mb-4 animate-pulse" style={{ backgroundColor: tokens.bgCard, boxShadow: tokens.cardShadow }}>
      <div className="h-4 rounded w-1/4 mb-4" style={{ backgroundColor: tokens.bg }}/>
      <div className="h-7 rounded w-3/4 mb-3" style={{ backgroundColor: tokens.bg }}/>
      <div className="h-4 rounded w-full mb-2" style={{ backgroundColor: tokens.bg }}/>
      <div className="h-4 rounded w-5/6" style={{ backgroundColor: tokens.bg }}/>
    </div>
  )

  return (
    <div className="rounded-2xl mb-4 overflow-hidden" style={{ backgroundColor: tokens.bgCard, boxShadow: tokens.cardShadow }}>
      {/* Header row */}
      <div className="flex items-center justify-between px-6 pt-5 pb-4" style={{ borderBottom: '1px solid ' + tokens.border }}>
        <div className="flex items-center gap-3">
          <div className="w-1.5 h-6 rounded-full" style={{ backgroundColor: tokens.accentGreen }}/>
          <p style={CARD_HEADER}>
            {periodLabels[period]}
          </p>
          {readinessCallout && (
            <span className="text-[10px] font-semibold px-2.5 py-1 rounded-full"
              style={{ backgroundColor: tokens.accentGreenBg, color: '#2D7A52' }}>
              {readinessCallout}
            </span>
          )}
        </div>
        <ToneToggle tones={tones} onTonesChange={handleToggle}/>
      </div>

      {story ? (
        <div className="grid md:grid-cols-3 divide-x divide-stone-100">
          {/* Left: headline + narrative */}
          <div className="md:col-span-2 px-6 py-5">
            <h2 className="font-serif text-2xl font-bold leading-snug mb-3" style={{ color: tokens.textPrimary }}>
              {story.headline}
            </h2>
            <p className="text-sm leading-relaxed mb-4" style={{ color: tokens.textSecondary }}>
              {story.narrative}
            </p>
            {story.callout && (
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl"
                style={{ backgroundColor: tokens.bg }}>
                <span className="text-lg">📊</span>
                <p className="text-xs font-semibold" style={{ color: tokens.textPrimary }}>{story.callout}</p>
              </div>
            )}
          </div>

          {/* Right: actions */}
          <div className="px-6 py-5">
            <p className="text-[10px] font-bold uppercase tracking-widest mb-4" style={{ color: tokens.textLabel }}>
              Actions this week
            </p>
            <div className="flex flex-col gap-3">
              {(story.actions ?? []).map((action, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{ backgroundColor: tokens.textPrimary }}>
                    <span className="text-[9px] font-bold" style={{ color: tokens.textDark }}>{i + 1}</span>
                  </div>
                  <p className="text-xs leading-relaxed" style={{ color: tokens.textPrimary }}>{action}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="px-6 py-8 text-center">
          <p className="text-sm" style={{ color: tokens.textLabel }}>Generating your story...</p>
        </div>
      )}
    </div>
  )
}

// ─── Snapshot Bar ─────────────────────────────────────────────
function SnapshotBar({ metrics, period }: { metrics: HealthMetric[]; period: Period }) {
  const KEYS = ['steps', 'activeMinutes', 'sleepDuration', 'restingHR', 'calories', 'distance', 'weight']
  const LABELS: Record<string, string> = {
    steps: 'Steps', activeMinutes: 'Active Mins', sleepDuration: 'Sleep',
    restingHR: 'Resting HR', calories: 'Calories', distance: 'Distance', weight: 'Weight'
  }
  // Only show metrics that have actual data
  const items = KEYS
    .map(k => metrics.find(m => m.key === k))
    .filter((m): m is HealthMetric => {
      if (!m) return false
      const v = period === 'day' ? m.value : (m.avg ?? m.value)
      return v !== '—' && v !== '' && v !== '0' && v !== 0 && v !== null
    })

  if (!items.length) return null
  const year = new Date().getFullYear()
  const label = period === '1y' ? year + ' Snapshot' : period === '30d' ? '30-Day Snapshot' : 'Biometric Snapshot'

  const getVal = (m: HealthMetric) => period === 'day'
    ? { v: String(m.value), u: m.unit }
    : { v: m.avg ?? String(m.value), u: m.unit }

  const getDelta = (m: HealthMetric) => {
    if (period === 'day' || !m.dataPoints || m.dataPoints.length < 7) return null
    const pts = m.dataPoints, half = Math.floor(pts.length / 2)
    const first = pts.slice(0, half).reduce((a, b) => a + b.value, 0) / half
    const second = pts.slice(half).reduce((a, b) => a + b.value, 0) / (pts.length - half)
    const pct = ((second - first) / first) * 100
    return { pct: Math.abs(pct).toFixed(0), dir: pct >= 0 ? 'up' : 'down' }
  }

  return (
    <div className="rounded-2xl mb-4 overflow-hidden" style={snapshotStyle}>
      <div className="px-6 pt-4 pb-2.5" style={{ borderBottom: '1px solid ' + tokens.dividerDark }}>
        <p style={SNAPSHOT_HEADER}>{label}</p>
      </div>
      <div className="grid" style={{ gridTemplateColumns: 'repeat(' + items.length + ', 1fr)' }}>
        {items.map((m, i) => {
          const { v, u } = getVal(m)
          const delta = getDelta(m)
          return (
            <div key={m.key} className="px-5 py-4"
              style={{ borderRight: i < items.length - 1 ? '1px solid ' + tokens.dividerDark : 'none' }}>
              <p className="text-xs font-medium mb-1.5" style={{ color: '#6B6560' }}>{LABELS[m.key] ?? m.label}</p>
              <div className="flex items-baseline gap-1.5">
                <span className="text-3xl font-bold" style={{ color: '#F5F0E8' }}>{v}</span>
                <span className="text-sm" style={{ color: '#6B6560' }}>{u}</span>
              </div>
              {delta && (
                <p className="text-[11px] mt-1 font-medium"
                  style={{ color: delta.dir === 'up' ? tokens.accentGreen : '#D4845A' }}>
                  {delta.dir === 'up' ? '↑' : '↓'} {delta.pct}%
                </p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Annual Bar ───────────────────────────────────────────────
function AnnualBar({ metrics }: { metrics: HealthMetric[] }) {
  const stepsM = metrics.find(m => m.key === 'steps')
  const hrM = metrics.find(m => m.key === 'restingHR')
  const sleepM = metrics.find(m => m.key === 'sleepDuration')
  const weightM = metrics.find(m => m.key === 'weight')
  const totalSteps = stepsM?.dataPoints?.reduce((a, b) => a + b.value, 0) ?? 0
  const activeDays = stepsM?.dataPoints?.filter(p => p.value > 3000).length ?? 0
  const totalDays = stepsM?.dataPoints?.length ?? 0
  const consistencyPct = totalDays > 0 ? Math.round((activeDays / totalDays) * 100) : 0
  const weightPts = weightM?.dataPoints?.filter(p => p.value > 0) ?? []
  const weightDelta = weightPts.length >= 2
    ? (weightPts[weightPts.length - 1].value - weightPts[0].value).toFixed(1) : null
  const year = new Date().getFullYear()

  const stats = [
    { label: 'Total Steps', value: totalSteps > 0 ? (totalSteps / 1000000).toFixed(1) + 'M' : '--', sub: totalSteps > 0 ? Math.round(totalSteps / 1000) + 'k avg/day' : '' },
    { label: 'Active Days', value: activeDays > 0 ? String(activeDays) : '--', sub: consistencyPct + '% consistency' },
    { label: 'Avg Resting HR', value: hrM?.avg ? hrM.avg + ' bpm' : '--', sub: hrM?.trend ? hrM.trend + ' trend' : '' },
    { label: 'Avg Sleep', value: sleepM?.avg ? sleepM.avg + ' hrs' : '--', sub: 'per night' },
    { label: 'Weight Change', value: weightDelta ? (parseFloat(weightDelta) > 0 ? '+' : '') + weightDelta + ' kg' : '--', sub: 'year on year' },
  ]

  return (
    <div className="rounded-2xl mb-4 overflow-hidden" style={snapshotStyle}>
      <div className="px-6 pt-4 pb-2.5" style={{ borderBottom: '1px solid ' + tokens.dividerDark }}>
        <p style={SNAPSHOT_HEADER}>{year} Annual Review</p>
      </div>
      <div className="grid" style={{ gridTemplateColumns: 'repeat(' + stats.length + ', 1fr)' }}>
        {stats.map((s, i) => (
          <div key={i} className="px-6 py-4" style={{ borderRight: i < stats.length - 1 ? '1px solid ' + tokens.dividerDark : 'none' }}>
            <p className="text-xs font-medium mb-1" style={{ color: '#6B6560' }}>{s.label}</p>
            <p className="text-3xl font-bold" style={{ color: s.value !== '--' ? '#F5F0E8' : '#444' }}>{s.value}</p>
            {s.sub && <p className="text-[11px] mt-1" style={{ color: '#6B6560' }}>{s.sub}</p>}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Prime Training Window ────────────────────────────────────
function PrimeTrainingWindow({ metrics }: { metrics: HealthMetric[] }) {
  const win = computePrimeWindow(metrics)
  return (
    <div style={{ ...cardStyle, borderRadius: tokens.radiusLg, padding: tokens.cardPad }}>
      <p className="mb-3" style={CARD_HEADER}>Prime Training Window</p>
      <p className="font-serif text-4xl font-bold tracking-tight mb-1" style={{ color: tokens.textPrimary }}>
        {win.start}
      </p>
      <p className="text-lg font-medium mb-3" style={{ color: tokens.textSecondary }}>to {win.end}</p>
      <p className="text-sm leading-relaxed mb-5" style={{ color: tokens.textSecondary }}>{win.reason}</p>
      <button
        onClick={() => downloadReminder(win.start, win.start + ' – ' + win.end)}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-opacity hover:opacity-80"
        style={{ backgroundColor: tokens.textPrimary, color: tokens.textDark, borderRadius: tokens.radiusMd }}>
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
          <rect x="1" y="3" width="14" height="12" rx="2" stroke="#F5F0E8" strokeWidth="1.5" fill="none"/>
          <path d="M1 7h14" stroke="#F5F0E8" strokeWidth="1.5"/>
          <path d="M5 1v2M11 1v2" stroke="#F5F0E8" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
        Set reminder
      </button>
    </div>
  )
}

function EnergyDonut({ metrics }: { metrics: HealthMetric[] }) {
  const calMetric = metrics.find(m => m.key === 'calories')
  const wtMetric = metrics.find(m => m.key === 'weight')
  const total = calMetric?.value ? parseFloat(String(calMetric.value)) : 0
  const weight = wtMetric?.value ? parseFloat(String(wtMetric.value)) : 70
  const bmr = Math.round(88.36 + (13.4 * weight) + (4.8 * 170) - (5.7 * 30))
  const active = Math.max(0, total - bmr)
  const target = 2600
  const R = 52, cx = 64, cy = 64, circ = 2 * Math.PI * R
  const totalFill = Math.min(1, total / target)
  const bmrFill = Math.min(1, bmr / target)
  const remaining = Math.max(0, target - total)
  const pctDone = Math.round((total / target) * 100)

  return (
    <div style={{ ...cardStyle, borderRadius: tokens.radiusLg, padding: tokens.cardPad }}>
      <p className="mb-4" style={CARD_HEADER}>Energy Expenditure</p>
      <div className="flex items-center gap-6">
        {/* Donut */}
        <div className="relative flex-shrink-0">
          <svg width="128" height="128" viewBox="0 0 128 128">
            <circle cx={cx} cy={cy} r={R} fill="none" stroke="#F0ECE4" strokeWidth="12"/>
            <circle cx={cx} cy={cy} r={R} fill="none" stroke="#C4A882" strokeWidth="12"
              strokeDasharray={bmrFill * circ + ' ' + circ} strokeDashoffset={circ * 0.25} strokeLinecap="round"/>
            <circle cx={cx} cy={cy} r={R} fill="none" stroke={tokens.textPrimary} strokeWidth="12"
              strokeDasharray={totalFill * circ + ' ' + circ} strokeDashoffset={circ * 0.25} strokeLinecap="round"/>
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-bold" style={{ color: tokens.textPrimary }}>{total > 0 ? fmtVal(total) : '--'}</span>
            <span className="text-[10px] font-medium" style={{ color: tokens.textLabel }}>kcal</span>
            <span className="text-[9px] font-semibold mt-0.5" style={{ color: tokens.accentGreen }}>{pctDone}%</span>
          </div>
        </div>

        {/* Stats */}
        <div className="flex flex-col gap-3 flex-1">
          <div>
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#C4A882' }}/>
              <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: tokens.textLabel }}>Basal Metabolic Rate</span>
            </div>
            <span className="text-base font-bold" style={{ color: tokens.textPrimary }}>{bmr.toLocaleString()} kcal</span>
          </div>
          <div>
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: tokens.textPrimary }}/>
              <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: tokens.textLabel }}>Active</span>
            </div>
            <span className="text-base font-bold" style={{ color: tokens.textPrimary }}>{active > 0 ? active.toLocaleString() : '--'} kcal</span>
          </div>
          <div className="rounded-xl p-3" style={{ backgroundColor: tokens.bg }}>
            <div className="flex justify-between items-center mb-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: tokens.textLabel }}>Target</span>
              <span className="text-[10px] font-bold" style={{ color: tokens.textPrimary }}>{target.toLocaleString()} kcal</span>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: tokens.border }}>
              <div className="h-full rounded-full" style={{ width: pctDone + '%', backgroundColor: tokens.textPrimary }}/>
            </div>
            {remaining > 0 && (
              <p className="text-[9px] mt-1 font-medium" style={{ color: tokens.textSecondary }}>
                {remaining.toLocaleString()} kcal to target
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Activity Timeline ────────────────────────────────────────
function ActivityTimeline({ activities }: { activities: Activity[] }) {
  const fmtTime = (iso: string) => {
    try { return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }) }
    catch { return '' }
  }
  const fmtDate = (iso: string) => {
    try { return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) }
    catch { return '' }
  }

  const getActivityIcon = (name: string) => {
    const n = name.toLowerCase()
    if (n.includes('run') || n.includes('jog')) return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <path d="M13 4a1 1 0 100-2 1 1 0 000 2zM7 22l3-7 3 3 2-4 3 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M9 12l2-5 3 2 2-3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    )
    if (n.includes('walk')) return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="4" r="1.5" fill="currentColor"/>
        <path d="M9 8l3 2 3-2M9 12l-2 6h3l2-3 2 3h3l-2-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    )
    if (n.includes('bike') || n.includes('cycl')) return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <circle cx="6" cy="15" r="4" stroke="currentColor" strokeWidth="2"/>
        <circle cx="18" cy="15" r="4" stroke="currentColor" strokeWidth="2"/>
        <path d="M6 15l4-7h4l2 4H12l-2-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    )
    if (n.includes('swim')) return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <path d="M2 12c2-2 4-2 6 0s4 2 6 0 4-2 6 0M2 17c2-2 4-2 6 0s4 2 6 0 4-2 6 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      </svg>
    )
    if (n.includes('yoga') || n.includes('stretch')) return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="4" r="1.5" fill="currentColor"/>
        <path d="M12 6v6l-4 3M12 12l4 3M8 21l4-3 4 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    )
    // Default: dumbbell/workout
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <path d="M6 4v16M18 4v16" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
        <path d="M3 7v10M21 7v10" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
        <path d="M6 12h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      </svg>
    )
  }

  return (
    <div className="h-full flex flex-col" style={{ ...cardStyle, borderRadius: tokens.radiusLg, padding: tokens.cardPad }}>
      <p className="mb-4" style={CARD_HEADER}>Activity Timeline</p>
      {!activities.length ? (
        <p className="text-sm flex-1" style={{ color: tokens.textLabel }}>No activities logged recently.</p>
      ) : (
        <div className="flex flex-col flex-1">
          {activities.slice(0, 5).map((a, i) => (
            <div key={i} className="flex items-stretch gap-3">
              {/* Timeline spine */}
              <div className="flex flex-col items-center" style={{ width: 36 }}>
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: tokens.textPrimary, color: tokens.textDark }}>
                  {getActivityIcon(a.name)}
                </div>
                {i < activities.slice(0, 5).length - 1 && (
                  <div className="flex-1 w-px my-1" style={{ backgroundColor: tokens.border, minHeight: 12 }}/>
                )}
              </div>
              {/* Content */}
              <div className="flex-1 pb-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-bold leading-tight" style={{ color: tokens.textPrimary }}>{a.name}</p>
                  <div className="text-right flex-shrink-0">
                    <p className="text-[10px] font-semibold" style={{ color: tokens.textLabel }}>{fmtDate(a.date)}</p>
                    <p className="text-[10px]" style={{ color: tokens.textLabel }}>{fmtTime(a.date)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs font-medium" style={{ color: tokens.textSecondary }}>{a.durationMins} min</span>
                  {a.calories > 0 && <><span style={{ color: tokens.border }}>·</span><span className="text-xs" style={{ color: tokens.textSecondary }}>{a.calories} kcal</span></>}
                  {a.hr && <><span style={{ color: tokens.border }}>·</span><span className="text-xs" style={{ color: tokens.textSecondary }}>{a.hr} bpm</span></>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Consistency Matrix ───────────────────────────────────────
const MATRIX_METRICS = [
  { key: 'steps', label: 'Steps' },
  { key: 'calories', label: 'Calories' },
  { key: 'activeMinutes', label: 'Active' },
  { key: 'sleepDuration', label: 'Sleep' },
]

function ConsistencyMatrix({ metrics, isYearly }: {
  metrics: HealthMetric[]
  isYearly: boolean
}) {
  const availableKeys = MATRIX_METRICS.filter(m => {
    const metric = metrics.find(x => x.key === m.key)
    return (metric?.dataPoints?.length ?? 0) > 0
  })

  const [activeKey, setActiveKey] = useState(() => availableKeys[0]?.key ?? 'steps')

  useEffect(() => {
    if (!availableKeys.find(m => m.key === activeKey) && availableKeys.length > 0) {
      setActiveKey(availableKeys[0].key)
    }
  }, [metrics])

  const metric = metrics.find(m => m.key === activeKey)
  const pts = metric?.dataPoints ?? []
  const maxVal = Math.max(...pts.map(p => p.value), 1)

  const getColor = (v: number) => {
    if (v <= 0) return tokens.heatEmpty
    const i = v / maxVal
    if (i < 0.2) return tokens.heatLow
    if (i < 0.4) return tokens.heatMid1
    if (i < 0.6) return tokens.heatMid2
    if (i < 0.8) return tokens.heatHigh
    return tokens.heatMax
  }

  // Build cells
  type Cell = { date: string; value: number; x: number; y: number }
  let cells: Cell[] = []

  if (isYearly) {
    const cellSize = 13, cellGap = 3
    const dateMap = new Map(pts.map(p => [p.date, p.value]))
    const end = new Date(pts[pts.length - 1]?.date + 'T00:00:00')
    const start = new Date(end); start.setFullYear(end.getFullYear() - 1)
    let col = 0, row = start.getDay()
    const cur = new Date(start)
    while (cur <= end) {
      const dateStr = cur.toISOString().split('T')[0]
      cells.push({ date: dateStr, value: dateMap.get(dateStr) ?? 0, x: col, y: row })
      row++; if (row === 7) { row = 0; col++ }
      cur.setDate(cur.getDate() + 1)
    }

    const cols = 53, rows = 7
    const svgW = cols * (cellSize + cellGap)
    const svgH = rows * (cellSize + cellGap)

    const monthLabels: { label: string; x: number }[] = []
    let lastMonth = -1
    cells.forEach(c => {
      const mo = new Date(c.date + 'T00:00:00').getMonth()
      if (mo !== lastMonth) {
        lastMonth = mo
        const names = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
        monthLabels.push({ label: names[mo], x: c.x * (cellSize + cellGap) })
      }
    })

    return (
      <div className="mb-4" style={{ ...cardStyle, borderRadius: tokens.radiusLg, padding: tokens.cardPad }}>
        <div className="flex items-center justify-between mb-3">
          <p style={CARD_HEADER}>Consistency Matrix</p>
          <div className="flex gap-1">
            {availableKeys.map(m => (
              <button key={m.key} onClick={() => setActiveKey(m.key)}
                className="text-[9px] px-2.5 py-1.5 rounded-lg font-bold uppercase tracking-wide transition-colors"
                style={{
                  backgroundColor: activeKey === m.key ? tokens.textPrimary : tokens.bg,
                  color: activeKey === m.key ? tokens.textDark : tokens.textSecondary,
                }}>
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {!pts.length ? (
          <p className="text-sm py-4" style={{ color: tokens.textLabel }}>No data for this metric.</p>
        ) : (
          <>
            <div className="flex gap-2">
              <div style={{ display: 'flex', flexDirection: 'column', gap: cellGap, paddingTop: 16 }}>
                {['M','T','W','T','F','S','S'].map((d, i) => (
                  <div key={i} style={{ height: cellSize, width: 10, fontSize: 8, color: tokens.textLabel, display: 'flex', alignItems: 'center', fontWeight: 600 }}>{d}</div>
                ))}
              </div>
              <div className="flex-1 overflow-x-auto">
                <div style={{ position: 'relative', height: 14, marginBottom: 3, minWidth: svgW }}>
                  {monthLabels.slice(0, 12).map((ml, i) => (
                    <span key={i} style={{ position: 'absolute', left: ml.x, fontSize: 9, color: 'rgb(107,101,96)', whiteSpace: 'nowrap', fontWeight: 600 }}>{ml.label}</span>
                  ))}
                </div>
                <svg viewBox={'0 0 ' + svgW + ' ' + svgH} style={{ width: '100%', height: 'auto' }} preserveAspectRatio="xMinYMin meet">
                  {cells.map((c, i) => (
                    <rect key={i} x={c.x * (cellSize + cellGap)} y={c.y * (cellSize + cellGap)}
                      width={cellSize} height={cellSize} rx="2.5" fill={getColor(c.value)}>
                      <title>{c.date}: {c.value > 0 ? fmtVal(c.value) : 'no data'}</title>
                    </rect>
                  ))}
                </svg>
              </div>
            </div>
            <div className="flex items-center gap-1.5 mt-3">
              <span className="text-[9px] font-semibold mr-1" style={{ color: tokens.textLabel }}>Less</span>
              {[tokens.heatEmpty, tokens.heatLow, tokens.heatMid1, tokens.heatMid2, tokens.heatHigh, tokens.heatMax].map((c, i) => (
                <span key={i} className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: c }}/>
              ))}
              <span className="text-[9px] font-semibold ml-1" style={{ color: tokens.textLabel }}>More</span>
            </div>
          </>
        )}
      </div>
    )
  }

  // ── 30-day: calendar grid, 7 cols with day headers ──────────
  // Group by week rows, show day headers
  const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  // Build day-of-week aligned grid from data
  let gridCells: (Cell | null)[][] = [] // rows of 7

  if (pts.length > 0) {
    const firstDow = new Date(pts[0].date + 'T00:00:00').getDay()
    // Pad start
    const padded: (Cell | null)[] = Array(firstDow).fill(null)
    pts.forEach((p, i) => padded.push({ date: p.date, value: p.value, x: 0, y: 0 }))
    // Chunk into rows of 7
    for (let i = 0; i < padded.length; i += 7) {
      gridCells.push(padded.slice(i, i + 7))
    }
  }

  const callout = getBestPeriodCallout(metrics, false)

  return (
    <div className="mb-4" style={{ ...cardStyle, borderRadius: tokens.radiusLg, padding: tokens.cardPad }}>
      <div className="flex items-center justify-between mb-1">
        <p style={CARD_HEADER}>Consistency Matrix</p>
        <div className="flex gap-1">
          {availableKeys.map(m => (
            <button key={m.key} onClick={() => setActiveKey(m.key)}
              className="text-[9px] px-2.5 py-1.5 rounded-lg font-bold uppercase tracking-wide transition-colors"
              style={{
                backgroundColor: activeKey === m.key ? tokens.textPrimary : tokens.bg,
                color: activeKey === m.key ? tokens.textDark : tokens.textSecondary,
              }}>
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {callout && (
        <p className="text-xs font-medium mb-4" style={{ color: tokens.textSecondary }}>
          <span style={{ color: tokens.accentGreen }}>● </span>{callout}
        </p>
      )}

      {!pts.length ? (
        <p className="text-sm py-4" style={{ color: tokens.textLabel }}>No data for this metric.</p>
      ) : (
        <>
          {/* Day headers */}
          <div className="grid gap-1.5 mb-1" style={{ gridTemplateColumns: 'repeat(7, 1fr)' }}>
            {DAY_LABELS.map(d => (
              <div key={d} className="text-center text-[9px] font-bold uppercase" style={{ color: 'rgb(107,101,96)' }}>{d}</div>
            ))}
          </div>
          {/* Grid rows */}
          {gridCells.map((row, ri) => (
            <div key={ri} className="grid gap-1.5 mb-1.5" style={{ gridTemplateColumns: 'repeat(7, 1fr)' }}>
              {Array.from({ length: 7 }, (_, ci) => {
                const cell = row[ci] ?? null
                return (
                  <div key={ci}
                    className="rounded-lg aspect-square"
                    style={{
                      backgroundColor: cell ? getColor(cell.value) : 'transparent',
                      minHeight: 28,
                    }}
                    title={cell ? cell.date + ': ' + fmtVal(cell.value) : ''}
                  />
                )
              })}
            </div>
          ))}
          {/* Legend */}
          <div className="flex items-center gap-1.5 mt-3">
            <span className="text-[9px] font-semibold mr-1" style={{ color: tokens.textLabel }}>Less</span>
            {[tokens.heatEmpty, tokens.heatLow, tokens.heatMid1, tokens.heatMid2, tokens.heatHigh, tokens.heatMax].map((c, i) => (
              <span key={i} className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: c }}/>
            ))}
            <span className="text-[9px] font-semibold ml-1" style={{ color: tokens.textLabel }}>More</span>
          </div>
        </>
      )}
    </div>
  )
}

// ─── Efficiency Score ─────────────────────────────────────────
function EfficiencyScore({ metrics }: { metrics: HealthMetric[] }) {
  const score = computeEfficiencyScore(metrics)
  const factors = [
    { label: 'Steps', key: 'steps', calc: (v: number) => Math.min(100, (v / 10000) * 100) },
    { label: 'Active mins', key: 'activeMinutes', calc: (v: number) => Math.min(100, (v / 30) * 100) },
    { label: 'Sleep', key: 'sleepDuration', calc: (v: number) => Math.min(100, Math.max(0, ((v - 5) / 3) * 100)) },
    { label: 'Sleep eff.', key: 'sleepEfficiency', calc: (v: number) => Math.min(100, Math.max(0, ((v - 70) / 25) * 100)) },
    { label: 'Resting HR', key: 'restingHR', calc: (v: number) => Math.min(100, Math.max(0, ((80 - v) / 30) * 100)) },
  ]
  const scoreColor = score >= 75 ? '#2D7A52' : score >= 50 ? '#8B6014' : '#8B2020'

  return (
    <div style={{ ...cardStyle, borderRadius: tokens.radiusLg, padding: tokens.cardPad }}>
      <p style={CARD_HEADER}>Efficiency Score</p>
      <div className="flex items-end gap-1 mb-1">
        <span className="text-5xl font-bold" style={{ color: scoreColor }}>{score}</span>
        <span className="text-xl mb-1" style={{ color: tokens.textLabel }}>/100</span>
      </div>
      <p className="text-sm mb-4" style={{ color: tokens.textSecondary }}>
        {score >= 80 ? 'Elite performance' : score >= 65 ? 'Strong month' : score >= 50 ? 'Room to improve' : 'Needs attention'}
      </p>
      <div className="flex flex-col gap-2.5">
        {factors.map(f => {
          const m = metrics.find(x => x.key === f.key)
          const v = m?.avg ? parseFloat(m.avg) : m?.value ? parseFloat(String(m.value)) : null
          const fs = v !== null ? Math.round(f.calc(v)) : null
          return (
            <div key={f.key}>
              <div className="flex justify-between mb-1">
                <span className="text-xs" style={{ color: tokens.textSecondary }}>{f.label}</span>
                <span className="text-xs font-semibold" style={{ color: tokens.textPrimary }}>{fs !== null ? fs + '%' : '—'}</span>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: tokens.bg }}>
                <div className="h-full rounded-full" style={{ width: (fs ?? 0) + '%', backgroundColor: scoreColor }}/>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Peak Performance Days ────────────────────────────────────
function PeakPerformanceDays({ metrics }: { metrics: HealthMetric[] }) {
  const stepsM = metrics.find(m => m.key === 'steps')
  const calM = metrics.find(m => m.key === 'calories')
  const activeM = metrics.find(m => m.key === 'activeMinutes')
  type PeakDay = { date: string; label: string; value: string; unit: string }
  const peaks: PeakDay[] = []
  const findPeak = (m: HealthMetric | undefined, label: string, unit: string) => {
    if (!m?.dataPoints?.length) return
    const best = m.dataPoints.reduce((a, b) => b.value > a.value ? b : a)
    if (best.value > 0) peaks.push({ date: best.date, label, value: fmtVal(best.value), unit })
  }
  findPeak(stepsM, 'Most steps', 'steps')
  findPeak(calM, 'Most active', 'kcal')
  findPeak(activeM, 'Longest effort', 'min active')

  const fmtDate = (d: string) => {
    try { return new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }) }
    catch { return d }
  }

  return (
    <div style={{ ...cardStyle, borderRadius: tokens.radiusLg, padding: tokens.cardPad }}>
      <p className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: tokens.textSecondary }}>
        Peak Performance Days
      </p>
      {(() => {
        const stepsM = metrics.find(m => m.key === 'steps')
        if (!stepsM?.dataPoints?.length || peaks.length === 0) return null
        const avg = stepsM.dataPoints.reduce((a, b) => a + b.value, 0) / stepsM.dataPoints.length
        const peakVal = stepsM.dataPoints.reduce((a, b) => b.value > a.value ? b : a).value
        const mult = (peakVal / avg).toFixed(1)
        return (
          <p className="text-[11px] font-medium mb-4" style={{ color: tokens.textSecondary }}>
            <span style={{ color: tokens.accentGreen }}>●</span> Your peak day was {mult}× your average
          </p>
        )
      })()}
      {!peaks.length ? (
        <p className="text-sm" style={{ color: tokens.textLabel }}>Not enough data.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {peaks.map((p, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0"
                style={{ backgroundColor: tokens.textPrimary, color: tokens.textDark }}>
                {i + 1}
              </div>
              <div>
                <p className="text-[11px] font-medium" style={{ color: tokens.textLabel }}>{fmtDate(p.date)}</p>
                <p className="text-base font-bold leading-tight" style={{ color: tokens.textPrimary }}>
                  {p.value} {p.unit}
                </p>
                <p className="text-xs" style={{ color: tokens.textSecondary }}>{p.label}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Volume Trend ─────────────────────────────────────────────
function VolumeTrend({ metrics, isYearly }: { metrics: HealthMetric[]; isYearly: boolean }) {
  const [activeKey, setActiveKey] = useState('activeMinutes')
  const metric = metrics.find(m => m.key === activeKey)
  const raw = metric?.dataPoints ?? []
  type G = { label: string; value: number }
  let grouped: G[] = []
  if (isYearly) {
    grouped = toMonthly(raw).map(p => ({
      label: new Date(p.date + '-01').toLocaleString('default', { month: 'short' }), value: p.value
    }))
  } else {
    const weeks = new Map<number, number[]>()
    raw.forEach((p, i) => {
      const w = Math.floor(i / 7)
      if (!weeks.has(w)) weeks.set(w, [])
      weeks.get(w)!.push(p.value)
    })
    grouped = Array.from(weeks.entries()).map(([w, vals]) => ({
      label: 'W' + (w + 1), value: Math.round(vals.reduce((a, b) => a + b, 0) / vals.length)
    }))
  }

  const maxVal = Math.max(...grouped.map(g => g.value), 1)
  const H = 100
  const opts = [
    { key: 'activeMinutes', label: 'Active' },
    { key: 'calories', label: 'Calories' },
    { key: 'steps', label: 'Steps' },
  ]

  return (
    <div style={{ ...cardStyle, borderRadius: tokens.radiusLg, padding: tokens.cardPad }}>
      <div className="flex items-center justify-between mb-4">
        <p style={CARD_HEADER}>
          Volume Trend
        </p>
        <div className="flex gap-1">
          {opts.map(o => (
            <button key={o.key} onClick={() => setActiveKey(o.key)}
              className="text-[9px] px-2.5 py-1.5 rounded-lg font-bold uppercase tracking-wide transition-colors"
              style={{
                backgroundColor: activeKey === o.key ? tokens.textPrimary : tokens.bg,
                color: activeKey === o.key ? tokens.textDark : tokens.textSecondary,
              }}>
              {o.label}
            </button>
          ))}
        </div>
      </div>
      {(() => {
        const callout = getTrendCallout(metrics, activeKey)
        return callout ? (
          <p className="mb-4" style={{ fontSize: 12, fontWeight: 500, color: callout.includes('↑') ? '#2D7A52' : callout.includes('↓') ? tokens.chartBar : tokens.textSecondary }}>
            {callout}
          </p>
        ) : null
      })()}
      {!grouped.length ? (
        <p className="text-sm" style={{ color: tokens.textLabel }}>No data.</p>
      ) : (
        <div className="flex items-end justify-between gap-1 mt-4" style={{ height: H + 28 }}>
          {grouped.map((g, i) => {
            const barH = Math.max(6, (g.value / maxVal) * H)
            const isMax = g.value === maxVal
            return (
              <div key={i} className="flex flex-col items-center gap-1 flex-1">
                <span className="text-[9px] font-bold" style={{ color: tokens.textSecondary, minHeight: 14, display: 'flex', alignItems: 'flex-end' }}>
                  {isMax ? fmtVal(g.value) : ''}
                </span>
                <div className="w-full rounded-t-md"
                  style={{ height: barH, backgroundColor: isMax ? tokens.chartBar : tokens.chartBarLight, minWidth: 8 }}/>
                <span className="text-[9px] font-semibold" style={{ color: tokens.textLabel }}>{g.label}</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Line Chart ───────────────────────────────────────────────
function LineChart({ current, isYearly }: { current: DataPoint[]; isYearly: boolean }) {
  const cur = isYearly ? toMonthly(current) : current
  if (cur.length < 2) return <p className="text-xs mt-3" style={{ color: tokens.textLabel }}>Not enough data</p>

  const W = 600, H = 160, PL = 44, PR = 16, PT = 24, PB = 24
  const pW = W - PL - PR, pH = H - PT - PB
  const vals = cur.map(p => p.value)
  const ticks = threeTicks(vals)
  const tMn = ticks[0], tMx = ticks[ticks.length - 1], rng = tMx - tMn || 1
  const tx = (i: number) => PL + (i / Math.max(cur.length - 1, 1)) * pW
  const ty = (v: number) => PT + pH - Math.min(1, Math.max(0, (v - tMn) / rng)) * pH
  const path = cur.map((p, i) => (i === 0 ? 'M' : 'L') + tx(i).toFixed(1) + ',' + ty(p.value).toFixed(1)).join(' ')
  const mxI = cur.reduce((mi, p, i) => p.value > cur[mi].value ? i : mi, 0)
  const mnI = cur.reduce((mi, p, i) => p.value < cur[mi].value ? i : mi, 0)
  const anc = (i: number, total: number) => i < total * 0.15 ? 'start' : i > total * 0.85 ? 'end' : 'middle'

  const step = cur.length > 14 ? Math.ceil(cur.length / 7) : 1
  const xLbls = cur
    .map((p, i) => ({
      i, lbl: isYearly
        ? new Date(p.date + '-01').toLocaleString('default', { month: 'short' })
        : new Date(p.date + 'T00:00:00').toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })
    }))
    .filter((_, i) => i === 0 || i === cur.length - 1 || i % step === 0)

  return (
    <div className="w-full mt-4">
      <svg
        viewBox={'0 0 ' + W + ' ' + H}
        style={{ width: '100%', height: 'auto', display: 'block' }}
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Grid lines */}
        {ticks.map((t, ti) => (
          <g key={ti}>
            <line x1={PL} y1={ty(t).toFixed(1)} x2={W - PR} y2={ty(t).toFixed(1)}
              stroke="#F0EDE6" strokeWidth="1"/>
            <text x={PL - 6} y={ty(t)} textAnchor="end" dominantBaseline="middle"
              fontSize="10" fill={tokens.textLabel} fontWeight="500">{fmtVal(t)}</text>
          </g>
        ))}

        {/* Area fill */}
        <defs>
          <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={tokens.textPrimary} stopOpacity="0.06"/>
            <stop offset="100%" stopColor={tokens.textPrimary} stopOpacity="0"/>
          </linearGradient>
        </defs>
        <path
          d={path + ' L' + tx(cur.length - 1).toFixed(1) + ',' + (PT + pH) + ' L' + PL + ',' + (PT + pH) + ' Z'}
          fill="url(#lineGrad)"
        />

        {/* Line */}
        <path d={path} fill="none" stroke={tokens.chartBar} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>

        {/* Data dots */}
        {cur.map((p, i) => (
          <circle key={i} cx={tx(i).toFixed(1)} cy={ty(p.value).toFixed(1)} r="3"
            fill="#FFFFFF" stroke={tokens.chartBar} strokeWidth="1.5"/>
        ))}

        {/* Max label */}
        <circle cx={tx(mxI).toFixed(1)} cy={ty(cur[mxI].value).toFixed(1)} r="4.5"
          fill={tokens.accentGreen} stroke="white" strokeWidth="1.5"/>
        <text x={tx(mxI)} y={ty(cur[mxI].value) - 10} textAnchor={anc(mxI, cur.length)}
          fontSize="9.5" fill={tokens.accentGreen} fontWeight="700">{fmtVal(cur[mxI].value)}</text>

        {/* Min label */}
        {mxI !== mnI && <>
          <circle cx={tx(mnI).toFixed(1)} cy={ty(cur[mnI].value).toFixed(1)} r="4.5"
            fill={tokens.chartBar} stroke="white" strokeWidth="1.5"/>
          <text x={tx(mnI)} y={Math.min(ty(cur[mnI].value) + 16, H - 4)}
            textAnchor={anc(mnI, cur.length)} fontSize="9.5" fill={tokens.chartBar} fontWeight="700">
            {fmtVal(cur[mnI].value)}
          </text>
        </>}

        {/* X axis labels */}
        {xLbls.map(({ i, lbl }) => (
          <text key={i} x={tx(i)} y={H - 4} textAnchor="middle"
            fontSize="9.5" fill={tokens.textLabel} fontWeight="500">{lbl}</text>
        ))}
      </svg>
    </div>
  )
}

// ─── Active Minutes Chart ─────────────────────────────────────
function ActiveMinutesChart({ current, isYearly }: { current: DataPoint[]; isYearly: boolean }) {
  const pts = isYearly ? toMonthly(current) : current
  if (!pts.length) return null

  const W = 600, H = 140, PL = 44, PR = 16, PT = 16, PB = 28
  const pW = W - PL - PR, pH = H - PT - PB
  const maxVal = Math.max(...pts.map(p => p.value), 1)
  const ticks = threeTicks(pts.map(p => p.value))
  const bW = Math.max(8, Math.min(32, Math.floor(pW / pts.length) - 4))
  const gap = (pW - bW * pts.length) / Math.max(pts.length - 1, 1)
  const step = pts.length > 14 ? Math.ceil(pts.length / 7) : 1

  return (
    <div className="w-full mt-4">
      <svg
        viewBox={'0 0 ' + W + ' ' + H}
        style={{ width: '100%', height: 'auto', display: 'block' }}
        preserveAspectRatio="xMidYMid meet"
      >
        {ticks.map((t, ti) => {
          const y = PT + pH - (t / maxVal) * pH
          return (
            <g key={ti}>
              <line x1={PL} y1={y} x2={W - PR} y2={y} stroke="#F0EDE6" strokeWidth="1"/>
              <text x={PL - 6} y={y} textAnchor="end" dominantBaseline="middle"
                fontSize="10" fill={tokens.textLabel} fontWeight="500">{fmtVal(t)}</text>
            </g>
          )
        })}
        {pts.map((p, i) => {
          const x = PL + i * (bW + gap)
          const barH = Math.max(2, (p.value / maxVal) * pH)
          const isMax = p.value === Math.max(...pts.map(pt => pt.value))
          const lbl = isYearly
            ? new Date(p.date + '-01').toLocaleString('default', { month: 'short' })
            : new Date(p.date + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
          const showLbl = pts.length <= 14 || i % step === 0 || i === pts.length - 1
          return (
            <g key={i}>
              <rect x={x} y={PT + pH - barH} width={bW} height={barH}
                fill={isMax ? tokens.chartBar : tokens.chartBarLight} rx="3"/>
              {isMax && (
                <text x={x + bW / 2} y={PT + pH - barH - 5} textAnchor="middle"
                  fontSize="9" fill={tokens.chartBar} fontWeight="700">{fmtVal(p.value)}</text>
              )}
              {showLbl && (
                <text x={x + bW / 2} y={H - 4} textAnchor="middle"
                  fontSize="9" fill={tokens.textLabel} fontWeight="500">{lbl}</text>
              )}
            </g>
          )
        })}
      </svg>
    </div>
  )
}

// ─── Metric Card ─────────────────────────────────────────────
function MetricCard({ metric, size, period, comparisonPoints }: {
  metric: HealthMetric; size: 'small' | 'large'; period: Period; comparisonPoints?: DataPoint[]
}) {
  const isTS = period !== 'day', isYr = period === '1y'
  const dv = isTS ? (metric.avg ?? metric.value) : metric.value
  const hasV = dv !== '—' && dv !== '' && dv !== 0
  const warn = isTS && hasV && isLowPerf(metric)
  const cMx = metric.dataPoints?.length ? Math.max(...metric.dataPoints.map(p => p.value)) : 0
  const pMx = (comparisonPoints?.length ?? 0) > 0 ? Math.max(...(comparisonPoints ?? []).map(p => p.value)) : 0
  const isBest = period === '30d' && cMx > 0 && (comparisonPoints?.length ?? 0) > 0 && cMx > pMx
  const isAM = metric.key === 'activeMinutes'
  const hasCh = isTS && (metric.dataPoints?.length ?? 0) >= 2

  return (
    <div className={'flex flex-col relative ' + (size === 'large' ? 'col-span-2' : '')}
      style={{ ...cardStyle, borderRadius: tokens.radiusLg, padding: tokens.cardPad,
        backgroundColor: warn ? '#FEF6F6' : tokens.bgCard }}>
      {isBest && (
        <div className="absolute top-3 right-3 text-[9px] font-semibold px-2 py-0.5 rounded-full"
          style={{ backgroundColor: '#FDF3D0', color: '#8B6914' }}>Best 30d 🏆</div>
      )}
      <p style={CARD_HEADER}>{metric.label}</p>
      <div className="flex items-baseline gap-1.5 mt-1">
        <span className={'font-bold leading-none ' + (size === 'large' ? 'text-4xl' : 'text-3xl')}
          style={{ color: hasV ? tokens.textPrimary : '#D4CFC8' }}>
          {hasV ? dv : '—'}
        </span>
        {hasV && <span className="text-xs" style={{ color: tokens.textLabel }}>{metric.unit}</span>}
      </div>
      {hasCh && (isAM
        ? <ActiveMinutesChart current={metric.dataPoints!} isYearly={isYr}/>
        : <LineChart current={metric.dataPoints!} isYearly={isYr}/>
      )}
      {warn && <p className="text-[10px] mt-2 font-medium" style={{ color: tokens.accentRed }}>Consistently low</p>}
    </div>
  )
}

// ─── Insights Strip ───────────────────────────────────────────
function InsightsStrip({ insights, loading }: { insights: string[]; loading: boolean }) {
  if (loading) return (
    <div className="flex gap-3 mb-4">
      {[0,1,2].map(i => <div key={i} className="flex-1 h-20 rounded-xl animate-pulse" style={{ backgroundColor: '#E8E4DA' }}/>)}
    </div>
  )
  if (!insights.length) return null
  const labels = ['CHANGE', 'PATTERN', 'ACTION']
  const icons = ['↗', '◎', '→']
  return (
    <div className="flex flex-col md:flex-row gap-3 mb-4">
      {insights.map((ins, i) => (
        <div key={i} className="flex-1 rounded-xl p-4 flex flex-col gap-2"
          style={{ backgroundColor: tokens.bgDark, borderRadius: tokens.radiusMd }}>
          <div className="flex items-center gap-2">
            <span className="text-sm" style={{ color: '#78716C' }}>{icons[i]}</span>
            <p className="text-[10px] uppercase tracking-widest font-bold" style={{ color: '#5A5550' }}>{labels[i]}</p>
          </div>
          <p className="text-xs leading-relaxed" style={{ color: '#D4CFC8' }}>{ins}</p>
        </div>
      ))}
    </div>
  )
}

function formatSyncTime(iso: string): string {
  if (!iso || iso === 'never') return 'Never synced'
  try { return new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }) }
  catch { return iso }
}

function extractSyncDate(iso: string): string {
  try { return new Date(iso).toISOString().split('T')[0] }
  catch { return new Date().toISOString().split('T')[0] }
}

type Member = { id: string; name: string; relation: string; isSelf?: boolean };

// ─── Main ─────────────────────────────────────────────────────
function DashboardInner() {
  const params = useSearchParams()
  const provider = params.get('connected') ?? 'fitbit'
  const supabase = createClient()
  const [period, setPeriod] = useState<Period>('day')
  const [metrics, setMetrics] = useState<HealthMetric[]>([])
  const [config, setConfig] = useState<DashboardConfig | null>(null)
  const [cmap, setCmap] = useState<Record<string, DataPoint[]>>({})
  const [progress, setProgress] = useState(0)
  const [loading, setLoading] = useState(false)
  const [syncRaw, setSyncRaw] = useState('')
  const [syncDate, setSyncDate] = useState('')
  const [never, setNever] = useState(false)
  const [insights, setInsights] = useState<string[]>([])
  const [insLoad, setInsLoad] = useState(false)
  const [activities, setActivities] = useState<Activity[]>([])
  const [tones, setTones] = useState<Tone[]>(['companion' as Tone, 'analyst' as Tone])
  const [prevMetricsMap, setPrevMetricsMap] = useState<Record<string, DataPoint[]>>({})
  const { selected: forMember } = useMember()
  const isSelf = !forMember || forMember.isSelf === true

  const memberParam = forMember && !forMember.isSelf ? `&memberId=${forMember.id}` : ''
  const connectedParam = params.get('connected')

  // useEffect(() => {
  //   async function loadMembers() {
  //     const { data: { user } } = await supabase.auth.getUser()
  //     if (!user) return
  //     const name = user.user_metadata?.full_name?.split(' ')[0] ?? 'You'
  //     const self: Member = { id: user.id, name, relation: 'Self', isSelf: true }
  //     const { data: fam } = await supabase.from('family_members').select('*').eq('owner_id', user.id)
  //     setMembers([self, ...(fam ?? []).map(m => ({ id: m.id, name: m.name, relation: m.relation }))])
  //     setForMember(self)
  //   }
  //   loadMembers()
  // }, [])

  useEffect(() => {
    if (!isSelf) return
    fetch('/api/data/' + provider + '?endpoint=sync')
      .then(r => {
        if (r.status === 401) { setNever(true); return null }
        return r.ok ? r.json() : null
      })
      .then(d => {
        if (!d) return  // ← add this guard
        const v = d?.metrics?.[0]?.value ?? 'never'
        setSyncRaw(v)
        if (v === 'never') { setNever(true); return }
        setNever(false)
        setSyncDate(extractSyncDate(v))
      }).catch(() => { setNever(true) })
  }, [provider, isSelf, connectedParam])

  const fetchComp = useCallback(async (p: Period, sd: string) => {
    if (p === 'day') return {}
    const shift = p === '1y' ? 365 : 30
    const map: Record<string, DataPoint[]> = {}
    for (const ep of DATA_ENDPOINTS.filter(e => e !== 'sync' && e !== 'activityLog')) {
      try {
        const r = await fetch('/api/data/' + provider + '?endpoint=' + ep + '&syncDate=' + sd + '&period=' + p + '&shift=' + shift + memberParam)
        if (r.ok) {
          const { metrics: ms } = await r.json()
          for (const m of ms) { if ((m.dataPoints?.length ?? 0) >= 2) map[m.key] = m.dataPoints }
        }
      } catch {}
    }
    setPrevMetricsMap(map)
    return map
  }, [provider])

  const fetchInsights = useCallback(async (cur: HealthMetric[], prev: Record<string, DataPoint[]>, p: Period) => {
    if (p === 'day' || !cur.length) return
    setInsLoad(true); setInsights([])
    try {
      const cs = buildInsightsSummary(cur, p)
      const pl = Object.entries(prev).filter(([, pts]) => pts.length >= 2).map(([k, pts]) => {
        const vs = pts.map(pt => pt.value).filter(v => v > 0)
        if (!vs.length) return null
        const avg = (vs.reduce((a, b) => a + b, 0) / vs.length).toFixed(1)
        const m = cur.find(m => m.key === k)
        return (m?.label ?? k) + ': avg ' + avg + ' ' + (m?.unit ?? '')
      }).filter(Boolean)
      const r = await fetch('/api/insights', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentSummary: cs, previousSummary: pl.join('\n'), period: p }),
      })
      if (r.ok) { const { insights: ins } = await r.json(); setInsights(ins) }
    } catch {}
    setInsLoad(false)
  }, [])

  const fetchData = useCallback(async (p: Period, sd: string) => {
    if (!sd) return
    setLoading(true); setProgress(0); setMetrics([]); setInsights([])
    setConfig(null); setCmap({}); setActivities([])
    const all: HealthMetric[] = []
    for (let i = 0; i < DATA_ENDPOINTS.length; i++) {
      try {
        const r = await fetch('/api/data/' + provider + '?endpoint=' + DATA_ENDPOINTS[i] + '&syncDate=' + sd + '&period=' + p + memberParam)
        if (r.ok) {
          const { metrics: ms } = await r.json()
          if (DATA_ENDPOINTS[i] === 'activityLog') {
            setActivities(ms?.[0]?.extra ?? [])
          } else {
            all.push(...ms)
            setMetrics([...all])
            setConfig(buildDashboardConfig(all.filter(m => m.key !== 'activityLog'), p))
          }
        }
      } catch {}
      setProgress(Math.round(((i + 1) / DATA_ENDPOINTS.length) * 100))
    }
    setLoading(false)
    const pm = await fetchComp(p, sd)
    fetchInsights(all.filter(m => m.key !== 'activityLog'), pm ?? {}, p)
  }, [provider, fetchComp, fetchInsights])

  // // useEffect(() => { if (syncDate) fetchData(period, syncDate) }, [period, syncDate, fetchData])
  // if (!isSelf) return
  //   useEffect(() => { if (syncDate && forMember !== undefined) fetchData(period, syncDate) }, [period, syncDate, forMember, fetchData])

  useEffect(() => {
    if (syncDate && forMember !== undefined) {
      fetchData(period, syncDate)
    }
  }, [period, syncDate, forMember, fetchData])

  useEffect(() => { 
    if (syncDate && isSelf) fetchData(period, syncDate) 
  }, [period, syncDate, fetchData, isSelf])

  const displayMetrics = metrics.filter(m => m.key !== 'activityLog')
  const isYearly = period === '1y'
  
  const { refreshDevices } = useMember()
  const { connectedDevices } = useMember()
  const fitbitConnected = connectedDevices.includes('Fitbit')

  if (!isSelf) return (
    <div className="flex min-h-screen items-center justify-center" style={{ backgroundColor: tokens.bg }}>
      <div className="text-center space-y-3">
        <p className="text-sm" style={{ color: tokens.textSecondary }}>
          {forMember?.name} hasn&apos;t connected a wearable device yet.
        </p>
        <a
          href="/connect"
          className="inline-block text-sm font-semibold px-5 py-2.5 rounded-xl text-white"
          style={{ background: tokens.textPrimary }}
        >
          Connect their device
        </a>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="px-6 py-5">

        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            {/* <h1 className="font-serif text-2xl font-bold" style={{ color: tokens.textPrimary }}>Dashboard</h1> */}
            <h1 className="text-xl font-semibold text-gray-900">Dashboard</h1>
            {syncRaw && !never && (
              <p className="text-xs mt-0.5" style={{ color: tokens.textLabel }}>
                Last sync: {formatSyncTime(syncRaw)}
              </p>
            )}
          </div>
          <div className="flex items-center gap-3">
            {/* Period selector */}
            {!never && (
              <div className="flex items-center gap-1 p-1 rounded-xl" style={{ backgroundColor: tokens.bgCard, boxShadow: tokens.cardShadow }}>
                {PERIOD_OPTIONS.map(opt => (
                  <button key={opt.value} onClick={() => setPeriod(opt.value)}
                    className="text-xs px-4 py-2 rounded-lg font-semibold transition-all"
                    style={{
                      backgroundColor: period === opt.value ? tokens.textPrimary : 'transparent',
                      color: period === opt.value ? tokens.textDark : tokens.textSecondary,
                    }}>
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
            <a href="/connect"
              className="text-xs font-semibold px-4 py-2 rounded-xl transition-opacity hover:opacity-80"
              style={{ backgroundColor: tokens.bgDark, color: tokens.textDark, borderRadius: tokens.radiusMd }}>
              + Device
            </a>
            {fitbitConnected && (
              <button onClick={async () => {
                await fetch('/api/auth/fitbit/logout', { method: 'POST' })
                refreshDevices()
                window.location.reload()
                }}
                className="text-xs font-semibold px-4 py-2 rounded-xl transition-opacity hover:opacity-80"
                style={{ backgroundColor: '#fff', color: '#000', borderRadius: tokens.radiusMd }}>
                Sign out Fitbit
              </button>
            )}
          </div>
        </div>

        {/* {members.length > 1 && (
        <div className="flex items-center gap-2 flex-wrap mb-4">
          <span className="text-[12px] text-gray-400 uppercase tracking-wide font-medium mr-1">FOR</span>
          {members.map(m => (
            <button key={m.id} onClick={() => setForMember(m)}
              className={cn("flex items-center gap-2 px-3 py-1.5 rounded-full border text-[13px] transition-colors",
                forMember?.id === m.id
                  ? "border-navy bg-navy text-white font-medium"
                  : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
              )}>
              <span className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold"
                style={{ background: forMember?.id === m.id ? "rgba(255,255,255,0.3)" : "#9CA3AF", color: "white" }}>
                {m.name.split(' ').map((n:string) => n[0]).join('').slice(0,2)}
              </span>
              {m.name}
              <span className={cn("text-[11px]", forMember?.id === m.id ? "text-blue-200" : "text-gray-400")}>
                · {m.isSelf ? 'You' : m.relation}
              </span>
            </button>
          ))}
        </div>
      )} */}

        {/* Progress bar */}
        {loading && (
          <div className="mb-4">
            <div className="flex justify-between mb-1">
              <p className="text-xs" style={{ color: tokens.textSecondary }}>Fetching data...</p>
              <p className="text-xs" style={{ color: tokens.textLabel }}>{progress}%</p>
            </div>
            <div className="h-0.5 rounded-full overflow-hidden" style={{ backgroundColor: tokens.border }}>
              <div className="h-full rounded-full transition-all duration-300" style={{ width: progress + '%', backgroundColor: tokens.textPrimary }}/>
            </div>
          </div>
        )}

        {/* Never synced */}
        {never && (
          <div className="rounded-2xl p-16 text-center" style={{ ...cardStyle, borderRadius: tokens.radiusXl }}>
            <p className="text-sm mb-4" style={{ color: tokens.textSecondary }}>Your device has never synced.</p>
            <button onClick={() => { window.location.href = '/api/auth/' + provider }}
              className="inline-block text-sm font-semibold px-6 py-3 rounded-xl"
              style={{ backgroundColor: tokens.textPrimary, color: tokens.textDark }}>
              Reconnect Fitbit
            </button>
          </div>
        )}

        {/* ── DAILY ── */}
        {period === 'day' && displayMetrics.length > 0 && (
          <>
            <StoryCard period={period} metrics={displayMetrics} previousMetrics={{}} tones={tones} onTonesChange={setTones} dataLoading={loading}/>
            <SnapshotBar metrics={displayMetrics} period={period}/>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <PrimeTrainingWindow metrics={displayMetrics}/>
              <EnergyDonut metrics={displayMetrics}/>
              <ActivityTimeline activities={activities}/>
            </div>
          </>
        )}

        {/* ── 30 DAY ── */}
        {period === '30d' && displayMetrics.length > 0 && (
          <>
            <StoryCard period={period} metrics={displayMetrics} previousMetrics={prevMetricsMap} tones={tones} onTonesChange={setTones} dataLoading={loading}/>
            <SnapshotBar metrics={displayMetrics} period={period}/>
            <ConsistencyMatrix metrics={displayMetrics} isYearly={false}/>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <EfficiencyScore metrics={displayMetrics}/>
              <PeakPerformanceDays metrics={displayMetrics}/>
              <VolumeTrend metrics={displayMetrics} isYearly={false}/>
            </div>
          </>
        )}

        {/* ── YEARLY ── */}
        {period === '1y' && displayMetrics.length > 0 && (
          <>
            <StoryCard period={period} metrics={displayMetrics} previousMetrics={prevMetricsMap} tones={tones} onTonesChange={setTones} dataLoading={loading}/>
            <SnapshotBar metrics={displayMetrics} period={period}/>
            <AnnualBar metrics={displayMetrics}/>
            <ConsistencyMatrix metrics={displayMetrics} isYearly={true}/>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <EfficiencyScore metrics={displayMetrics}/>
              <PeakPerformanceDays metrics={displayMetrics}/>
              <VolumeTrend metrics={displayMetrics} isYearly={true}/>
            </div>
          </>
        )}

        {/* Metric sections — exclude activity and body (covered by snapshot) */}
        {config && config.sections
          .filter((section: DashboardConfig['sections'][0]) =>
            !['activity', 'body'].includes(section.category)
          )
          .map((section: DashboardConfig['sections'][0]) => (
            <div key={section.category} className="mb-4">
              <p className="mb-3" style={CARD_HEADER}>{section.label}</p>
              <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                {section.metrics.map((ml: DashboardConfig['sections'][0]['metrics'][0], idx: number) => (
                  <MetricCard
                    key={section.category + ':' + ml.metric.key + ':' + idx}
                    metric={ml.metric} size={ml.size} period={period}
                    comparisonPoints={cmap[ml.metric.key]}
                  />
                ))}
              </div>
            </div>
          ))}

        {config?.isEmpty && !loading && !never && (
          <div className="rounded-2xl p-16 text-center" style={{ ...cardStyle, borderRadius: tokens.radiusXl }}>
            <p className="text-sm" style={{ color: tokens.textSecondary }}>No data available for this period.</p>
          </div>
        )}
      </main>
    </div>
  )
}

export default function Dashboard() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center" style={{ backgroundColor: tokens.bg }}>
        <p className="text-sm" style={{ color: tokens.textLabel }}>Loading...</p>
      </div>
    }>
      <DashboardInner/>
    </Suspense>
  )
}