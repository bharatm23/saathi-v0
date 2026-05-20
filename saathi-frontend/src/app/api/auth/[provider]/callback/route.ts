import { NextRequest, NextResponse } from 'next/server'
import { providers } from '@/lib/providers'
import { getSession } from '@/lib/session'
import { saveConnection } from '@/lib/db'
import { getOrCreateUserId } from '@/lib/session'
import { createServerSupabaseClient } from '@/lib/supabase-server'

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

  // Fetch Fitbit profile to verify email match
  const profileRes = await fetch('https://api.fitbit.com/1/user/-/profile.json', {
    headers: { Authorization: `Bearer ${tokens.access_token}` }
  })
  const profile = await profileRes.json()
  const fitbitEmail = profile.user?.encodedId // Fitbit doesn't expose email directly

  // Get Supabase user
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  // If no Supabase session, don't store tokens
  if (!user) {
    return NextResponse.redirect(`${origin}/dashboard?error=not_logged_in`)
  }
  // Store userId alongside tokens so we can validate later
  session.tokens = { ...session.tokens, fitbit: { ...tokens, supabaseUserId: user.id } }
  await session.save()

  // Connection storage handled by iron-session (token saved in session.save() above)

  // Clear OAuth cookies
  const response = NextResponse.redirect(base + '/dashboard?connected=' + id)
  response.cookies.delete('oauth_state')
  response.cookies.delete('oauth_verifier')
  response.cookies.delete('oauth_provider')
  return response
}