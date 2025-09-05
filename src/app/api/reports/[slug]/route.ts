import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const report = await db.report.findUnique({
      where: { slug: params.slug },
      include: {
        config: {
          select: {
            name: true,
            description: true,
          },
        },
        run: {
          select: {
            status: true,
            duration: true,
            completedAt: true,
          },
        },
      },
    })

    if (!report) {
      return NextResponse.json(
        { error: 'Report not found' },
        { status: 404 }
      )
    }

    if (!report.isPublic) {
      return NextResponse.json(
        { error: 'Report is not public' },
        { status: 403 }
      )
    }

    return NextResponse.json(report)
  } catch (error) {
    console.error('Failed to fetch report:', error)
    return NextResponse.json(
      { error: 'Failed to fetch report' },
      { status: 500 }
    )
  }
}