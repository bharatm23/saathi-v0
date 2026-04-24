import { NextRequest, NextResponse } from 'next/server'
import { getScenario } from '@/lib/playground-data'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ scenario: string }> }
) {
  const { scenario } = await params
  const data = getScenario(scenario)
  if (!data) return NextResponse.json({ error: 'Unknown scenario' }, { status: 404 })
  return NextResponse.json(data)
}