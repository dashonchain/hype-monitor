import type { ParsedCandle, Indicators, MarketData, Timeframe } from '../types';
import { TIMEFRAME_CONFIG } from '../types';
import { SMA, RSI, calcMACD, calcStoch, calcKDJ, calcCCI, calcADX, calcBB } from './indicators';
import { calcSR, estimateLiqZones, computeSignal } from './signal';

const HL_API = 'https://api.hyperliquid.xyz/info';
const CG_URL = 'https://api.coingecko.com/api/v3/simple/price?ids=hyperliquid&vs_currencies=usd&include_market_cap=true';

async function hlPost(body: any) {
  const r = await fetch(HL_API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(`HL ${r.status}`);
  return r.json();
}

export async function fetchMarketData(tf: Timeframe): Promise<MarketData> {
  const cfg = TIMEFRAME_CONFIG[tf];
  const now = Date.now();
  const start = now - cfg.days * 86400 * 1000;

  const [raw, meta, cg] = await Promise.all([
    hlPost({ type: 'candleSnapshot', req: { coin: 'HYPE', interval: cfg.interval, startTime: start, endTime: now } }),
    hlPost({ type: 'metaAndAssetCtxs' }),
    fetch(CG_URL).then(r => r.json()).catch(() => null),
  ]);

  // Parse candles
  const candles: ParsedCandle[] = [];
  for (const c of raw) {
    const o = parseFloat(c.o), h = parseFloat(c.h), l = parseFloat(c.l), cl = parseFloat(c.c), v = parseFloat(c.v);
    if (isNaN(o) || isNaN(h) || isNaN(l) || isNaN(cl)) continue;
    candles.push({ time: c.t, open: o, high: h, low: l, close: cl, volume: v });
  }

  const closes = candles.map(c => c.close);
  const highs = candles.map(c => c.high);
  const lows = candles.map(c => c.low);

  // Find HYPE context
  let ctx: any = null;
  if (Array.isArray(meta) && meta.length === 2) {
    const m = meta[0], cx = meta[1];
    if (m?.universe && Array.isArray(cx)) {
      const idx = m.universe.findIndex((a: any) => a.name === 'HYPE');
      if (idx >= 0) ctx = cx[idx];
    }
  }

  const markPrice = parseFloat(ctx?.markPx) || closes[closes.length - 1] || 0;
  const prevDayPx = parseFloat(ctx?.prevDayPx) || 0;
  const change24h = prevDayPx > 0 ? ((markPrice / prevDayPx) - 1) * 100 : 0;

  const candlesPerDay = tf === '1h' ? 24 : tf === '4h' ? 6 : 1;
  const price7dAgo = closes.length > 7 * candlesPerDay ? closes[closes.length - 7 * candlesPerDay] : closes[0];
  const change7d = price7dAgo > 0 ? ((markPrice / price7dAgo) - 1) * 100 : 0;
  const price30dAgo = closes.length > 30 * candlesPerDay ? closes[closes.length - 30 * candlesPerDay] : closes[0];
  const change30d = price30dAgo > 0 ? ((markPrice / price30dAgo) - 1) * 100 : 0;

  // Indicators
  const sma10 = SMA(closes, 10), sma20 = SMA(closes, 20), sma50 = SMA(closes, 50);
  const macdResult = calcMACD(closes);
  const stoch = calcStoch(highs, lows, closes);
  const kdj = calcKDJ(highs, lows, closes);
  const bb = calcBB(closes);

  const indicators: Indicators = {
    sma10: sma10.length ? sma10[sma10.length - 1] : 0,
    sma20: sma20.length ? sma20[sma20.length - 1] : 0,
    sma50: sma50.length ? sma50[sma50.length - 1] : 0,
    rsi14: RSI(closes),
    macd: macdResult.macd,
    macdSignal: macdResult.signal,
    macdHist: macdResult.hist,
    stochK: stoch.k,
    stochD: stoch.d,
    kdjK: kdj.k,
    kdjD: kdj.d,
    kdjJ: kdj.j,
    cci: calcCCI(highs, lows, closes),
    adx: calcADX(highs, lows, closes),
    bbUpper: bb.upper,
    bbMiddle: bb.middle,
    bbLower: bb.lower,
    bbPercentB: bb.percentB,
  };

  // Derivatives
  const oiTokens = parseFloat(ctx?.openInterest) || 0;
  const fundingRate = parseFloat(ctx?.funding) || 0;
  const vol24h = parseFloat(ctx?.dayNtlVlm) || 0;
  const marketCap = cg?.hyperliquid?.usd_market_cap || 0;

  // S/R + Liq
  const sr = calcSR(candles);
  const liqZones = estimateLiqZones(markPrice, oiTokens);

  // High/Low 24h
  const recentCandles = candles.slice(-candlesPerDay);
  const high24h = recentCandles.length ? Math.max(...recentCandles.map(c => c.high)) : markPrice;
  const low24h = recentCandles.length ? Math.min(...recentCandles.map(c => c.low)) : markPrice;

  const baseData: Omit<MarketData, 'signal'> = {
    price: markPrice,
    change24h, change7d, change30d,
    high24h, low24h,
    marketCap, volume24h: vol24h,
    oiUsd: oiTokens * markPrice,
    oiTokens,
    funding8h: fundingRate * 100,
    fundingAnn: fundingRate * 3 * 365 * 100,
    indicators,
    srLevels: sr,
    liqZones,
    lastUpdated: Date.now(),
    timeframe: tf,
  };

  return { ...baseData, signal: computeSignal(baseData as MarketData) };
}
