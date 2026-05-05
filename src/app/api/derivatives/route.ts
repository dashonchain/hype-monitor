import { NextResponse } from 'next/server';

const CACHE_TTL = 60_000;
let cache: { data: any; timestamp: number } | null = null;

const HL_API = 'https://api.hyperliquid.xyz/info';

async function hlPost(body: any) {
  const r = await fetch(HL_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10000),
  });
  if (!r.ok) throw new Error(`HL ${r.status}`);
  return r.json();
}

export async function GET() {
  if (cache && Date.now() - cache.timestamp < CACHE_TTL) {
    return NextResponse.json({ ...cache.data, cached: true });
  }

  try {
    // Fetch OI + funding + 24h candles for order flow delta
    const now = Date.now();
    const start = now - 86400 * 1000;

    const [meta, candles] = await Promise.all([
      hlPost({ type: 'metaAndAssetCtxs' }),
      hlPost({
        type: 'candleSnapshot',
        req: { coin: 'HYPE', interval: '1h', startTime: start, endTime: now },
      }),
    ]);

    // Parse HYPE context
    const [m, ctxs] = meta;
    const idx = m?.universe?.findIndex((a: any) => a.name === 'HYPE');
    if (idx === -1 || !ctxs[idx]) throw new Error('HYPE not found');

    const ctx = ctxs[idx];
    const oi = parseFloat(ctx.openInterest) || 0;
    const funding = parseFloat(ctx.funding) || 0;
    const markPrice = parseFloat(ctx.markPx) || 0;
    const dayNtlVlm = parseFloat(ctx.dayNtlVlm) || 0;
    const oiUsd = oi * markPrice;

    // === REAL L/S RATIO from order flow delta ===
    // For each candle, estimate buy/sell volume:
    //   buy_weight  = (close - low) / (high - low)  → how close to the high
    //   sell_weight = (high - close) / (high - low)  → how close to the low
    // This is the standard "cumulative delta" heuristic used by order flow traders
    let buyVol = 0;
    let sellVol = 0;

    for (const c of candles) {
      const o = parseFloat(c.o), h = parseFloat(c.h);
      const l = parseFloat(c.l), cl = parseFloat(c.c);
      const v = parseFloat(c.v);
      const range = h - l;
      if (range === 0 || isNaN(v)) {
        buyVol += v * 0.5;
        sellVol += v * 0.5;
      } else {
        buyVol += v * ((cl - l) / range);
        sellVol += v * ((h - cl) / range);
      }
    }

    const totalVol = buyVol + sellVol;
    const longPct = totalVol > 0 ? (buyVol / totalVol) * 100 : 50;
    const shortPct = totalVol > 0 ? (sellVol / totalVol) * 100 : 50;
    const lsRatio = sellVol > 0 ? buyVol / sellVol : 1.0;
    const delta = buyVol - sellVol;

    // Bias: ratio > 1 = more longs, < 1 = more shorts
    // Threshold: ±2% for neutral zone (noise)
    const ratioDelta = lsRatio - 1.0; // positive = long bias
    let interpretation = 'neutral';
    if (ratioDelta > 0.03) interpretation = 'longs_dominant';
    else if (ratioDelta > 0.01) interpretation = 'slight_long_bias';
    else if (ratioDelta < -0.03) interpretation = 'shorts_dominant';
    else if (ratioDelta < -0.01) interpretation = 'slight_short_bias';

    const funding1h = funding * 100;
    const fundingAnnual = funding * 3 * 365 * 100;

    const data = {
      longShortRatio: {
        ratio: parseFloat(lsRatio.toFixed(3)),
        ratioDelta: parseFloat(ratioDelta.toFixed(3)),
        longPct: parseFloat(longPct.toFixed(1)),
        shortPct: parseFloat(shortPct.toFixed(1)),
        longTotalUsd: oiUsd * (longPct / 100),
        shortTotalUsd: oiUsd * (shortPct / 100),
        buyVolume24h: buyVol,
        sellVolume24h: sellVol,
        delta24h: delta,
        interpretation,
        source: 'orderflow_delta_24h',
      },
      openInterest: {
        current: oi,
        oiUsd,
        dayVolumeUsd: dayNtlVlm,
        oiToVolRatio: dayNtlVlm > 0 ? parseFloat((oiUsd / dayNtlVlm).toFixed(2)) : 0,
      },
      funding: {
        current1h: parseFloat(funding1h.toFixed(4)),
        annualized: parseFloat(fundingAnnual.toFixed(1)),
        next8h: parseFloat((funding1h * 8).toFixed(4)),
      },
      lastUpdated: Date.now(),
    };

    cache = { data, timestamp: Date.now() };
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('[derivatives] error:', error.message);
    if (cache) return NextResponse.json({ ...cache.data, stale: true });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
