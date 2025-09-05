import { NextRequest, NextResponse } from 'next/server'
import { reportRunner } from '@/lib/runner'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const run = await reportRunner.getRunStatus(params.id)

    if (!run) {
      return NextResponse.json(
        { error: 'Run not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(run)
  } catch (error) {
    console.error('Failed to fetch run:', error)
    return NextResponse.json(
      { error: 'Failed to fetch run' },
      { status: 500 }
    )
  }
}