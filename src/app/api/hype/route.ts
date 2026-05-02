import { NextResponse } from 'next/server';
import { readFileSync } from 'fs';
import { join } from 'path';

const samplePath = join(process.cwd(), 'src', 'app', 'api', 'hype', 'sample.json');

// Cache pour éviter de spammer les APIs
let cache: { data: any; timestamp: number } | null = null;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const timeframe = searchParams.get('timeframe') || '4h';
  const includeHistory = searchParams.get('history') === 'true';

  try {
    // Vérifier le cache
    if (cache && Date.now() - cache.timestamp < CACHE_TTL) {
      return NextResponse.json(cache.data);
    }

    // 1. TrueNorth pour l'analyse technique (multi-timeframes)
    const url = new URL('https://api.adventai.io/api/agent-tools');
    url.searchParams.set('tool', 'technical_analysis');
    url.searchParams.set('args', JSON.stringify({
      token_address: 'hyperliquid',
      timeframe: timeframe,
    }));

    let truenorthData = null;
    try {
      const response = await fetch(url.toString(), {
        method: 'GET',
        signal: AbortSignal.timeout(10000)
      });
      if (response.ok) {
        const data = await response.json();
        if (data?.result?.technical_indicators && !data?.data?.tools) {
          truenorthData = data;
        }
      }
    } catch (e) {
      console.warn('TrueNorth timeout/error:', e);
    }

    // 2. CoinGecko pour le prix temps réel
    let realtimeData = null;
    try {
      const cgUrl = 'https://api.coingecko.com/api/v3/simple/price?ids=hyperliquid&vs_currencies=usd&include_24hr_change=true&include_24hr_vol=true&include_market_cap=true';
      const cgResponse = await fetch(cgUrl, {
        signal: AbortSignal.timeout(10000)
      });
      if (cgResponse.ok) {
        const cgData = await cgResponse.json();
        if (cgData.hyperliquid) {
          realtimeData = {
            price: cgData.hyperliquid.usd,
            change_24h: cgData.hyperliquid.usd_24h_change?.toFixed(2) + '%',
            volume_24h: cgData.hyperliquid.usd_24h_vol,
            market_cap: cgData.hyperliquid.usd_market_cap,
          };
        }
      }
    } catch (e) {
      console.warn('CoinGecko real-time error:', e);
    }

    // 3. CoinGecko pour l'historique (1 an)
    let historyData = null;
    if (includeHistory) {
      try {
        const cgHistUrl = 'https://api.coingecko.com/api/v3/coins/hyperliquid/market_chart?vs_currency=usd&days=365&interval=daily';
        const cgHistResponse = await fetch(cgHistUrl, {
          signal: AbortSignal.timeout(10000)
        });
        if (cgHistResponse.ok) {
          const cgHistData = await cgHistResponse.json();
          historyData = cgHistData.prices?.map((p: [number, number]) => ({
            timestamp: p[0],
            price: p[1]
          })) || [];
        }
      } catch (e) {
        console.warn('CoinGecko history error:', e);
      }
    }

    // Construire la réponse
    if (truenorthData) {
      const responseData = {
        ...truenorthData,
        realtime: realtimeData, // Remplace binance
        history_1y: historyData,
        timeframe: timeframe,
        last_updated: new Date().toISOString(),
        source: 'TrueNorth AI + CoinGecko',
      };
      
      // Mettre en cache
      cache = { data: responseData, timestamp: Date.now() };
      
      return NextResponse.json(responseData);
    }

    throw new Error('TrueNorth API failed');

  } catch (error: any) {
    console.warn('API failed, using sample data:', error.message);
    
    // Fallback vers les données statiques
    try {
      const sampleData = JSON.parse(readFileSync(samplePath, 'utf-8'));
      return NextResponse.json({
        ...sampleData,
        realtime: null,
        history_1y: null,
        timeframe: timeframe,
        last_updated: new Date().toISOString(),
        source: 'Fallback (sample data)',
      });
    } catch (readError) {
      return NextResponse.json(
        { error: 'Failed to fetch HYPE data', details: error.message },
        { status: 500 }
      );
    }
  }
}
