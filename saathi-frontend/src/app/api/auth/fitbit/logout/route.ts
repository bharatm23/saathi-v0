import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'

export async function POST() {
  const session = await getSession()
  if (session.tokens?.fitbit) {
    delete session.tokens.fitbit
    await session.save()
  }
  return NextResponse.json({ success: true })
}