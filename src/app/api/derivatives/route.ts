import { NextResponse } from 'next/server';

const CACHE_TTL = 90_000; // 90s — TrueNorth rate limits
let cache: { data: any; timestamp: number } | null = null;

export async function GET() {
  if (cache && Date.now() - cache.timestamp < CACHE_TTL) {
    return NextResponse.json({ ...cache.data, cached: true });
  }

  try {
    // Call TrueNorth API from server-side (no CORS)
    const url = new URL('https://api.adventai.io/api/agent-tools');
    url.searchParams.set('tool', 'derivatives_analysis');
    url.searchParams.set('args', JSON.stringify({ token_address: 'hyperliquid' }));

    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 12000);
    const res = await fetch(url.toString(), { method: 'GET', signal: ctrl.signal });
    clearTimeout(t);

    if (!res.ok) throw new Error(`TrueNorth HTTP ${res.status}`);
    const raw = await res.json();

    if (raw?.data?.tools || !raw?.result?.derivative_data?.HYPE) {
      throw new Error('Invalid TrueNorth response');
    }

    const r = raw.result.derivative_data.HYPE;
    const liq = r['Binance/Bybit/OKX aggreated liquidation map'] || {};
    const imb = liq.imbalance || {};
    const oi = r['Aggregated open interest'] || {};
    const fund = r['1h Aggregated OI weighted funding rate'] || {};

    const data = {
      longShortRatio: {
        ratio: imb.imbalance_ratio || 0,
        longTotalUsd: imb.long_total_usd || 0,
        shortTotalUsd: imb.short_total_usd || 0,
        imbalanceUsd: imb.imbalance_usd || 0,
        interpretation: imb.interpretation || 'neutral',
      },
      openInterest: {
        current: oi.current_open_interest || 0,
        oiMcapRatio: oi.oi_mcap_ratio_analysis?.oi_mcap_ratio_pct || 0,
        percentile7d: oi.percentile_analysis?.current_oi_percentile_7d || 0,
      },
      funding: {
        current1h: fund.current_funding_rate_in_percentage || 0,
        annualized: fund.annualized_funding_cost_est_in_percentage || 0,
        percentile7d: fund.current_funding_percentile_7d || 0,
      },
      liquidations: {
        shortLevels: (liq.max_short_liquidation_point || []).slice(0, 5).map((l: any) => ({
          price: l.price, valueUsd: l.liq_usd, distancePct: l.distance_pct,
        })),
        longLevels: (liq.max_long_liquidation_point || []).slice(0, 5).map((l: any) => ({
          price: l.price, valueUsd: l.liq_usd, distancePct: l.distance_pct,
        })),
      },
      lastUpdated: Date.now(),
    };

    cache = { data, timestamp: Date.now() };
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Derivatives API error:', error.message);
    if (cache) return NextResponse.json({ ...cache.data, stale: true });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
