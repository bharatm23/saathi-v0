import Link from 'next/link'
import Sidebar from '../components/sidebar'
import { tokens, cardStyle } from '@/lib/design-tokens'

const DEVICES = [
  {
    id: 'fitbit', name: 'Fitbit', desc: 'Track steps, sleep & heart rate',
    available: true,
    logo: (
      <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: '#E8F4F5' }}>
        <svg width="22" height="22" viewBox="0 0 28 28" fill="none">
          <circle cx="9" cy="14" r="2.2" fill="#00B0B9"/>
          <circle cx="14" cy="14" r="2.2" fill="#00B0B9"/>
          <circle cx="19" cy="14" r="2.2" fill="#00B0B9"/>
          <circle cx="9" cy="9" r="1.6" fill="#00B0B9"/>
          <circle cx="14" cy="9" r="1.6" fill="#00B0B9"/>
          <circle cx="19" cy="9" r="1.6" fill="#00B0B9"/>
          <circle cx="9" cy="19" r="1.6" fill="#00B0B9"/>
          <circle cx="14" cy="19" r="1.6" fill="#00B0B9"/>
          <circle cx="19" cy="19" r="1.6" fill="#00B0B9"/>
        </svg>
      </div>
    ),
  },
  {
    id: 'garmin', name: 'Garmin', desc: 'Track steps, sleep & heart rate',
    available: false,
    logo: (
      <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: '#E8F0F8' }}>
        <svg width="22" height="22" viewBox="0 0 28 28" fill="none">
          <path d="M14 4C8.477 4 4 8.477 4 14s4.477 10 10 10 10-4.477 10-10S19.523 4 14 4z" fill="#007DC3" opacity="0.15"/>
          <text x="14" y="19" textAnchor="middle" fontSize="13" fontWeight="700" fill="#007DC3" fontFamily="Arial">G</text>
        </svg>
      </div>
    ),
  },
  {
    id: 'polar', name: 'Polar', desc: 'Track steps, sleep & heart rate',
    available: false,
    logo: (
      <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: '#F8E8E8' }}>
        <svg width="22" height="22" viewBox="0 0 28 28" fill="none">
          <path d="M14 5L19 10H14V23M14 5L9 10H14" stroke="#D42B2B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
        </svg>
      </div>
    ),
  },
  {
    id: 'oura', name: 'Oura', desc: 'Track steps, sleep & heart rate',
    available: false,
    logo: (
      <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: '#F0F0F0' }}>
        <svg width="22" height="22" viewBox="0 0 28 28" fill="none">
          <circle cx="14" cy="14" r="8" stroke="#1A1814" strokeWidth="2" fill="none"/>
          <circle cx="14" cy="14" r="3" stroke="#1A1814" strokeWidth="1.5" fill="none"/>
        </svg>
      </div>
    ),
  },
]

function Badge({ active }: { active: boolean }) {
  return (
    <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full"
      style={{
        backgroundColor: active ? tokens.accentGreenBg : tokens.accentAmberBg,
        color: active ? '#2D7A52' : '#8B6914',
      }}>
      {active ? 'Active' : 'Soon'}
    </span>
  )
}

export default function Connect() {
  return (
    <div className="flex min-h-screen" style={{ backgroundColor: tokens.bg }}>
      <Sidebar />
      <main className="flex-1 ml-[80px] flex items-center justify-center p-8">
        <div className="w-full max-w-2xl">

          <h1 className="font-serif text-4xl font-bold mb-8 tracking-tight" style={{ color: tokens.textPrimary }}>
            Connect your device
          </h1>

          {/* Playground CTA */}
          <Link href="/playground"
            className="flex items-center justify-between rounded-2xl px-7 py-5 mb-5 transition-opacity hover:opacity-90"
            style={{ backgroundColor: tokens.bgDark, borderRadius: tokens.radiusLg }}>
            <span className="text-base font-semibold" style={{ color: tokens.textDark }}>Try the playground</span>
            <span style={{ color: tokens.textDarkMuted }}>&#8594;</span>
          </Link>

          {/* 2x2 device grid */}
          <div className="grid grid-cols-2 gap-3 mb-3">
            {DEVICES.map(d => d.available ? (
              <Link key={d.id} href={'/api/auth/' + d.id}
                className="flex items-center justify-between p-5 transition-all hover:scale-[1.01]"
                style={{ ...cardStyle, borderRadius: tokens.radiusLg }}>
                <div className="flex items-center gap-4">
                  {d.logo}
                  <div>
                    <p className="text-sm font-semibold" style={{ color: tokens.textPrimary }}>{d.name}</p>
                    <p className="text-xs mt-0.5" style={{ color: tokens.textLabel }}>{d.desc}</p>
                  </div>
                </div>
                <Badge active={true} />
              </Link>
            ) : (
              <div key={d.id} className="flex items-center justify-between p-5"
                style={{ ...cardStyle, borderRadius: tokens.radiusLg, opacity: 0.75 }}>
                <div className="flex items-center gap-4">
                  {d.logo}
                  <div>
                    <p className="text-sm font-semibold" style={{ color: tokens.textPrimary }}>{d.name}</p>
                    <p className="text-xs mt-0.5" style={{ color: tokens.textLabel }}>{d.desc}</p>
                  </div>
                </div>
                <Badge active={false} />
              </div>
            ))}
          </div>

          {/* Upload */}
          <div className="flex flex-col items-center justify-center gap-2 py-8 rounded-2xl"
            style={{ border: '2px dashed ' + tokens.border, borderRadius: tokens.radiusLg }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M12 16V8M12 8L9 11M12 8L15 11" stroke={tokens.textLabel} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M4 18h16" stroke={tokens.textLabel} strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
            <p className="text-sm font-medium" style={{ color: tokens.textSecondary }}>Upload your data</p>
            <p className="text-xs" style={{ color: tokens.textLabel }}>CSV, JSON or exported health files</p>
          </div>

        </div>
      </main>
    </div>
  )
}