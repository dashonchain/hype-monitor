import type { ParsedCandle, Indicators, MarketData, Timeframe, DominanceData, SmartMoneyData, SmartMoneyWallet } from '../types';
import { TIMEFRAME_CONFIG } from '../types';
import { SMA, RSI, calcMACD, calcStoch, calcKDJ, calcCCI, calcADX, calcBB, calcVWAP, calcATR, calcOBV, calcWilliamsR, calcMFI, calcStochRSI } from './indicators';
import { calcSR, estimateLiqZonesFromCandles, computeSignal } from './signal';

const HL_API = 'https://api.hyperliquid.xyz/info';
const CG_URL = 'https://api.coingecko.com/api/v3/simple/price?ids=hyperliquid,bitcoin,ethereum&vs_currencies=usd&include_market_cap=true&include_24hr_change=true';
const CG_CHART_URL = (id: string, days: number) =>
  `https://api.coingecko.com/api/v3/coins/${id}/market_chart?vs_currency=usd&days=${days}`;

async function hlPost(body: any) {
  const r = await fetch(HL_API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(`HL ${r.status}`);
  return r.json();
}

async function fetchCoinDominance(coinId: string, symbol: string, name: string, days: number): Promise<DominanceData> {
  const chart = await fetch(CG_CHART_URL(coinId, days)).then(r => r.json()).catch(() => null);
  if (!chart?.prices?.length) {
    return { symbol, name, price: 0, change24h: 0, change7d: 0, change30d: 0, marketCap: 0 };
  }
  const prices = chart.prices.map((p: number[]) => p[1]);
  const current = prices[prices.length - 1];
  const change24h = prices.length > 1 ? ((current / prices[Math.max(0, prices.length - 24)]) - 1) * 100 : 0;
  const change7d = prices.length > 24 * 7 ? ((current / prices[prices.length - 24 * 7]) - 1) * 100 : 0;
  const change30d = prices.length > 24 * 30 ? ((current / prices[prices.length - 24 * 30]) - 1) * 100 : 0;
  return { symbol, name, price: current, change24h, change7d, change30d, marketCap: 0 };
}

export async function fetchMarketData(tf: Timeframe): Promise<MarketData> {
  const cfg = TIMEFRAME_CONFIG[tf];
  const now = Date.now();
  const start = now - cfg.days * 86400 * 1000;

  const [raw, meta, cg, domHype, domBtc, domEth] = await Promise.all([
    hlPost({ type: 'candleSnapshot', req: { coin: 'HYPE', interval: cfg.interval, startTime: start, endTime: now } }),
    hlPost({ type: 'metaAndAssetCtxs' }),
    fetch(CG_URL).then(r => r.json()).catch(() => null),
    fetchCoinDominance('hyperliquid', 'HYPE', 'Hyperliquid', 30),
    fetchCoinDominance('bitcoin', 'BTC', 'Bitcoin', 30),
    fetchCoinDominance('ethereum', 'ETH', 'Ethereum', 30),
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

  // Find HYPE context — ERROR 1 & 2 fix (audit)
  let ctx: any = null;
  let markPrice = closes[closes.length - 1] || 0;
  if (Array.isArray(meta) && meta.length === 2) {
    const universe = meta[0]?.universe;
    const assetCtxs = meta[1];
    if (universe && Array.isArray(assetCtxs)) {
      const hypeIdx = universe.findIndex((a: any) => a.name === 'HYPE');
      if (hypeIdx >= 0) {
        ctx = assetCtxs[hypeIdx];
        // Use markPx from API (more accurate than candle close)
        markPrice = parseFloat(ctx?.markPx) || markPrice;
      }
    }
  }

  const prevDayPx = parseFloat(ctx?.prevDayPx) || 0;
  const change24h = prevDayPx > 0 ? ((markPrice / prevDayPx) - 1) * 100 : 0;

  const candlesPerDay = tf === '1h' ? 24 : tf === '4h' ? 6 : 1;
  const price7dAgo = closes.length > 7 * candlesPerDay ? closes[closes.length - 7 * candlesPerDay] : closes[0];
  const change7d = price7dAgo > 0 ? ((markPrice / price7dAgo) - 1) * 100 : 0;
  const price30dAgo = closes.length > 30 * candlesPerDay ? closes[closes.length - 30 * candlesPerDay] : closes[0];
  const change30d = price30dAgo > 0 ? ((markPrice / price30dAgo) - 1) * 100 : 0;

  const volumes = candles.map(c => c.volume);

  // Indicators
  const sma10 = SMA(closes, 10), sma20 = SMA(closes, 20), sma50 = SMA(closes, 50);
  const macdResult = calcMACD(closes);
  const stoch = calcStoch(highs, lows, closes);
  const kdj = calcKDJ(highs, lows, closes);
  const bb = calcBB(closes);
  const vwapResult = calcVWAP(highs, lows, closes, volumes);
  const atr = calcATR(highs, lows, closes);
  const obvResult = calcOBV(closes, volumes);
  const williamsR = calcWilliamsR(highs, lows, closes);
  const mfi = calcMFI(highs, lows, closes, volumes);
  const stochRsi = calcStochRSI(closes);

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
    // Pro indicators
    vwap: vwapResult.vwap,
    vwapUpper: vwapResult.upper,
    vwapLower: vwapResult.lower,
    atr,
    atrStop: markPrice - 1.5 * atr, // Suggested stop-loss (1.5x ATR below price)
    obvTrend: obvResult.trend,
    williamsR,
    mfi,
    stochRsi,
  };

  // Derivatives — ERROR 1 & 2 fix (audit)
  // OI: tokens from API, USD = tokens × markPrice
  // If OI appears 4x too high, check if we're reading wrong field
  const oiTokens = parseFloat(ctx?.openInterest) || 0;
  const oiUsd = oiTokens * markPrice;
  
  // ERROR 2: funding is decimal, convert to percentage
  // funding field = 8h rate as decimal (e.g., 0.00005 = 0.005%)
  const fundingRate = parseFloat(ctx?.funding) || 0;
  const funding8hPct = fundingRate * 100; // to percentage
  const fundingAnnPct = fundingRate * 3 * 365 * 100; // annualized (8h × 3 × 365)
  
  const vol24h = parseFloat(ctx?.dayNtlVlm) || 0;
  const marketCap = cg?.hyperliquid?.usd_market_cap || 0;

  // S/R + Liq
  const sr = calcSR(candles);
  const liqZones = estimateLiqZonesFromCandles(candles, markPrice, oiTokens);

  // ERROR 3 — Smart Money L/S Ratio
  const smartMoney = await fetchSmartMoney(markPrice);

  // High/Low 24h
  const recentCandles = candles.slice(-candlesPerDay);
  const high24h = recentCandles.length ? Math.max(...recentCandles.map(c => c.high)) : markPrice;
  const low24h = recentCandles.length ? Math.min(...recentCandles.map(c => c.low)) : markPrice;

  const baseData: Omit<MarketData, 'signal'> = {
    price: markPrice,
    change24h, change7d, change30d,
    high24h, low24h,
    marketCap, volume24h: vol24h,
    oiUsd: oiUsd,  // Use pre-calculated OI USD
    oiTokens,
    funding8h: funding8hPct,  // Use corrected percentage
    fundingAnn: fundingAnnPct,  // Use corrected annualized
    indicators,
    srLevels: sr,
    liqZones,
    lastUpdated: Date.now(),
    timeframe: tf,
    dominance: [domHype, domBtc, domEth],
    smartMoney,  // ERROR 3 fix
  };

  return { ...baseData, signal: computeSignal(baseData as MarketData) };
}

// ERROR 3 — Smart Money L/S Ratio (audit fix)
const SMART_MONEY_WALLETS = [
  "0x082e843a431aef031264dc232693dd710aedca88",  // $61.1M long, +$7.76M PnL
  "0x8def9f50456c6c4e37fa5d3d57f108ed23992dae",  // $38.9M short, -$2.7M PnL
  "0x939f95036d2e7b6d7419ec072bf9d967352204d2",   // $25.6M short, -$3.0M PnL
  "0x45d26f28196d226497130c4bac709d808fed4029",   // $20.6M short, -$7.2M PnL
  "0x856c35038594767646266bc7fd68dc26480e910d",   // $20.4M short, -$1.8M PnL
];

export async function fetchSmartMoney(markPrice: number): Promise<SmartMoneyData> {
  const positions = await Promise.all(
    SMART_MONEY_WALLETS.map(wallet =>
      hlPost({ type: 'clearinghouseState', user: wallet })
        .catch(() => null)
    )
  );

  let totalLong = 0;
  let totalShort = 0;
  const walletData: SmartMoneyWallet[] = [];

  positions.forEach((state, i) => {
    if (!state?.assetPositions) return;
    const hypePos = state.assetPositions.find(
      (p: any) => p.position?.coin === 'HYPE'
    );
    if (!hypePos) return;

    const szi = parseFloat(hypePos.position.szi);
    const entryPx = parseFloat(hypePos.position.entryPx);
    const unrealizedPnl = parseFloat(hypePos.position.unrealizedPnl);
    const leverage = parseFloat(hypePos.position.leverage?.value || 1);
    const sizeUsd = Math.abs(szi) * markPrice;

    if (szi > 0) totalLong += sizeUsd;
    else totalShort += sizeUsd;

    walletData.push({
      wallet: SMART_MONEY_WALLETS[i].slice(0, 10) + "...",
      direction: szi > 0 ? 'LONG' : 'SHORT',
      sizeUsd,
      leverage,
      unrealizedPnl,
    });
  });

  const total = totalLong + totalShort;
  if (total === 0) {
    return {
      longPct: 50, shortPct: 50, ratio: 1,
      sentiment: 'NEUTRAL', netUsd: 0, wallets: []
    };
  }

  return {
    longPct: (totalLong / total) * 100,
    shortPct: (totalShort / total) * 100,
    ratio: totalLong / totalShort,
    sentiment: totalLong > totalShort ? 'BULLISH' : 'BEARISH',
    netUsd: totalLong - totalShort,
    wallets: walletData,
  };
}
