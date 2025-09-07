import { NextRequest, NextResponse } from 'next/server';
import { validateDataAvailability } from '@/lib/data-validator';

export async function POST(request: NextRequest) {
  try {
    const config = await request.json();
    const validation = await validateDataAvailability(config);
    
    return NextResponse.json(validation);
  } catch (error) {
    console.error('Data validation failed:', error);
    return NextResponse.json(
      { error: 'Validation failed' },
      { status: 500 }
    );
  }
}