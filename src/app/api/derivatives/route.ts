import { NextResponse } from 'next/server';

const CACHE_TTL = 60_000;
let cache: { data: any; timestamp: number } | null = null;

export async function GET() {
  if (cache && Date.now() - cache.timestamp < CACHE_TTL) {
    return NextResponse.json({ ...cache.data, cached: true });
  }

  try {
    const HL_API = 'https://api.hyperliquid.xyz/info';

    // Fetch meta + asset contexts for HYPE
    const meta = await fetch(HL_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'metaAndAssetCtxs' }),
      signal: AbortSignal.timeout(10000),
    }).then(r => r.json()).catch(() => null);

    if (!meta || !Array.isArray(meta) || meta.length !== 2) {
      throw new Error('HL API failed');
    }

    const [m, ctxs] = meta;
    const idx = m?.universe?.findIndex((a: any) => a.name === 'HYPE');
    if (idx === -1 || !ctxs[idx]) throw new Error('HYPE not found');

    const ctx = ctxs[idx];
    const oi = parseFloat(ctx.openInterest) || 0;
    const funding = parseFloat(ctx.funding) || 0;
    const markPrice = parseFloat(ctx.markPx) || 0;
    const prevDayPx = parseFloat(ctx.prevDayPx) || 0;
    const oiUsd = oi * markPrice;

    // Fetch top traders positions for L/S estimation
    // Use HL leaderboard or position data
    const leaderboard = await fetch(HL_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'leaderboard',
        // Get top traders by PnL
      }),
      signal: AbortSignal.timeout(10000),
    }).then(r => r.json()).catch(() => null);

    // Estimate L/S from OI + funding + price action
    // Funding > 0 means longs pay shorts → more longs → short bias signal
    // Funding < 0 means shorts pay longs → more shorts → long bias signal
    const fundingPct = funding * 100;
    const annualFunding = funding * 3 * 365 * 100;

    // L/S ratio estimation model
    // Positive funding → more longs in market → ratio < 1 (more longs)
    // Negative funding → more shorts → ratio > 1 (more shorts)
    const baseRatio = 1.0;
    const fundingImpact = Math.min(0.4, Math.abs(funding) * 20);
    const lsRatio = funding > 0
      ? baseRatio - fundingImpact  // more longs
      : baseRatio + fundingImpact; // more shorts

    const longPct = (lsRatio / (1 + lsRatio)) * 100;
    const shortPct = 100 - longPct;

    // Determine bias
    const isShortBias = funding > 0.001;
    const isLongBias = funding < -0.001;
    const interpretation = isShortBias ? 'favors_shorts' : isLongBias ? 'favors_longs' : 'neutral';
    const ratioValue = isShortBias ? -Math.abs(lsRatio - 1) : isLongBias ? Math.abs(1 - lsRatio) : 0;

    const data = {
      longShortRatio: {
        ratio: parseFloat(ratioValue.toFixed(3)),
        longTotalUsd: oiUsd * (longPct / 100),
        shortTotalUsd: oiUsd * (shortPct / 100),
        longPct: parseFloat(longPct.toFixed(1)),
        shortPct: parseFloat(shortPct.toFixed(1)),
        imbalanceUsd: oiUsd * (longPct - shortPct) / 100,
        interpretation,
        source: 'hyperliquid_oi',
      },
      openInterest: {
        current: oi,
        oiUsd,
        oiMcapRatio: 0,
        percentile7d: 0,
        change1h: 0,
        change4h: 0,
        change1d: 0,
      },
      funding: {
        current1h: parseFloat(fundingPct.toFixed(4)),
        annualized: parseFloat(annualFunding.toFixed(1)),
        percentile7d: 0,
      },
      liquidations: {
        shortLevels: [],
        longLevels: [],
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
