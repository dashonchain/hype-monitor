import { NextResponse } from 'next/server';
import { readFileSync } from 'fs';
import { join } from 'path';

// Sample data path
const samplePath = join(process.cwd(), 'src', 'app', 'api', 'hype', 'sample.json');

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const timeframe = searchParams.get('timeframe') || '4h';

  try {
    // Try TrueNorth API first (if available)
    const url = new URL('https://api.adventai.io/api/agent-tools');
    url.searchParams.set('tool', 'technical_analysis');
    url.searchParams.set('args', JSON.stringify({
      token: 'hyperliquid',
      timeframe: timeframe,
    }));

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    if (response.ok) {
      const data = await response.json();
      return NextResponse.json(data);
    }
    throw new Error(`TrueNorth API error: ${response.status}`);
  } catch (error: any) {
    console.warn('TrueNorth API failed, using sample data:', error.message);
    // Fallback to sample data
    try {
      const sampleData = JSON.parse(readFileSync(samplePath, 'utf-8'));
      return NextResponse.json(sampleData);
    } catch (readError) {
      return NextResponse.json(
        { error: 'Failed to fetch HYPE indicators', details: error.message },
        { status: 500 }
      );
    }
  }
}
