import { NextResponse } from 'next/server';
import ReportScheduler from '@/lib/scheduler';

export async function GET() {
  try {
    const scheduler = ReportScheduler.getInstance();
    
    return NextResponse.json({
      status: scheduler.getStatus(),
      runs: scheduler.getReportRuns(),
      config: scheduler.getConfig()
    });
  } catch (error) {
    console.error('Failed to get scheduler status:', error);
    return NextResponse.json(
      { error: 'Failed to get scheduler status' },
      { status: 500 }
    );
  }
}