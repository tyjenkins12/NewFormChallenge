import { NextResponse } from 'next/server';
import ReportScheduler from '@/lib/scheduler';

export async function POST() {
  try {
    const scheduler = ReportScheduler.getInstance();
    const run = await scheduler.runReport();
    
    return NextResponse.json({ 
      success: true, 
      run,
      status: scheduler.getStatus()
    });
  } catch (error) {
    console.error('Failed to run report:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to run report' },
      { status: 500 }
    );
  }
}