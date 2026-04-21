'use client'

const DASHBOARD_URL = process.env.NEXT_PUBLIC_DASHBOARD_URL ?? 'http://localhost:3000'

export default function DashboardPage() {
  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-4 bg-white border-b border-gray-200 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Health Dashboard</h1>
          <p className="text-sm text-gray-400 mt-0.5">Wearable metrics — synced to Saathi</p>
        </div>
        <a href={DASHBOARD_URL} target="_blank" rel="noopener noreferrer"
          className="text-xs hover:underline" style={{ color: '#1A56A0' }}>
          Open full screen ↗
        </a>
      </div>
      <iframe src={DASHBOARD_URL} className="flex-1 w-full border-0" title="Health Dashboard" loading="lazy" />
    </div>
  )
}
