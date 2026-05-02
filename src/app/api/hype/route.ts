import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const timeframe = searchParams.get('timeframe') || '4h';

  try {
    const response = await fetch('https://api.adventai.io/api/agent-tools', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tool: 'technical_analysis',
        args: {
          token: 'hyperliquid',
          timeframe: timeframe,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`TrueNorth API error: ${response.statusText}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching HYPE data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch HYPE indicators' },
      { status: 500 }
    );
  }
}
