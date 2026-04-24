import crypto from 'crypto'

export const generateCodeVerifier = () => crypto.randomBytes(32).toString('base64url')
export const generateCodeChallenge = (v: string) => crypto.createHash('sha256').update(v).digest('base64url')
export const generateState = () => crypto.randomBytes(16).toString('hex')