import { NextRequest, NextResponse } from 'next/server'
import { providers } from '@/lib/providers'
import { getSession } from '@/lib/session'
import { saveConnection } from '@/lib/db'
import { getOrCreateUserId } from '@/lib/session'

export async function GET(req: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const { provider: id } = await params
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const base = process.env.NEXT_PUBLIC_BASE_URL!

  if (!code) return NextResponse.redirect(base + '/connect?error=no_code')

  // Try session first, fall back to plain cookies
  const session = await getSession()
  const cookieState    = req.cookies.get('oauth_state')?.value
  const cookieVerifier = req.cookies.get('oauth_verifier')?.value
  const cookieProvider = req.cookies.get('oauth_provider')?.value

  const expectedState    = session.oauth?.state    ?? cookieState
  const codeVerifier     = session.oauth?.codeVerifier ?? cookieVerifier
  const expectedProvider = session.oauth?.provider  ?? cookieProvider

  if (!expectedState || state !== expectedState || expectedProvider !== id || !codeVerifier) {
    return NextResponse.redirect(base + '/connect?error=invalid_state')
  }

  const provider = providers[id as keyof typeof providers]

  const res = await fetch(provider.tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: 'Basic ' + Buffer.from(provider.clientId + ':' + provider.clientSecret).toString('base64'),
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: base + '/api/auth/' + id + '/callback',
      code_verifier: codeVerifier,
    }),
  })

  if (!res.ok) return NextResponse.redirect(base + '/connect?error=token_failed')

  const tokens = await res.json()
  session.tokens = {
    ...session.tokens,
    [id]: {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: Date.now() + tokens.expires_in * 1000,
    },
  }
  session.oauth = undefined
  await session.save()

  // Save to DB
  try {
    const userId = await getOrCreateUserId()
    await saveConnection(
      userId, id,
      tokens.access_token,
      tokens.refresh_token ?? null,
      tokens.expires_in ? Date.now() + tokens.expires_in * 1000 : null
    )
  } catch {}

  // Clear OAuth cookies
  const response = NextResponse.redirect(base + '/dashboard?connected=' + id)
  response.cookies.delete('oauth_state')
  response.cookies.delete('oauth_verifier')
  response.cookies.delete('oauth_provider')
  return response
}