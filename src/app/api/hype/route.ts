// @ts-nocheck
import { NextResponse } from 'next/server';

const CACHE_TTL = 30_000; // 30 seconds
let cache: { data: any; timestamp: number } | null = null;

// Backend PM2 server URL (via Cloudflare Tunnel)
const BACKEND_URL = 'https://mayor-titled-mathematics-choices.trycloudflare.com';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const timeframe = searchParams.get('timeframe') || '1d';
  const t0 = Date.now();

  try {
    // Check cache
    if (cache && Date.now() - cache.timestamp < CACHE_TTL) {
      return NextResponse.json({ ...cache.data, fetch_duration_ms: Date.now() - t0, cached: true });
    }

    // Fetch from backend PM2 server (which can reach Variational API)
    const res = await fetch(`${BACKEND_URL}/api/live-data?timeframe=${timeframe}`, {
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) throw new Error(`Backend HTTP ${res.status}`);
    const data = await res.json();

    cache = { data, timestamp: Date.now() };
    return NextResponse.json({ ...data, fetch_duration_ms: Date.now() - t0 });

  } catch (error: any) {
    console.error('Proxy error:', error.message);
    
    // Return cached data if available
    if (cache) {
      return NextResponse.json({ ...cache.data, fetch_duration_ms: Date.now() - t0, stale: true });
    }

    return NextResponse.json(
      { error: 'Failed to fetch HYPE data', details: error.message },
      { status: 500 }
    );
  }
}
