import { NextResponse } from 'next/server';
import ReportScheduler from '@/lib/scheduler';

export async function GET() {
  try {
    const scheduler = await ReportScheduler.getInstanceAsync();
    const status = scheduler.getStatus();
    const config = scheduler.getConfig();
    
    console.log('Status API returning:', {
      nextRun: status.nextRun,
      isRunning: status.isRunning,
      configCadence: config?.cadence,
      reportPath: status.reportPath,
      fullStatus: status
    });
    
    return NextResponse.json({
      status: status,
      runs: scheduler.getReportRuns(),
      config: config
    });
  } catch (error) {
    console.error('Failed to get scheduler status:', error);
    return NextResponse.json(
      { error: 'Failed to get scheduler status' },
      { status: 500 }
    );
  }
}