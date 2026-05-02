import { NextResponse } from 'next/server';
import { readFileSync } from 'fs';
import { join } from 'path';

const samplePath = join(process.cwd(), 'src', 'app', 'api', 'hype', 'sample.json');

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const timeframe = searchParams.get('timeframe') || '4h';

  try {
    // Appel TrueNorth API
    const url = new URL('https://api.adventai.io/api/agent-tools');
    url.searchParams.set('tool', 'technical_analysis');
    url.searchParams.set('args', JSON.stringify({
      token_address: 'hyperliquid',
      timeframe: timeframe,
    }));

    const response = await fetch(url.toString(), { method: 'GET' });
    
    if (response.ok) {
      const data = await response.json();
      
      // Validation : on vérifie que c'est bien une analyse technique et pas la liste des outils
      if (data?.result?.technical_indicators && !data?.data?.tools) {
        return NextResponse.json(data);
      }
    }
    throw new Error(`TrueNorth API returned invalid data (status: ${response.status})`);
  } catch (error: any) {
    console.warn('TrueNorth API failed, using sample data:', error.message);
    
    // Fallback vers les données statiques
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
