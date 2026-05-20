import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'

export async function GET() {
  const session = await getSession()
  const fitbit = session.tokens?.fitbit

  return NextResponse.json({
    fitbit: fitbit ? {
      connected: true,
      expiresAt: fitbit.expiresAt,
    } : { connected: false },
    garmin:     { connected: false },
    whoop:      { connected: false },
    ultrahuman: { connected: false },
  })
}