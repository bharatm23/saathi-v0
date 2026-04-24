import { NextRequest, NextResponse } from 'next/server'
import { providers } from '@/lib/providers'
import { generateCodeVerifier, generateCodeChallenge, generateState } from '@/lib/pkce'
import { getSession } from '@/lib/session'

export async function GET(req: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const { provider: id } = await params
  const provider = providers[id as keyof typeof providers]
  if (!provider) return NextResponse.json({ error: 'Unknown provider' }, { status: 400 })

  const codeVerifier = generateCodeVerifier()
  const state = generateState()

  const session = await getSession()
  session.oauth = { state, codeVerifier, provider: id }
  await session.save()

  const base = process.env.NEXT_PUBLIC_BASE_URL!
  const url = new URL(provider.authUrl)
  url.searchParams.set('client_id', provider.clientId)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', provider.scopes.join(' '))
  url.searchParams.set('state', state)
  url.searchParams.set('code_challenge', generateCodeChallenge(codeVerifier))
  url.searchParams.set('code_challenge_method', 'S256')
  url.searchParams.set('redirect_uri', base + '/api/auth/' + id + '/callback')

  const res = NextResponse.redirect(url.toString())

  // Also store state in a plain cookie as fallback for SameSite issues
  res.cookies.set('oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 10, // 10 minutes
    path: '/',
  })
  res.cookies.set('oauth_verifier', codeVerifier, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 10,
    path: '/',
  })
  res.cookies.set('oauth_provider', id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 10,
    path: '/',
  })

  return res
}