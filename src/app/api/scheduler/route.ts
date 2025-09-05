import { NextRequest, NextResponse } from 'next/server';
import ReportScheduler from '@/lib/scheduler';

export async function POST(request: NextRequest) {
  try {
    const config = await request.json();
    const scheduler = ReportScheduler.getInstance();
    await scheduler.scheduleReport(config);
    
    return NextResponse.json({ 
      success: true, 
      message: 'Report scheduled successfully',
      status: scheduler.getStatus()
    });
  } catch (error) {
    console.error('Failed to schedule report:', error);
    return NextResponse.json(
      { error: 'Failed to schedule report' },
      { status: 500 }
    );
  }
}