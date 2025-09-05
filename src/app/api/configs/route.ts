import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getScheduler } from '@/lib/scheduler'
import { CreateReportConfigSchema } from '@/types/config'
import { z } from 'zod'

export async function GET(request: NextRequest) {
  try {
    const configs = await db.reportConfig.findMany({
      include: {
        _count: {
          select: {
            runs: true,
            reports: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return NextResponse.json(configs)
  } catch (error) {
    console.error('Failed to fetch configs:', error)
    return NextResponse.json(
      { error: 'Failed to fetch configurations' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const configData = CreateReportConfigSchema.parse(body)

    const config = await db.reportConfig.create({
      data: configData,
    })

    const scheduler = getScheduler()
    if (config.enabled) {
      await scheduler.scheduleReport(config.id, config.schedule)
    }

    return NextResponse.json(config)
  } catch (error) {
    console.error('Failed to create config:', error)
    
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