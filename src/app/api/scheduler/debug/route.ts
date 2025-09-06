import { NextResponse } from 'next/server';
import ReportScheduler from '@/lib/scheduler';

export async function GET() {
  try {
    const scheduler = ReportScheduler.getInstance();
    const debugInfo = scheduler.getDebugInfo();
    
    return NextResponse.json(debugInfo);
  } catch (error) {
    console.error('Failed to get debug info:', error);
    return NextResponse.json(
      { error: 'Failed to get debug info' },
      { status: 500 }
    );
  }
}