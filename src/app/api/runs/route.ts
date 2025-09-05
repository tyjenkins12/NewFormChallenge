import { NextRequest, NextResponse } from 'next/server'
import { reportRunner } from '@/lib/runner'
import { z } from 'zod'

const CreateRunSchema = z.object({
  configId: z.string(),
  useCache: z.boolean().optional(),
  simulateFailure: z.boolean().optional(),
  bypassCache: z.boolean().optional(),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { configId, useCache, simulateFailure, bypassCache } = CreateRunSchema.parse(body)

    if (reportRunner.isRunning(configId)) {
      return NextResponse.json(
        { error: 'Run already in progress for this configuration' },
        { status: 409 }
      )
    }

    const runId = await reportRunner.executeRun(configId, {
      useCache,
      simulateFailure,
      bypassCache,
    })

    return NextResponse.json({ runId })
  } catch (error) {
    console.error('Failed to create run:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      )
    }

    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: message },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const configId = searchParams.get('configId')
    const limitParam = searchParams.get('limit')
    const limit = limitParam ? parseInt(limitParam) : 10
    const validLimit = isNaN(limit) ? 10 : Math.min(limit, 50)

    const runs = await reportRunner.getRecentRuns(
      configId || undefined,
      validLimit
    )

    return NextResponse.json(runs)
  } catch (error) {
    console.error('Failed to fetch runs:', error)
    return NextResponse.json(
      { error: 'Failed to fetch runs' },
      { status: 500 }
    )
  }
}