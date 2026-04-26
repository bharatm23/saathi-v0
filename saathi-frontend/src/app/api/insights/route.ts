import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { getCachedLLM, setCachedLLM } from '@/lib/db'
import { getSupabaseUserId } from '@/lib/db'
import { createHash } from 'crypto'

// openAI rate limit hit
// const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
// const openai = new OpenAI({ apiKey: process.env.OPENROUTER_API_KEY })

const openai = new OpenAI({ apiKey: process.env.OPENROUTER_API_KEY })

export async function POST(req: NextRequest) {
  const { currentSummary, previousSummary, period } = await req.json()
  if (!currentSummary) return NextResponse.json({ insights: [] })

  const periodLabel = period === '30d' ? '30 days' : period === '1y' ? 'year' : 'day'
  const hasPrevious = previousSummary && previousSummary.trim().length > 0

  const comparison = hasPrevious
    ? `Previous ${periodLabel}:\n${previousSummary}\n\nCurrent ${periodLabel}:\n${currentSummary}`
    : `Current ${periodLabel}:\n${currentSummary}`

  try {
    const userId = await getSupabaseUserId() ?? 'anonymous'
    const cacheKey = createHash('md5').update(JSON.stringify({ currentSummary, previousSummary, period })).digest('hex')
    const cached   = await getCachedLLM(userId, cacheKey)
    if (cached) return NextResponse.json(cached)
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 300,
      temperature: 0.4,
      messages: [
        {
          role: 'system',
          content: `You are a sharp personal health analyst. ${hasPrevious ? `Compare the user's current ${periodLabel} vs their previous ${periodLabel} and derive 3 insights.` : `Analyse the user's health data for the ${periodLabel}.`}

Rules:
- Each insight is one sentence, max 15 words
- Never state the obvious (e.g. "steps were below 10k target" is useless)
- ${hasPrevious ? 'Insight 1: what meaningfully CHANGED — state the % or absolute delta' : 'Insight 1: the most notable metric and what it suggests about fitness level'}
- Insight 2: a non-obvious pattern, risk, or physiological implication of the data
- Insight 3: one specific, measurable action with a realistic target number
- Only reference metrics that are actually present in the data
- Return ONLY a JSON array of 3 strings, no preamble

Example (good): ["Sleep dropped 1.2 hrs vs last month — correlates with lower active minutes.", "Resting HR of 72 bpm with minimal activity suggests deconditioning risk.", "Add two 20-min walks on your lowest-step days to hit 6k average."]
Example (bad): ["Your steps were 3,257, below the 10,000 target.", "Try to sleep more.", "Exercise is important for health."]`
        },
        {
          role: 'user',
          content: comparison,
        }
      ]
    })

    const text = response.choices[0]?.message?.content ?? '[]'
    const clean = text.replace(/```json|```/g, '').trim()
    const insights: string[] = JSON.parse(clean)
    await setCachedLLM(userId, cacheKey, 'insights', period, insights)
    return NextResponse.json({ insights })
  } catch {
    return NextResponse.json({ insights: [] })
  }
}