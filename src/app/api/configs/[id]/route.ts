import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getScheduler } from '@/lib/scheduler'
import { UpdateReportConfigSchema } from '@/types/config'
import { z } from 'zod'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const config = await db.reportConfig.findUnique({
      where: { id: params.id },
      include: {
        runs: {
          orderBy: { startedAt: 'desc' },
          take: 10,
        },
        reports: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
      },
    })

    if (!config) {
      return NextResponse.json(
        { error: 'Configuration not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(config)
  } catch (error) {
    console.error('Failed to fetch config:', error)
    return NextResponse.json(
      { error: 'Failed to fetch configuration' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    const updateData = UpdateReportConfigSchema.parse(body)

    const existingConfig = await db.reportConfig.findUnique({
      where: { id: params.id },
    })

    if (!existingConfig) {
      return NextResponse.json(
        { error: 'Configuration not found' },
        { status: 404 }
      )
    }

    const updatedConfig = await db.reportConfig.update({
      where: { id: params.id },
      data: updateData,
    })

    const scheduler = getScheduler()
    
    if (updateData.enabled === false) {
      await scheduler.unscheduleReport(params.id)
    } else if (updateData.enabled === true || updateData.schedule) {
      await scheduler.scheduleReport(updatedConfig.id, updatedConfig.schedule)
    }

    return NextResponse.json(updatedConfig)
  } catch (error) {
    console.error('Failed to update config:', error)
    
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

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const config = await db.reportConfig.findUnique({
      where: { id: params.id },
    })

    if (!config) {
      return NextResponse.json(
        { error: 'Configuration not found' },
        { status: 404 }
      )
    }

    const scheduler = getScheduler()
    await scheduler.unscheduleReport(params.id)

    await db.reportConfig.delete({
      where: { id: params.id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete config:', error)
    return NextResponse.json(
      { error: 'Failed to delete configuration' },
      { status: 500 }
    )
  }
}