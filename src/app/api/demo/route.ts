import { NextRequest, NextResponse } from 'next/server'
import { demoCache } from '@/lib/cache'
import { z } from 'zod'

const DemoControlsSchema = z.object({
  simulateFailure: z.boolean().optional(),
  bypassCache: z.boolean().optional(),
  clearCache: z.boolean().optional(),
})

export async function GET() {
  try {
    const demoState = {
      demoMode: process.env.DEMO_MODE_ENABLED === 'true',
      acceleratedSchedule: process.env.DEMO_ACCELERATED_SCHEDULE === 'true',
      simulateFailure: process.env.SIMULATE_LLM_FAILURE === 'true',
      bypassCache: process.env.BYPASS_CACHE === 'true',
      cacheDuration: parseInt(process.env.DEMO_CACHE_DURATION_MS || '600000'),
      llmTimeout: parseInt(process.env.DEMO_LLM_TIMEOUT_MS || '5000'),
    }

    return NextResponse.json(demoState)
  } catch (error) {
    console.error('Failed to fetch demo state:', error)
    return NextResponse.json(
      { error: 'Failed to fetch demo state' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { simulateFailure, bypassCache, clearCache } = DemoControlsSchema.parse(body)

    if (clearCache) {
      await demoCache.clear()
      console.log('Demo cache cleared')
    }

    if (simulateFailure !== undefined) {
      process.env.SIMULATE_LLM_FAILURE = simulateFailure.toString()
      console.log(`LLM failure simulation: ${simulateFailure}`)
    }

    if (bypassCache !== undefined) {
      process.env.BYPASS_CACHE = bypassCache.toString()
      console.log(`Cache bypass: ${bypassCache}`)
    }

    return NextResponse.json({
      success: true,
      applied: {
        simulateFailure: process.env.SIMULATE_LLM_FAILURE === 'true',
        bypassCache: process.env.BYPASS_CACHE === 'true',
        cacheCleared: clearCache || false,
      },
    })
  } catch (error) {
    console.error('Failed to update demo controls:', error)
    
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