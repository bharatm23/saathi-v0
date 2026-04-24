import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'

export async function POST(req: NextRequest) {
  const { email } = await req.json()
  if (!email) return NextResponse.json({ error: 'Email required' }, { status: 400 })

  // Verify the email exists in Ultrahuman's system via partner API
  const res = await fetch(`https://partner.ultrahuman.com/api/v1/user?email=${encodeURIComponent(email)}`, {
    headers: {
      'Authorization': `Bearer ${process.env.ULTRAHUMAN_AUTH_TOKEN}`,
      'X-Partner-Id': process.env.ULTRAHUMAN_PARTNER_ID!,
    }
  })

  if (!res.ok) return NextResponse.json({ error: 'No Ultrahuman account found for this email.' }, { status: 404 })

  // Store the linked email as the "token" for this provider
  const session = await getSession()
  session.tokens = {
    ...session.tokens,
    ultrahuman: {
      accessToken: email,   // email is the identifier for Ultrahuman API calls
      refreshToken: '',
      expiresAt: Date.now() + 1000 * 60 * 60 * 24 * 365, // 1 year — no expiry on partner tokens
    }
  }
  await session.save()
  return NextResponse.json({ ok: true })
}