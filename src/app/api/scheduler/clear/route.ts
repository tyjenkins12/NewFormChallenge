import { NextResponse } from 'next/server';
import ReportScheduler from '@/lib/scheduler';

export async function POST() {
  try {
    const scheduler = ReportScheduler.getInstance();
    await scheduler.clearAll();
    
    return NextResponse.json({ 
      success: true, 
      message: 'All configuration and reports cleared successfully'
    });
  } catch (error) {
    console.error('Failed to clear configuration:', error);
    return NextResponse.json(
      { error: 'Failed to clear configuration' },
      { status: 500 }
    );
  }
}