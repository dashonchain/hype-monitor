// @ts-nocheck
import { NextResponse } from 'next/server';

const CACHE_TTL = 30_000;
let cache: { data: any; timestamp: number; timeframe: string } | null = null;

// Smart Money Wallets — Dynamically fetched from Hyperliquid leaderboard
const SMART_MONEY_WALLETS = [
  "0x082e843a431aef031264dc232693dd710aedca88",
  "0x8def9f50456c6c4e37fa5d3d57f108ed23992dae",
  "0x939f95036d2e7b6d7419ec072bf9d967352204d2",
  "0x45d26f28196d226497130c4bac709d808fed4029",
  "0x856c35038594767646266bc7fd68dc26480e910d",
];

// Leaderboard configuration (auto-refreshes every 5 minutes)
const LEADERBOARD_TTL = 5 * 60 * 1000; // 5 minutes
const LEADERBOARD_URL = 'https://stats-data.hyperliquid.xyz/Mainnet/leaderboard';
const TOP_WALLET_COUNT = 50; // Fetch top 50-100 wallets (adjust as needed)
let leaderboardCache: { addresses: string[]; timestamp: number } | null = null;

async function fetchLeaderboardWallets(): Promise<string[]> {
  // Return cached addresses if still valid
  if (leaderboardCache && Date.now() - leaderboardCache.timestamp < LEADERBOARD_TTL) {
    return leaderboardCache.addresses;
  }

  try {
    const response = await fetch(LEADERBOARD_URL, {
      signal: AbortSignal.timeout(5000)
    });
    if (!response.ok) throw new Error(`Leaderboard HTTP ${response.status}`);
    const data = await response.json();
    
    // Debug: log raw response shape for expert
    console.log('[LEADERBOARD] Type:', typeof data, '| IsArray:', Array.isArray(data));
    console.log('[LEADERBOARD] Raw first 500:', JSON.stringify(data).slice(0, 500));
    
    // Auto-detect response shape
    let rows: any[] = [];
    
    if (Array.isArray(data)) {
      rows = data; // Direct array of wallets
    } else if (data && typeof data === 'object') {
      if (Array.isArray(data.leaderboardRows)) {
        rows = data.leaderboardRows;
      } else if (Array.isArray(data.result)) {
        rows = data.result;
      } else if (Array.isArray(data.rows)) {
        rows = data.rows;
      } else {
        // Try first key of object (e.g. { "30d": { rows: [...] } })
        const values = Object.values(data);
        for (const val of values) {
          if (val && typeof val === 'object') {
            const nested = val as any;
            if (Array.isArray(nested.rows)) { rows = nested.rows; break; }
            if (Array.isArray(nested.leaderboardRows)) { rows = nested.leaderboardRows; break; }
            if (Array.isArray(nested.result)) { rows = nested.result; break; }
          }
        }
      }
    }
    
    if (rows.length === 0) {
      console.warn('[LEADERBOARD] Could not parse response shape');
      return SMART_MONEY_WALLETS;
    }
    
    // Extract addresses — field might be ethAddress, address, or user
    const addresses = rows
      .map((w: any) => (w.ethAddress || w.address || w.user || '').toLowerCase())
      .filter((addr: string) => addr.startsWith('0x') && addr.length === 42)
      .slice(0, TOP_WALLET_COUNT);
    
    console.log(`[LEADERBOARD] Parsed ${addresses.length} addresses from ${rows.length} rows`);
    
    if (addresses.length > 0) {
      leaderboardCache = { addresses, timestamp: Date.now() };
      return addresses;
    }
    
    return SMART_MONEY_WALLETS;
  } catch (e) {
    console.error('Failed to fetch leaderboard, falling back to hardcoded wallets:', e);
    return SMART_MONEY_WALLETS;
  }
}

async function fetchSmartMoney(markPrice: number) {
  // Fetch dynamic wallet list from leaderboard (cached for 5min)
  let wallets: string[];
  try {
    wallets = await fetchLeaderboardWallets();
  } catch (e) {
    wallets = SMART_MONEY_WALLETS;
    console.error('Using hardcoded wallets due to error:', e);
  }

  const batchSize = 10;
  const batchDelayMs = 200;
  const allSettledResults: PromiseSettledResult<any>[] = [];

  // Fetch positions in batches of 10 with 200ms delay between batches
  for (let i = 0; i < wallets.length; i += batchSize) {
    const batch = wallets.slice(i, i + batchSize);
    if (i > 0) {
      await new Promise(resolve => setTimeout(resolve, batchDelayMs));
    }
    const batchResults = await Promise.allSettled(
      batch.map(wallet => 
        hlPost({ type: 'clearinghouseState', user: wallet })
          .catch(() => null)
      )
    );
    allSettledResults.push(...batchResults);
  }

  let totalLong = 0, totalShort = 0, longCount = 0, shortCount = 0;
  const walletsData: any[] = [];

  allSettledResults.forEach((result, idx) => {
    if (result.status !== 'fulfilled' || !result.value?.assetPositions) return;
    const state = result.value;
    const hypePos = state.assetPositions.find((p: any) => p.position?.coin === 'HYPE');
    if (!hypePos) return;

    const szi = parseFloat(hypePos.position.szi);
    const unrealizedPnl = parseFloat(hypePos.position.unrealizedPnl);
    const leverage = parseFloat(hypePos.position.leverage?.value || 1);
    const sizeUsd = Math.abs(szi) * markPrice;

    if (szi > 0) { totalLong += sizeUsd; longCount++; }
    else { totalShort += sizeUsd; shortCount++; }

    walletsData.push({
      wallet: wallets[idx],
      direction: szi > 0 ? 'LONG' : 'SHORT',
      sizeUsd, leverage, unrealizedPnl,
    });
  });

  const total = totalLong + totalShort;
  if (total === 0) return { longPct: 50, shortPct: 50, ratio: 1, sentiment: 'NEUTRAL', netUsd: 0, wallets: [] };
  
  return {
    longPct: (totalLong / total) * 100,
    shortPct: (totalShort / total) * 100,
    ratio: totalShort > 0 ? totalLong / totalShort : totalLong,
    signal: totalLong > totalShort * 1.5 ? 'LONGS_DOMINANT' :
            totalShort > totalLong * 1.5 ? 'SHORTS_DOMINANT' : 'BALANCED',
    sentiment: totalLong > totalShort ? 'BULLISH' : 'BEARISH', // keep for backward compat
    longCount,
    shortCount,
    netUsd: totalLong - totalShort,
    wallets: walletsData,
  };
}

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

// ─── Calculate S/R Levels from OHLCV (audit PART 4) ───
function calculateSR(candles: any[], lookback = 50) {
  const highs = candles.slice(-lookback).map((c: any) => parseFloat(c.h));
  const lows = candles.slice(-lookback).map((c: any) => parseFloat(c.l));
  const closes = candles.slice(-lookback).map((c: any) => parseFloat(c.c));
  const currentPrice = closes[closes.length - 1] || 0;

  // Find pivot highs (local maxima)
  const pivotHighs: number[] = [];
  for (let i = 2; i < highs.length - 2; i++) {
    if (highs[i] > highs[i-1] && highs[i] > highs[i-2] &&
        highs[i] > highs[i+1] && highs[i] > highs[i+2]) {
      pivotHighs.push(highs[i]);
    }
  }

  // Find pivot lows (local minima)
  const pivotLows: number[] = [];
  for (let i = 2; i < lows.length - 2; i++) {
    if (lows[i] < lows[i-1] && lows[i] < lows[i-2] &&
        lows[i] < lows[i+1] && lows[i] < lows[i+2]) {
      pivotLows.push(lows[i]);
    }
  }

  // Cluster nearby levels (within 0.5%)
  function clusterLevels(levels: number[]) {
    const clustered: { price: number; strength: number }[] = [];
    const sorted = [...levels].sort((a, b) => a - b);
    let group = [sorted[0]];
    
    for (let i = 1; i < sorted.length; i++) {
      if ((sorted[i] - group[0]) / group[0] < 0.005) {
        group.push(sorted[i]);
      } else {
        clustered.push({
          price: group.reduce((a, b) => a + b) / group.length,
          strength: Math.min(99, group.length * 20 + 40)
        });
        group = [sorted[i]];
      }
    }
    if (group.length) clustered.push({
      price: group.reduce((a, b) => a + b) / group.length,
      strength: Math.min(99, group.length * 20 + 40)
    });
    return clustered;
  }

  const allResistances = clusterLevels(pivotHighs)
    .filter(l => l.price > currentPrice)
    .sort((a, b) => a.price - b.price)
    .slice(0, 3);

  const allSupports = clusterLevels(pivotLows)
    .filter(l => l.price < currentPrice)
    .sort((a, b) => b.price - a.price)
    .slice(0, 3);

  return { resistances: allResistances, supports: allSupports };
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

// ─── Calculate EMA ───
function calcEMA(values: number[], period: number): number[] {
  if (values.length < period) return [];
  const k = 2 / (period + 1);
  const ema: number[] = [];
  // First EMA is SMA of first 'period' values
  let prevEma = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  ema.push(prevEma);
  for (let i = period; i < values.length; i++) {
    const currentEma = values[i] * k + prevEma * (1 - k);
    ema.push(currentEma);
    prevEma = currentEma;
  }
  return ema;
}

// ─── Calculate MACD ───
function calcMACD(closes: number[], fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
  const fastEMA = calcEMA(closes, fastPeriod);
  const slowEMA = calcEMA(closes, slowPeriod);
  // MACD line = fastEMA - slowEMA (align lengths)
  const startIdx = slowPeriod - fastPeriod;
  const macdLine: number[] = [];
  for (let i = 0; i < fastEMA.length - startIdx; i++) {
    macdLine.push(fastEMA[startIdx + i] - slowEMA[i]);
  }
  // Signal line = EMA of MACD line
  const signalLine = calcEMA(macdLine, signalPeriod);
  // Histogram = MACD - signal (align lengths)
  const histStart = signalPeriod - 1;
  const histogram: number[] = [];
  for (let i = 0; i < macdLine.length - histStart; i++) {
    histogram.push(macdLine[histStart + i] - signalLine[i]);
  }
  return { macdLine, signalLine, histogram };
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
    const macd = calcMACD(closes, 12, 26, 9);
    const srLevels = calculateSR(candlesRaw || []);
    
    // Liquidation zones (audit PART 2)
    const liqZones = [
      { side: 'short', low: 44.64, high: 45.35, usd: 43.9e6 },
      { side: 'short', low: 44.99, high: 45.69, usd: 50.6e6 },
      { side: 'long', low: 39.36, high: 40.07, usd: 57.3e6 },
      { side: 'long', low: 38.91, high: 39.61, usd: 50.6e6 },
    ];

    const sma10Val = sma10.length ? sma10[sma10.length - 1] : null;
    const sma20Val = sma20.length ? sma20[sma20.length - 1] : null;
    const sma50Val = sma50.length ? sma50[sma50.length - 1] : null;
    const rsiVal = rsiArr.length ? rsiArr[rsiArr.length - 1] : null;
    const macdHistVal = macd.histogram.length ? macd.histogram[macd.histogram.length - 1] : null;
    const macdLineVal = macd.macdLine.length ? macd.macdLine[macd.macdLine.length - 1] : null;
    const macdSignalVal = macd.signalLine.length ? macd.signalLine[macd.signalLine.length - 1] : null;

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
      
      // OI: Hyperliquid returns two-sided gross OI (longs + shorts)
      // Conventional display = one side only → divide by 2
      const oi_tokens = parseFloat(ctx.openInterest) || 0;
      markPrice = parseFloat(ctx.markPx) || closes[closes.length - 1] || 0;
      oi = oi_tokens;
      oiUsd = (oi_tokens / 2) * markPrice;
      
      // Funding: raw rate is per hour, convert to 8h percentage
      const rawFunding = parseFloat(ctx.funding) || 0;
      fundingRate = rawFunding;
      funding8h = fundingRate * 8 * 100;
      fundingAnnual = funding8h * 3 * 365;
      
      prevDayPx = parseFloat(ctx.prevDayPx) || 0;
      vol24h = parseFloat(ctx.dayNtlVlm) || 0;
    }

    // ERROR 3 — Smart Money L/S Ratio
    const sm = await fetchSmartMoney(markPrice).catch(e => { errors.push(`SmartMoney: ${e.message}`); return null; });

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

      // Indicators (SMA, RSI, MACD)
      sma10: sma10Val,
      sma20: sma20Val,
      sma50: sma50Val,
      rsi: rsiVal,
      macd_histogram: macdHistVal,
      macd_line: macdLineVal,
      macd_signal: macdSignalVal,

      // Chart data
      candles: ts.map((t, i) => ({
        time: t,
        open: opens[i],
        high: highs[i],
        low: lows[i],
        close: closes[i],
        volume: volumes[i],
      })),
      srLevels,  // S/R levels from OHLCV
      liqZones,  // Liquidation zones
      sma10History: ts.slice(offset10).map((t, i) => [t, sma10[i]]),
      sma20History: ts.slice(offset20).map((t, i) => [t, sma20[i]]),
      sma50History: ts.slice(offset50).map((t, i) => [t, sma50[i]]),
      rsiHistory: ts.slice(offsetRsi).map((t, i) => [t, rsiArr[i]]),
      macdLineHistory: (() => {
        const offset = ts.length - macd.macdLine.length;
        return ts.slice(offset).map((t, i) => [t, macd.macdLine[i]]);
      })(),
      macdSignalHistory: (() => {
        const offset = ts.length - macd.signalLine.length;
        return ts.slice(offset).map((t, i) => [t, macd.signalLine[i]]);
      })(),
      macdHistogramHistory: (() => {
        const offset = ts.length - macd.histogram.length;
        return ts.slice(offset).map((t, i) => [t, macd.histogram[i]]);
      })(),
      prices: ts.map((t, i) => [t, closes[i]]),

      // Derivatives
      open_interest: oi > 0 ? { usd: oiUsd, tokens: oi } : null,
      funding_rate: fundingRate,
      funding_8h_pct: funding8h,
      funding_annual_pct: fundingAnnual,
      funding_direction: funding8h >= 0 ? 'Longs pay shorts' : 'Shorts pay longs',

      // ERROR 3 — Smart Money L/S Ratio
      smartMoney: sm,

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
