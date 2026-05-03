// @ts-nocheck
import { NextResponse } from 'next/server';

const CACHE_TTL = 30_000;
let cache: { data: any; timestamp: number; timeframe: string } | null = null;

// ─── Hyperliquid API helpers ───
const HL_API = 'https://api.hyperliquid.xyz/info';

async function hlPost(body: any) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const res = await fetch(HL_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
      cache: 'no-store',
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`HL HTTP ${res.status}: ${text.slice(0, 200)}`);
    }
    return await res.json();
  } finally {
    clearTimeout(timeout);
  }
}

// ─── Fetch OHLCV from Hyperliquid ───
async function fetchOHLCV(timeframe: string, days: number) {
  const end = Date.now();
  const start = end - days * 86400 * 1000;
  const interval = timeframe === '1h' ? '1h' : timeframe === '4h' ? '4h' : '1d';
  return hlPost({
    type: 'candleSnapshot',
    req: { coin: 'HYPE', interval, startTime: start, endTime: end },
  });
}

// ─── Fetch meta + asset contexts (OI, funding, volume) ───
async function fetchMetaAndCtxs() {
  const result = await hlPost({ type: 'metaAndAssetCtxs' });
  // HL can return {universe:[], assetCtxs:[]} or [meta, ctxs]
  let meta, ctxs;
  if (Array.isArray(result) && result.length === 2) {
    [meta, ctxs] = result;
  } else if (result && result.universe && result.assetCtxs) {
    meta = { universe: result.universe };
    ctxs = result.assetCtxs;
  } else {
    throw new Error('Unexpected metaAndAssetCtxs format');
  }
  const idx = meta.universe.findIndex((a: any) => a.name === 'HYPE');
  if (idx === -1) throw new Error('HYPE not found in universe');
  return { meta: meta.universe[idx], ctx: ctxs[idx] };
}

// ─── Fetch funding history ───
async function fetchFunding() {
  const end = Date.now();
  const start = end - 48 * 3600 * 1000;
  return hlPost({
    type: 'fundingHistory',
    req: { coin: 'HYPE', startTime: start, endTime: end },
  });
}

// ─── Calculate SMA ───
function calcSMA(values: number[], period: number): number[] {
  if (values.length < period) return [];
  const sma: number[] = [];
  for (let i = period - 1; i < values.length; i++) {
    const slice = values.slice(i - period + 1, i + 1);
    sma.push(slice.reduce((a, b) => a + b, 0) / period);
  }
  return sma;
}

// ─── Calculate RSI ───
function calcRSI(closes: number[], period = 14): number[] {
  if (closes.length < period + 1) return [];
  const changes = closes.slice(1).map((c, i) => c - closes[i]);
  let avgGain = changes.slice(0, period).filter(c => c > 0).reduce((a, b) => a + b, 0) / period;
  let avgLoss = changes.slice(0, period).filter(c => c < 0).reduce((a, b) => a + Math.abs(b), 0) / period;
  const rsi: number[] = [];
  for (let i = period; i < changes.length; i++) {
    avgGain = (avgGain * (period - 1) + Math.max(changes[i], 0)) / period;
    avgLoss = (avgLoss * (period - 1) + Math.max(-changes[i], 0)) / period;
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    rsi.push(100 - 100 / (1 + rs));
  }
  return rsi;
}

// ─── Build OHLCV arrays from HL candles ───
function parseCandles(candles: any[]) {
  const ts: number[] = [];
  const opens: number[] = [];
  const highs: number[] = [];
  const lows: number[] = [];
  const closes: number[] = [];
  const volumes: number[] = [];

  for (const c of candles) {
    const t = c.t;
    const o = parseFloat(c.o);
    const h = parseFloat(c.h);
    const l = parseFloat(c.l);
    const cl = parseFloat(c.c);
    const v = parseFloat(c.v);
    if (isNaN(o) || isNaN(h) || isNaN(l) || isNaN(cl)) continue;
    ts.push(t);
    opens.push(o);
    highs.push(h);
    lows.push(l);
    closes.push(cl);
    volumes.push(v);
  }

  return { ts, opens, highs, lows, closes, volumes };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const timeframe = searchParams.get('timeframe') || '1d';
  const t0 = Date.now();
  const errors: string[] = [];

  try {
    // Check cache — invalidate if timeframe changed
    if (cache && cache.timeframe === timeframe && Date.now() - cache.timestamp < CACHE_TTL) {
      return NextResponse.json({ ...cache.data, fetch_duration_ms: Date.now() - t0, cached: true });
    }

    // Determine lookback
    const days = timeframe === '1h' ? 7 : timeframe === '4h' ? 30 : 365;

    // ─── Fetch OHLCV + metaAndCtxs in parallel ───
    const [candlesRaw, metaCtxs] = await Promise.all([
      fetchOHLCV(timeframe, days).catch(e => { errors.push(`OHLCV: ${e.message}`); return null; }),
      fetchMetaAndCtxs().catch(e => { errors.push(`MetaCtxs: ${e.message}`); return null; }),
    ]);

    if (!candlesRaw && !metaCtxs) {
      throw new Error('All data sources failed');
    }

    // Parse candles
    const { ts, opens, highs, lows, closes, volumes } = candlesRaw
      ? parseCandles(candlesRaw)
      : { ts: [], opens: [], highs: [], lows: [], closes: [], volumes: [] };

    // ─── Calculate indicators ───
    const sma10 = calcSMA(closes, 10);
    const sma20 = calcSMA(closes, 20);
    const sma50 = calcSMA(closes, 50);
    const rsiArr = calcRSI(closes, 14);

    const sma10Val = sma10.length ? sma10[sma10.length - 1] : null;
    const sma20Val = sma20.length ? sma20[sma20.length - 1] : null;
    const sma50Val = sma50.length ? sma50[sma50.length - 1] : null;
    const rsiVal = rsiArr.length ? rsiArr[rsiArr.length - 1] : null;

    // Build history arrays for chart
    const offset10 = ts.length - sma10.length;
    const offset20 = ts.length - sma20.length;
    const offset50 = ts.length - sma50.length;
    const offsetRsi = ts.length - rsiArr.length;

    // ─── Parse derivatives from metaCtxs ───
    let fundingRate = 0, funding8h = 0, fundingAnnual = 0;
    let oi = 0, oiUsd = 0, vol24h = 0;
    let markPrice = closes[closes.length - 1] || 0;
    let prevDayPx = 0;
    let high24h = highs.length ? Math.max(...highs.slice(-24)) : markPrice;
    let low24h = lows.length ? Math.min(...lows.slice(-24)) : markPrice;

    if (metaCtxs?.ctx) {
      const ctx = metaCtxs.ctx;
      fundingRate = parseFloat(ctx.funding) || 0;
      funding8h = fundingRate * 100;
      fundingAnnual = fundingRate * 3 * 365 * 100;
      oi = parseFloat(ctx.openInterest) || 0;
      markPrice = parseFloat(ctx.markPx) || closes[closes.length - 1] || 0;
      prevDayPx = parseFloat(ctx.prevDayPx) || 0;
      oiUsd = oi * markPrice;
      vol24h = parseFloat(ctx.dayNtlVlm) || 0;
    }

    const change24h = prevDayPx > 0 ? ((markPrice / prevDayPx) - 1) * 100 : 0;

    const response: any = {
      // Price
      price: markPrice,
      price_change: {
        '24h': change24h.toFixed(2),
        '7d': '0',
        '30d': '0',
      },
      high_24h: high24h,
      low_24h: low24h,

      // Market
      market_cap: 0,
      market_cap_rank: 0,
      total_volume: vol24h,
      circulating_supply: 0,
      total_supply: 962274028,
      ath: 59.3,

      // Indicators (SMA, not EMA)
      sma10: sma10Val,
      sma20: sma20Val,
      sma50: sma50Val,
      rsi: rsiVal,

      // Chart data
      candles: ts.map((t, i) => ({
        time: t,
        open: opens[i],
        high: highs[i],
        low: lows[i],
        close: closes[i],
        volume: volumes[i],
      })),
      sma10History: ts.slice(offset10).map((t, i) => [t, sma10[i]]),
      sma20History: ts.slice(offset20).map((t, i) => [t, sma20[i]]),
      sma50History: ts.slice(offset50).map((t, i) => [t, sma50[i]]),
      rsiHistory: ts.slice(offsetRsi).map((t, i) => [t, rsiArr[i]]),
      prices: ts.map((t, i) => [t, closes[i]]),

      // Derivatives
      open_interest: oi > 0 ? { usd: oiUsd, tokens: oi } : null,
      funding_rate: fundingRate,
      funding_8h_pct: funding8h,
      funding_annual_pct: fundingAnnual,

      // Meta
      timeframe,
      last_updated: new Date().toISOString(),
      source: 'Hyperliquid',
      fetch_duration_ms: Date.now() - t0,
      cached: false,
      errors,
    };

    cache = { data: response, timestamp: Date.now(), timeframe };
    return NextResponse.json(response);

  } catch (error: any) {
    console.error('API error:', error.message);
    if (cache && cache.timeframe === timeframe) {
      return NextResponse.json({ ...cache.data, fetch_duration_ms: Date.now() - t0, stale: true, errors: [...errors, error.message] });
    }
    return NextResponse.json(
      { error: 'Failed to fetch data', details: error.message },
      { status: 500 }
    );
  }
}
