import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const timeframe = searchParams.get('timeframe') || '4h';

  try {
    // TrueNorth API only supports GET
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

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`TrueNorth API error: ${response.status} ${text}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error fetching HYPE data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch HYPE indicators', details: error.message },
      { status: 500 }
    );
  }
}
