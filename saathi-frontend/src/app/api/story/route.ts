import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { getCachedLLM, setCachedLLM } from '@/lib/db'
import { getSupabaseUserId } from '@/lib/db'
import { createHash } from 'crypto'

// openAI rate limit hit
// const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
const openai = new OpenAI({ apiKey: process.env.OPENROUTER_API_KEY })

const TONE_MAP: Record<string, string> = {
  companion: 'Warm, personal, encouraging. Acknowledge effort. Celebrate small wins. Use "you" naturally.',
  analyst: 'Data-driven. Reference specific numbers and trends. Draw non-obvious connections between metrics.',
  coach: 'Direct, motivating, action-first. Use imperatives. Push harder. Short punchy sentences.',
  clinical: 'Precise and objective. State facts only. No emotional language. Clinical terminology where helpful.',
}

const PERIOD_CONTEXT: Record<string, string> = {
  day: 'today — a single day snapshot',
  '30d': 'the last 30 days — a monthly training block',
  '1y': 'the past year — an annual performance review',
}

export async function POST(req: NextRequest) {
  const { metrics, previousMetrics, period, tones = ['companion', 'analyst'] } = await req.json()

  const toneInstructions = (tones as string[])
    .map((t: string) => TONE_MAP[t])
    .filter(Boolean)
    .join(' Also: ')

  const prompt = `You are analyzing health and fitness data for ${PERIOD_CONTEXT[period] ?? period}.

Tone instructions: ${toneInstructions}

Current period metrics:
${metrics}

${previousMetrics ? 'Previous period for comparison:\n' + previousMetrics : ''}

Write a health narrative with exactly this JSON structure:
{
  "headline": "A single compelling sentence max 5-6 words capturing the key insight - punchy, specific, surpricing. No filler words.", 
  "narrative": "2-3 sentences telling the story — what happened, what drove it, what it means for the user",
  "actions": [
    "Specific action the user can take today or this week",
    "Second specific action based on a pattern in the data",
    "Third action that addresses the biggest gap or opportunity"
  ],
  "callout": "One short inline stat that would surprise the user — e.g. 'Your best month was 3x your worst'"
}

Rules:
- Never say obvious things like 'steps are below 10k'
- Reference specific numbers from the data
- Actions must be concrete and time-bound, not generic advice
- Callout must be a single short sentence, no more than 10 words
- Respond ONLY with valid JSON, no markdown`

  try {
    const userId = await getSupabaseUserId() ?? 'anonymous'
    const cacheKey = createHash('md5').update(JSON.stringify({ metrics, previousMetrics, period, tones })).digest('hex')
    const cached   = await getCachedLLM(userId, cacheKey)
    if (cached) return NextResponse.json(cached)
    const res = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 500,
      temperature: 0.6,
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
    })
    const data = JSON.parse(res.choices[0].message.content ?? '{}')
    await setCachedLLM(userId, cacheKey, 'story', period, data)
    return NextResponse.json(data)
  } catch (e) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}