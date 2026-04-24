import { getIronSession, IronSession } from 'iron-session'
import { cookies } from 'next/headers'
import { StoredTokens } from './providers/types'
import crypto from 'crypto'

export interface SessionData {
  userId?: string  
  tokens?: Partial<Record<string, StoredTokens>>
  oauth?: { state: string; codeVerifier: string; provider: string }
}

export async function getSession(): Promise<IronSession<SessionData>> {
  return getIronSession<SessionData>(await cookies(), {
    password: process.env.SESSION_SECRET!,
    cookieName: 'hd-session',
    cookieOptions: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30,
    },
  })
}

export async function getOrCreateUserId(): Promise<string> {
  const session = await getSession()
  if (!session.userId) {
    session.userId = 'user_' + crypto.randomBytes(12).toString('hex')
    await session.save()
  }
  return session.userId
}