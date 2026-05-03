'use client';

import { useEffect, useState, useCallback, useRef } from 'react';

/* ══════════════════════════════════════════════
   TYPES
   ══════════════════════════════════════════════ */
interface Candle { t: number; o: string; h: string; l: string; c: string; v: string }

interface HLContext {
  funding: string;
  openInterest: string;
  prevDayPx: string;
  dayNtlVlm: string;
  markPx: string;
  oraclePx: string;
  dayBaseVlm: string;
  premium: string;
}

interface ParsedCandle {
  time: number; open: number; high: number; low: number; close: number; volume: number;
}

interface IndicatorSet {
  sma10: number; sma20: number; sma50: number;
  rsi14: number;
  ema12: number; ema26: number;
  macd: number; macdSignal: number; macdHist: number;
  stochK: number; stochD: number;
  kdjK: number; kdjD: number; kdjJ: number;
  cci: number; adx: number;
  bbUpper: number; bbMiddle: number; bbLower: number; bbPercentB: number;
}

interface SRLevel { price: number; strength: number; type: 'support' | 'resistance' }

interface LiqZone { priceLow: number; priceHigh: number; valueUsd: number; side: 'long' | 'short' }

interface AppData {
  price: number;
  change24h: number; change7d: number; change30d: number;
  high24h: number; low24h: number;
  marketCap: number; volume24h: number;
  oiUsd: number; oiTokens: number;
  funding8h: number; fundingAnn: number;
  indicators: IndicatorSet;
  srLevels: { supports: SRLevel[]; resistances: SRLevel[] };
  liqZones: LiqZone[];
  lastUpdated: number;
  timeframe: string;
}

type SignalAction = 'strong_buy' | 'buy' | 'neutral' | 'sell' | 'strong_sell';

interface Signal {
  action: SignalAction;
  display: string;
  score: number;
  summary: string;
  buy: number; sell: number; neutral: number;
}

/* ══════════════════════════════════════════════
   CONSTANTS
   ══════════════════════════════════════════════ */
const HL_API = 'https://api.hyperliquid.xyz/info';
const CG_URL = 'https://api.coingecko.com/api/v3/simple/price?ids=hyperliquid&vs_currencies=usd&include_market_cap=true';

const TF_MAP: Record<string, { interval: string; tvRes: string; days: number }> = {
  '1h':  { interval: '1h',  tvRes: '60',  days: 7 },
  '4h':  { interval: '4h',  tvRes: '240', days: 30 },
  '1d':  { interval: '1d',  tvRes: 'D',   days: 365 },
};

const TF_LABELS: Record<string, string> = { '1h': '1H', '4h': '4H', '1d': '1D' };

/* ══════════════════════════════════════════════
   HELPERS
   ══════════════════════════════════════════════ */
const fmt = (n: number, d = 2): string => {
  if (!n || isNaN(n)) return '—';
  if (Math.abs(n) >= 1e9) return `$${(Math.abs(n) / 1e9).toFixed(d)}B`;
  if (Math.abs(n) >= 1e6) return `$${(Math.abs(n) / 1e6).toFixed(d)}M`;
  if (Math.abs(n) >= 1e3) return `$${(Math.abs(n) / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(d)}`;
};

const fmtPct = (n: number): string => `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;

const timeAgo = (ts: number) => {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  return `${Math.floor(s / 3600)}h`;
};

const isStale = (ts: number) => (Date.now() - ts) > 120_000;

/* ══════════════════════════════════════════════
   TECHNICAL INDICATORS (pure math)
   ══════════════════════════════════════════════ */
function SMA(data: number[], p: number): number[] {
  if (data.length < p) return [];
  const r: number[] = [];
  for (let i = p - 1; i < data.length; i++) {
    r.push(data.slice(i - p + 1, i + 1).reduce((a, b) => a + b, 0) / p);
  }
  return r;
}

function EMA(data: number[], p: number): number[] {
  if (data.length < p) return [];
  const k = 2 / (p + 1);
  const r: number[] = [data.slice(0, p).reduce((a, b) => a + b, 0) / p];
  for (let i = p; i < data.length; i++) r.push(data[i] * k + r[r.length - 1] * (1 - k));
  return r;
}

function RSI(data: number[], p = 14): number {
  if (data.length < p + 1) return 50;
  const ch = data.slice(1).map((c, i) => c - data[i]);
  let g = ch.slice(0, p).filter(x => x > 0).reduce((a, b) => a + b, 0) / p;
  let l = ch.slice(0, p).filter(x => x < 0).reduce((a, b) => a + Math.abs(b), 0) / p;
  for (let i = p; i < ch.length; i++) {
    g = (g * (p - 1) + Math.max(ch[i], 0)) / p;
    l = (l * (p - 1) + Math.max(-ch[i], 0)) / p;
  }
  if (l === 0) return 100;
  return 100 - 100 / (1 + g / l);
}

function MACD(closes: number[]): { macd: number; signal: number; hist: number } {
  const ema12 = EMA(closes, 12);
  const ema26 = EMA(closes, 26);
  if (!ema12.length || !ema26.length) return { macd: 0, signal: 0, hist: 0 };
  const minLen = Math.min(ema12.length, ema26.length);
  const offset = ema12.length - minLen;
  const macdLine: number[] = [];
  for (let i = 0; i < minLen; i++) macdLine.push(ema12[i + offset] - ema26[i]);
  const signalLine = EMA(macdLine, 9);
  if (!signalLine.length) return { macd: 0, signal: 0, hist: 0 };
  const macdVal = macdLine[macdLine.length - 1];
  const sigVal = signalLine[signalLine.length - 1];
  return { macd: macdVal, signal: sigVal, hist: macdVal - sigVal };
}

function Stochastic(highs: number[], lows: number[], closes: number[], kP = 14, dP = 3): { k: number; d: number } {
  if (closes.length < kP) return { k: 50, d: 50 };
  const kVals: number[] = [];
  for (let i = kP - 1; i < closes.length; i++) {
    const hh = Math.max(...highs.slice(i - kP + 1, i + 1));
    const ll = Math.min(...lows.slice(i - kP + 1, i + 1));
    kVals.push(hh === ll ? 50 : ((closes[i] - ll) / (hh - ll)) * 100);
  }
  const dVals = SMA(kVals, dP);
  return { k: kVals[kVals.length - 1] || 50, d: dVals[dVals.length - 1] || 50 };
}

function KDJ(highs: number[], lows: number[], closes: number[], p = 9): { k: number; d: number; j: number } {
  if (closes.length < p) return { k: 50, d: 50, j: 50 };
  const rsvs: number[] = [];
  for (let i = p - 1; i < closes.length; i++) {
    const hh = Math.max(...highs.slice(i - p + 1, i + 1));
    const ll = Math.min(...lows.slice(i - p + 1, i + 1));
    rsvs.push(hh === ll ? 50 : ((closes[i] - ll) / (hh - ll)) * 100);
  }
  let k = 50, d = 50;
  for (const r of rsvs) { k = (2 / 3) * k + (1 / 3) * r; d = (2 / 3) * d + (1 / 3) * k; }
  return { k, d, j: 3 * k - 2 * d };
}

function CCI(highs: number[], lows: number[], closes: number[], p = 20): number {
  if (closes.length < p) return 0;
  const tp = closes.map((c, i) => (highs[i] + lows[i] + c) / 3);
  const lastTP = tp[tp.length - 1];
  const smaTP = tp.slice(-p).reduce((a, b) => a + b, 0) / p;
  const meanDev = tp.slice(-p).reduce((a, v) => a + Math.abs(v - smaTP), 0) / p;
  return meanDev === 0 ? 0 : (lastTP - smaTP) / (0.015 * meanDev);
}

function ADX(highs: number[], lows: number[], closes: number[], p = 14): number {
  if (closes.length < p + 1) return 25;
  const trs: number[] = [], plusDM: number[] = [], minusDM: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    const h = highs[i], l = lows[i], pc = closes[i - 1];
    trs.push(Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc)));
    const up = h - highs[i - 1], down = lows[i - 1] - l;
    plusDM.push(up > down && up > 0 ? up : 0);
    minusDM.push(down > up && down > 0 ? down : 0);
  }
  if (trs.length < p) return 25;
  let atr = trs.slice(0, p).reduce((a, b) => a + b, 0) / p;
  let spDM = plusDM.slice(0, p).reduce((a, b) => a + b, 0) / p;
  let smDM = minusDM.slice(0, p).reduce((a, b) => a + b, 0) / p;
  for (let i = p; i < trs.length; i++) {
    atr = (atr * (p - 1) + trs[i]) / p;
    spDM = (spDM * (p - 1) + plusDM[i]) / p;
    smDM = (smDM * (p - 1) + minusDM[i]) / p;
  }
  if (atr === 0) return 25;
  const pDI = (spDM / atr) * 100;
  const mDI = (smDM / atr) * 100;
  const dx = pDI + mDI === 0 ? 0 : Math.abs(pDI - mDI) / (pDI + mDI) * 100;
  return dx;
}

function Bollinger(closes: number[], p = 20, mult = 2): { upper: number; middle: number; lower: number; percentB: number } {
  if (closes.length < p) return { upper: 0, middle: 0, lower: 0, percentB: 0.5 };
  const slice = closes.slice(-p);
  const mid = slice.reduce((a, b) => a + b, 0) / p;
  const std = Math.sqrt(slice.reduce((a, v) => a + (v - mid) ** 2, 0) / p);
  const upper = mid + mult * std;
  const lower = mid - mult * std;
  const last = closes[closes.length - 1];
  const pb = upper === lower ? 0.5 : (last - lower) / (upper - lower);
  return { upper, middle: mid, lower, percentB: pb };
}

/* ══════════════════════════════════════════════
   SUPPORT / RESISTANCE CALCULATION
   ══════════════════════════════════════════════ */
function calculateSR(candles: ParsedCandle[], n = 20): { supports: SRLevel[]; resistances: SRLevel[] } {
  if (candles.length < n * 2) return { supports: [], resistances: [] };

  // Find swing highs and swing lows
  const swingHighs: { price: number; idx: number }[] = [];
  const swingLows: { price: number; idx: number }[] = [];

  for (let i = 2; i < candles.length - 2; i++) {
    const h = candles[i].high;
    if (h > candles[i - 1].high && h > candles[i - 2].high && h > candles[i + 1].high && h > candles[i + 2].high) {
      swingHighs.push({ price: h, idx: i });
    }
    const l = candles[i].low;
    if (l < candles[i - 1].low && l < candles[i - 2].low && l < candles[i + 1].low && l < candles[i + 2].low) {
      swingLows.push({ price: l, idx: i });
    }
  }

  const currentPrice = candles[candles.length - 1].close;
  const zoneRadius = currentPrice * 0.005; // 0.5% zone

  // Cluster nearby levels
  const clusterLevels = (levels: { price: number; idx: number }[], isResistance: boolean): SRLevel[] => {
    if (!levels.length) return [];
    const sorted = [...levels].sort((a, b) => a.price - b.price);
    const clusters: { price: number; count: number }[] = [];

    for (const l of sorted) {
      const existing = clusters.find(c => Math.abs(c.price - l.price) < zoneRadius);
      if (existing) {
        existing.price = (existing.price * existing.count + l.price) / (existing.count + 1);
        existing.count++;
      } else {
        clusters.push({ price: l.price, count: 1 });
      }
    }

    return clusters
      .filter(c => isResistance ? c.price > currentPrice : c.price < currentPrice)
      .sort((a, b) => isResistance ? a.price - b.price : b.price - a.price)
      .slice(0, 3)
      .map(c => ({
        price: c.price,
        strength: Math.min(99, 50 + c.count * 15),
        type: isResistance ? 'resistance' as const : 'support' as const,
      }));
  };

  return {
    resistances: clusterLevels(swingHighs, true),
    supports: clusterLevels(swingLows, false),
  };
}

/* ══════════════════════════════════════════════
   LIQUIDATION ZONES (estimated from OI distribution)
   ══════════════════════════════════════════════ */
function estimateLiqZones(candles: ParsedCandle[], oiTokens: number, markPrice: number): LiqZone[] {
  if (!candles.length || !oiTokens) return [];
  const current = candles[candles.length - 1].close;
  const range = current * 0.03; // ±3%

  // Estimate: liquidations cluster near recent swing levels
  const longLiqPrice = current - range * 0.6;
  const shortLiqPrice = current + range * 0.6;

  const liqOI = oiTokens * 0.15; // ~15% of OI at risk

  return [
    {
      priceLow: longLiqPrice - range * 0.1,
      priceHigh: longLiqPrice + range * 0.1,
      valueUsd: liqOI * longLiqPrice * 0.5,
      side: 'long',
    },
    {
      priceLow: shortLiqPrice - range * 0.1,
      priceHigh: shortLiqPrice + range * 0.1,
      valueUsd: liqOI * shortLiqPrice * 0.5,
      side: 'short',
    },
  ];
}

/* ══════════════════════════════════════════════
   SIGNAL COMPUTATION
   ══════════════════════════════════════════════ */
function computeSignal(d: AppData): Signal {
  let buy = 0, sell = 0, neutral = 0;
  const p = d.price;
  const ind = d.indicators;

  // SMA crossovers
  if (p > ind.sma10) buy++; else sell++;
  if (p > ind.sma20) buy++; else sell++;
  if (p > ind.sma50) buy++; else sell++;
  if (ind.sma10 > ind.sma20) buy++; else sell++;
  if (ind.sma20 > ind.sma50) buy++; else sell++;

  // RSI
  if (ind.rsi14 < 30) buy += 2;
  else if (ind.rsi14 > 70) sell += 2;
  else if (ind.rsi14 > 50) buy++;
  else sell++;
  neutral++;

  // MACD
  if (ind.macdHist > 0) buy++; else sell++;

  // Stoch
  if (ind.stochK < 20) buy++;
  else if (ind.stochK > 80) sell++;
  else neutral++;

  // KDJ
  if (ind.kdjJ < 20) buy++;
  else if (ind.kdjJ > 80) sell++;
  else neutral++;

  // CCI
  if (ind.cci < -100) buy++;
  else if (ind.cci > 100) sell++;
  else neutral++;

  // Bollinger %B
  if (ind.bbPercentB < 0) buy++;
  else if (ind.bbPercentB > 1) sell++;
  else neutral++;

  // Funding
  if (d.funding8h > 0.01) neutral++; // high funding = caution
  else if (d.funding8h < 0) buy++; // negative funding = bullish

  const total = buy + sell + neutral || 1;
  const score = Math.round((buy / total) * 100);

  let action: SignalAction = 'neutral';
  let display = 'NEUTRAL';
  let summary = 'Mixed signals';

  if (score >= 70) { action = 'strong_buy'; display = 'STRONG BUY'; summary = 'Strong bullish consensus'; }
  else if (score >= 58) { action = 'buy'; display = 'BUY'; summary = 'Bullish bias'; }
  else if (score <= 30) { action = 'strong_sell'; display = 'STRONG SELL'; summary = 'Strong bearish consensus'; }
  else if (score <= 42) { action = 'sell'; display = 'SELL'; summary = 'Bearish bias'; }

  if (isStale(d.lastUpdated)) {
    action = 'neutral'; display = 'STALE'; summary = 'Data stale — signal disabled';
  }

  return { action, display, score, summary, buy, sell, neutral };
}

/* ══════════════════════════════════════════════
   DATA FETCHING
   ══════════════════════════════════════════════ */
async function hlPost(body: any): Promise<any> {
  const res = await fetch(HL_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`HL ${res.status}`);
  return res.json();
}

async function fetchAllData(timeframe: string): Promise<AppData> {
  const cfg = TF_MAP[timeframe] || TF_MAP['1d'];
  const now = Date.now();
  const start = now - cfg.days * 86400 * 1000;

  // Fetch HL data + CoinGecko in parallel
  const [candlesRaw, metaResult, cgResult] = await Promise.all([
    hlPost({ type: 'candleSnapshot', req: { coin: 'HYPE', interval: cfg.interval, startTime: start, endTime: now } }),
    hlPost({ type: 'metaAndAssetCtxs' }),
    fetch(CG_URL).then(r => r.json()).catch(() => null),
  ]);

  // Parse candles
  const candles: ParsedCandle[] = [];
  for (const c of candlesRaw) {
    const o = parseFloat(c.o), h = parseFloat(c.h), l = parseFloat(c.l), cl = parseFloat(c.c), v = parseFloat(c.v);
    if (isNaN(o) || isNaN(h) || isNaN(l) || isNaN(cl)) continue;
    candles.push({ time: c.t, open: o, high: h, low: l, close: cl, volume: v });
  }

  // Find HYPE context
  let ctx: HLContext | null = null;
  if (Array.isArray(metaResult) && metaResult.length === 2) {
    const meta = metaResult[0];
    const ctxs = metaResult[1];
    if (meta?.universe && Array.isArray(ctxs)) {
      const idx = meta.universe.findIndex((a: any) => a.name === 'HYPE');
      if (idx >= 0 && ctxs[idx]) ctx = ctxs[idx];
    }
  }

  const closes = candles.map(c => c.close);
  const highs = candles.map(c => c.high);
  const lows = candles.map(c => c.low);

  // Price & changes
  const markPrice = parseFloat(ctx?.markPx || '') || closes[closes.length - 1] || 0;
  const prevDayPx = parseFloat(ctx?.prevDayPx || '') || 0;
  const change24h = prevDayPx > 0 ? ((markPrice / prevDayPx) - 1) * 100 : 0;

  // 7D change
  const candlesPerDay = timeframe === '1h' ? 24 : timeframe === '4h' ? 6 : 1;
  const idx7d = closes.length - (7 * candlesPerDay);
  const price7dAgo = idx7d >= 0 ? closes[idx7d] : closes[0];
  const change7d = price7dAgo > 0 ? ((markPrice / price7dAgo) - 1) * 100 : 0;

  // 30D change
  const idx30d = closes.length - (30 * candlesPerDay);
  const price30dAgo = idx30d >= 0 ? closes[idx30d] : closes[0];
  const change30d = price30dAgo > 0 ? ((markPrice / price30dAgo) - 1) * 100 : 0;

  // Indicators
  const sma10Arr = SMA(closes, 10);
  const sma20Arr = SMA(closes, 20);
  const sma50Arr = SMA(closes, 50);
  const ema12Arr = EMA(closes, 12);
  const ema26Arr = EMA(closes, 26);
  const macdResult = MACD(closes);
  const stoch = Stochastic(highs, lows, closes);
  const kdj = KDJ(highs, lows, closes);
  const bb = Bollinger(closes);

  const indicators: IndicatorSet = {
    sma10: sma10Arr.length ? sma10Arr[sma10Arr.length - 1] : 0,
    sma20: sma20Arr.length ? sma20Arr[sma20Arr.length - 1] : 0,
    sma50: sma50Arr.length ? sma50Arr[sma50Arr.length - 1] : 0,
    rsi14: RSI(closes, 14),
    ema12: ema12Arr.length ? ema12Arr[ema12Arr.length - 1] : 0,
    ema26: ema26Arr.length ? ema26Arr[ema26Arr.length - 1] : 0,
    macd: macdResult.macd,
    macdSignal: macdResult.signal,
    macdHist: macdResult.hist,
    stochK: stoch.k,
    stochD: stoch.d,
    kdjK: kdj.k,
    kdjD: kdj.d,
    kdjJ: kdj.j,
    cci: CCI(highs, lows, closes),
    adx: ADX(highs, lows, closes),
    bbUpper: bb.upper,
    bbMiddle: bb.middle,
    bbLower: bb.lower,
    bbPercentB: bb.percentB,
  };

  // Derivatives
  const oiTokens = parseFloat(ctx?.openInterest || '') || 0;
  const oiUsd = oiTokens * markPrice;
  const fundingRate = parseFloat(ctx?.funding || '') || 0;
  const funding8h = fundingRate * 100;
  const fundingAnn = fundingRate * 3 * 365 * 100;
  const vol24h = parseFloat(ctx?.dayNtlVlm || '') || 0;

  // MCAP from CoinGecko
  const marketCap = cgResult?.hyperliquid?.usd_market_cap || 0;

  // S/R levels
  const srLevels = calculateSR(candles);

  // Liquidation zones
  const liqZones = estimateLiqZones(candles, oiTokens, markPrice);

  // High/Low 24h
  const recentCandles = candles.slice(-candlesPerDay);
  const high24h = recentCandles.length ? Math.max(...recentCandles.map(c => c.high)) : markPrice;
  const low24h = recentCandles.length ? Math.min(...recentCandles.map(c => c.low)) : markPrice;

  return {
    price: markPrice,
    change24h, change7d, change30d,
    high24h, low24h,
    marketCap, volume24h: vol24h,
    oiUsd, oiTokens,
    funding8h, fundingAnn,
    indicators,
    srLevels,
    liqZones,
    lastUpdated: Date.now(),
    timeframe,
  };
}

/* ══════════════════════════════════════════════
   SIGNAL COLORS
   ══════════════════════════════════════════════ */
const SIGNAL_COLORS: Record<SignalAction, { bg: string; border: string; text: string }> = {
  strong_buy:  { bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', text: 'text-emerald-400' },
  buy:         { bg: 'bg-emerald-500/5',  border: 'border-emerald-500/20', text: 'text-emerald-400' },
  neutral:     { bg: 'bg-zinc-500/5',     border: 'border-zinc-500/20',    text: 'text-zinc-400' },
  sell:        { bg: 'bg-red-500/5',      border: 'border-red-500/20',     text: 'text-red-400' },
  strong_sell: { bg: 'bg-red-500/10',     border: 'border-red-500/30',     text: 'text-red-400' },
};

const SIGNAL_ICONS: Record<SignalAction, string> = {
  strong_buy: '↑↑', buy: '↑', neutral: '—', sell: '↓', strong_sell: '↓↓',
};

/* ══════════════════════════════════════════════
   TRADINGVIEW WIDGET COMPONENT
   ══════════════════════════════════════════════ */
declare global { interface Window { TradingView: any; } }

function TradingViewChart({ timeframe, data }: { timeframe: string; data: AppData | null }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<any>(null);

  useEffect(() => {
    if (!containerRef.current || !data) return;

    // Clean up previous widget
    if (widgetRef.current) {
      try { widgetRef.current.remove(); } catch {}
      widgetRef.current = null;
    }

    const container = containerRef.current;
    container.innerHTML = '';

    const tvRes = TF_MAP[timeframe]?.tvRes || 'D';

    try {
      widgetRef.current = new window.TradingView.widget({
        container_id: container.id,
        symbol: 'HYPERLIQUID:HYPEUSDC',
        interval: tvRes,
        timezone: 'Etc/UTC',
        theme: 'dark',
        style: '1',
        locale: 'en',
        toolbar_bg: '#0a0c11',
        enable_publishing: false,
        hide_side_toolbar: false,
        allow_symbol_change: false,
        height: 520,
        width: '100%',
        studies: [
          'RSI@tv-basicstudies',
          'MACD@tv-basicstudies',
        ],
        overrides: {
          'paneProperties.background': '#0a0c11',
          'paneProperties.backgroundType': 'solid',
          'scalesProperties.textColor': '#6b7280',
          'paneProperties.vertGridProperties.color': '#1a1d25',
          'paneProperties.horzGridProperties.color': '#1a1d25',
          'mainSeriesProperties.candleStyle.upColor': '#22c55e',
          'mainSeriesProperties.candleStyle.downColor': '#ef4444',
          'mainSeriesProperties.candleStyle.borderUpColor': '#22c55e',
          'mainSeriesProperties.candleStyle.borderDownColor': '#ef4444',
          'mainSeriesProperties.candleStyle.wickUpColor': '#22c55e',
          'mainSeriesProperties.candleStyle.wickDownColor': '#ef4444',
        },
        disabled_features: ['header_symbol_search', 'header_compare'],
        loading_screen: { backgroundColor: '#0a0c11', foregroundColor: '#0a0c11' },
      });

      // Draw annotations after chart is ready
      widgetRef.current.onChartReady(() => {
        try {
          const chart = widgetRef.current.activeChart();
          chart.removeAllShapes();

          // S/R lines
          data.srLevels.resistances.forEach(r => {
            chart.createShape(
              { price: r.price, time: Math.floor(Date.now() / 1000) },
              {
                shape: 'horizontal_line',
                lock: true,
                disableSelection: true,
                text: `R ${r.strength}%`,
                overrides: {
                  linecolor: 'rgba(239,68,68,0.7)',
                  linewidth: 2,
                  linestyle: 0,
                  showLabel: true,
                  textcolor: '#ef4444',
                },
              }
            );
          });

          data.srLevels.supports.forEach(s => {
            chart.createShape(
              { price: s.price, time: Math.floor(Date.now() / 1000) },
              {
                shape: 'horizontal_line',
                lock: true,
                disableSelection: true,
                text: `S ${s.strength}%`,
                overrides: {
                  linecolor: 'rgba(34,197,94,0.7)',
                  linewidth: 2,
                  linestyle: 0,
                  showLabel: true,
                  textcolor: '#22c55e',
                },
              }
            );
          });

          // Liquidation zones
          data.liqZones.forEach(z => {
            chart.createShape(
              [
                { price: z.priceLow, time: Math.floor((Date.now() - 86400000) / 1000) },
                { price: z.priceHigh, time: Math.floor(Date.now() / 1000) },
              ],
              {
                shape: 'rectangle',
                lock: true,
                disableSelection: true,
                text: `${z.side === 'short' ? 'Liq Shorts' : 'Liq Longs'} ${fmt(z.valueUsd)}`,
                overrides: {
                  backgroundColor: z.side === 'short' ? 'rgba(6,182,212,0.12)' : 'rgba(34,197,94,0.10)',
                  borderColor: z.side === 'short' ? 'rgba(6,182,212,0.4)' : 'rgba(34,197,94,0.3)',
                  showLabel: true,
                  textcolor: z.side === 'short' ? '#06b6d4' : '#22c55e',
                },
              }
            );
          });

          // Signal marker
          const signal = computeSignal(data);
          if (signal.action !== 'neutral') {
            chart.createShape(
              { price: data.price, time: Math.floor(Date.now() / 1000) },
              {
                shape: signal.action.includes('buy') ? 'arrow_up' : 'arrow_down',
                text: signal.display,
                overrides: {
                  color: signal.action.includes('buy') ? '#22c55e' : '#ef4444',
                },
              }
            );
          }
        } catch (e) {
          console.warn('Chart annotation error:', e);
        }
      });
    } catch (e) {
      console.warn('TV widget init error:', e);
      container.innerHTML = '<div class="flex items-center justify-center h-full text-zinc-600 text-sm">Chart unavailable</div>';
    }

    return () => {
      if (widgetRef.current) {
        try { widgetRef.current.remove(); } catch {}
        widgetRef.current = null;
      }
    };
  }, [timeframe, data]);

  return <div ref={containerRef} id="tv_chart_container" style={{ width: '100%', height: 520 }} />;
}

/* ══════════════════════════════════════════════
   STAT CARD
   ══════════════════════════════════════════════ */
function Stat({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="bg-zinc-900/60 border border-zinc-800/50 rounded-xl px-3 py-2.5">
      <div className="text-[9px] text-zinc-600 uppercase tracking-wider font-medium">{label}</div>
      <div className={`text-sm font-semibold mt-0.5 font-mono ${color || 'text-zinc-200'}`}>{value}</div>
      {sub && <div className="text-[9px] text-zinc-600 mt-0.5">{sub}</div>}
    </div>
  );
}

/* ══════════════════════════════════════════════
   MAIN COMPONENT
   ══════════════════════════════════════════════ */
export default function Home() {
  const [data, setData] = useState<AppData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tf, setTf] = useState('4h');
  const [fetchCount, setFetchCount] = useState(0);
  const [tfLoading, setTfLoading] = useState(false);

  const fetchData = useCallback(async (timeframe?: string, silent = false) => {
    try {
      if (!silent) setTfLoading(true);
      const d = await fetchAllData(timeframe || tf);
      setData(d);
      setFetchCount(c => c + 1);
      setError('');
    } catch (e: any) {
      if (e.name !== 'AbortError') setError(e.message || 'Error');
    } finally {
      setLoading(false);
      setTfLoading(false);
    }
  }, [tf]);

  useEffect(() => {
    fetchData();
    const i = setInterval(() => fetchData(undefined, true), 60000);
    return () => clearInterval(i);
  }, [fetchData]);

  const changeTimeframe = (t: string) => { setTf(t); fetchData(t); };

  // ─── Loading ───
  if (loading) return (
    <div className="min-h-screen bg-[#09090b] flex flex-col items-center justify-center gap-4">
      <div className="w-10 h-10 rounded-full border-2 border-zinc-800 border-t-cyan-500 animate-spin" />
      <p className="text-zinc-500 text-sm">Loading market data...</p>
    </div>
  );

  // ─── Error ───
  if (error && !data) return (
    <div className="min-h-screen bg-[#09090b] flex flex-col items-center justify-center gap-4 p-6">
      <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-2xl">⚠</div>
      <p className="text-red-400 font-semibold">Connection Error</p>
      <p className="text-zinc-600 text-sm">{error}</p>
      <button onClick={() => fetchData()} className="mt-2 px-5 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-300 hover:bg-zinc-700 text-sm font-medium">Retry</button>
    </div>
  );

  if (!data) return null;

  const signal = computeSignal(data);
  const sc = SIGNAL_COLORS[signal.action];
  const ind = data.indicators;
  const stale = isStale(data.lastUpdated);
  const rsiZone = ind.rsi14 > 70 ? 'Overbought' : ind.rsi14 < 30 ? 'Oversold' : ind.rsi14 > 50 ? 'Bullish' : 'Bearish';
  const rsiCol = ind.rsi14 > 70 ? 'text-red-400' : ind.rsi14 < 30 ? 'text-emerald-400' : ind.rsi14 > 50 ? 'text-emerald-400/70' : 'text-red-400/70';

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100 antialiased">

      {/* ═══ HEADER ═══ */}
      <header className="sticky top-0 z-50 bg-[#09090b]/95 backdrop-blur-xl border-b border-zinc-800/40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-12 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-md bg-cyan-500/15 border border-cyan-500/25 flex items-center justify-center text-cyan-400 text-[10px] font-black">H</div>
            <span className="text-sm font-semibold"><span className="text-white">HYPE</span><span className="text-zinc-500 font-normal">Monitor</span></span>
            <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${stale ? 'bg-red-500/10 text-red-500' : 'bg-emerald-500/10 text-emerald-500'}`}>
              {stale ? `⚠ Stale ${timeAgo(data.lastUpdated)}` : '● Live'}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-base font-semibold font-mono leading-tight">${data.price.toFixed(2)}</div>
              <div className={`text-[10px] font-medium leading-tight ${data.change24h >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {fmtPct(data.change24h)} <span className="text-zinc-600">24h</span>
              </div>
            </div>
            <button onClick={() => fetchData()} className="w-7 h-7 rounded-md bg-zinc-800/60 border border-zinc-700/40 flex items-center justify-center hover:bg-zinc-700/60 transition" title="Refresh">
              <svg className="w-3.5 h-3.5 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-4 space-y-4">

        {/* ═══ SIGNAL BANNER ═══ */}
        <div className={`rounded-xl border ${sc.border} ${sc.bg} p-4 ${stale ? 'opacity-60' : ''}`}>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg ${sc.bg} border ${sc.border} flex items-center justify-center text-xl font-black ${sc.text}`}>
                {SIGNAL_ICONS[signal.action]}
              </div>
              <div>
                <div className="text-[9px] text-zinc-600 uppercase tracking-widest font-medium">Signal · {TF_LABELS[data.timeframe]} · Hyperliquid</div>
                <div className={`text-xl font-bold tracking-tight ${sc.text}`}>{signal.display}</div>
                <div className="text-[10px] text-zinc-500">{signal.summary}</div>
              </div>
            </div>
            <div className="flex items-center gap-5">
              <div className="w-28">
                <div className="flex justify-between text-[9px] text-zinc-600 mb-0.5">
                  <span>Sell</span>
                  <span className={`font-mono font-bold ${sc.text}`}>{signal.score}%</span>
                  <span>Buy</span>
                </div>
                <div className="w-full bg-zinc-800 rounded-full h-1">
                  <div className={`h-full rounded-full transition-all duration-500 ${signal.score > 60 ? 'bg-emerald-500' : signal.score > 40 ? 'bg-amber-500' : 'bg-red-500'}`}
                    style={{ width: `${signal.score}%` }} />
                </div>
              </div>
              <div className="flex gap-3 text-center">
                <div><div className="text-base font-bold text-emerald-400">{signal.buy}</div><div className="text-[8px] text-zinc-600 uppercase">Buy</div></div>
                <div><div className="text-base font-bold text-zinc-400">{signal.neutral}</div><div className="text-[8px] text-zinc-600 uppercase">Neut</div></div>
                <div><div className="text-base font-bold text-red-400">{signal.sell}</div><div className="text-[8px] text-zinc-600 uppercase">Sell</div></div>
              </div>
            </div>
          </div>
        </div>

        {/* ═══ METRICS ROW 1 ═══ */}
        <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5">
          <Stat label="MCap" value={data.marketCap > 0 ? fmt(data.marketCap) : '—'} />
          <Stat label="Vol 24h" value={fmt(data.volume24h)} />
          <Stat label="High 24h" value={`$${data.high24h.toFixed(2)}`} />
          <Stat label="Low 24h" value={`$${data.low24h.toFixed(2)}`} />
          <Stat label="OI" value={fmt(data.oiUsd)} sub={`${fmt(data.oiTokens)} HYPE`} />
          <Stat label="Funding 8h" value={`${data.funding8h >= 0 ? '+' : ''}${data.funding8h.toFixed(4)}%`}
            color={data.funding8h > 0 ? 'text-emerald-400' : 'text-red-400'}
            sub={`Ann. ${data.fundingAnn.toFixed(1)}%`} />
          <Stat label="RSI(14)" value={ind.rsi14.toFixed(1)} color={rsiCol} sub={`${rsiZone} · ${TF_LABELS[data.timeframe]}`} />
        </div>

        {/* ═══ DERIVATIVES ROW ═══ */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
          <div className="bg-zinc-900/60 border border-zinc-800/50 rounded-xl px-3 py-2.5">
            <div className="text-[9px] text-zinc-600 uppercase tracking-wider font-medium">Long Liq Zone</div>
            <div className="text-sm font-semibold mt-0.5 font-mono text-emerald-400">
              {data.liqZones[0] ? fmt(data.liqZones[0].valueUsd) : '—'}
            </div>
            <div className="text-[9px] text-zinc-600 mt-0.5">
              {data.liqZones[0] ? `$${data.liqZones[0].priceLow.toFixed(2)} – $${data.liqZones[0].priceHigh.toFixed(2)}` : ''}
            </div>
          </div>
          <div className="bg-zinc-900/60 border border-zinc-800/50 rounded-xl px-3 py-2.5">
            <div className="text-[9px] text-zinc-600 uppercase tracking-wider font-medium">Short Liq Zone</div>
            <div className="text-sm font-semibold mt-0.5 font-mono text-cyan-400">
              {data.liqZones[1] ? fmt(data.liqZones[1].valueUsd) : '—'}
            </div>
            <div className="text-[9px] text-zinc-600 mt-0.5">
              {data.liqZones[1] ? `$${data.liqZones[1].priceLow.toFixed(2)} – $${data.liqZones[1].priceHigh.toFixed(2)}` : ''}
            </div>
          </div>
          <div className="bg-zinc-900/60 border border-zinc-800/50 rounded-xl px-3 py-2.5">
            <div className="text-[9px] text-zinc-600 uppercase tracking-wider font-medium">SMA 10</div>
            <div className="text-sm font-semibold mt-0.5 font-mono text-pink-300">${ind.sma10.toFixed(2)}</div>
            <div className={`text-[9px] mt-0.5 ${data.price > ind.sma10 ? 'text-emerald-500/60' : 'text-red-500/60'}`}>
              {data.price > ind.sma10 ? '▲ Above' : '▼ Below'}
            </div>
          </div>
          <div className="bg-zinc-900/60 border border-zinc-800/50 rounded-xl px-3 py-2.5">
            <div className="text-[9px] text-zinc-600 uppercase tracking-wider font-medium">SMA 50</div>
            <div className="text-sm font-semibold mt-0.5 font-mono text-blue-400">${ind.sma50.toFixed(2)}</div>
            <div className={`text-[9px] mt-0.5 ${data.price > ind.sma50 ? 'text-emerald-500/60' : 'text-red-500/60'}`}>
              {data.price > ind.sma50 ? '▲ Above' : '▼ Below'}
            </div>
          </div>
        </div>

        {/* ═══ TIMEFRAMES ═══ */}
        <div className="flex items-center gap-1">
          {Object.keys(TF_MAP).map(k => (
            <button key={k} onClick={() => changeTimeframe(k)}
              className={`relative px-5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                tf === k
                  ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/25'
                  : 'bg-zinc-900/40 text-zinc-500 border border-zinc-800/30 hover:text-zinc-300 hover:border-zinc-700/50'
              }`}>
              {TF_LABELS[k]}
              {tfLoading && tf === k && <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-cyan-500 rounded-full animate-pulse" />}
            </button>
          ))}
        </div>

        {/* ═══ MAIN GRID ═══ */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* ─── Left: Chart + Performance ─── */}
          <div className="lg:col-span-2 space-y-4">

            {/* TradingView Widget */}
            <div className="bg-zinc-900/60 border border-zinc-800/50 rounded-xl overflow-hidden">
              <div className="px-4 py-2 border-b border-zinc-800/40 flex items-center justify-between">
                <h3 className="text-xs font-semibold text-zinc-300">HYPE/USDT · TradingView</h3>
                <div className="flex gap-3 text-[9px]">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-emerald-500 inline-block" /> Bullish</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-red-500 inline-block" /> Bearish</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-0.5 bg-red-500/60 inline-block rounded" /> R</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-0.5 bg-green-500/60 inline-block rounded" /> S</span>
                </div>
              </div>
              <TradingViewChart timeframe={tf} data={data} />
            </div>

            {/* Performance */}
            <div className="grid grid-cols-3 gap-1.5">
              {([
                ['24h', data.change24h],
                ['7d', data.change7d],
                ['30d', data.change30d],
              ] as const).map(([label, val]) => (
                <div key={label} className="bg-zinc-900/60 border border-zinc-800/50 rounded-xl px-3 py-2.5">
                  <div className="text-[9px] text-zinc-600 uppercase tracking-wider font-medium">{label}</div>
                  <div className={`text-sm font-bold font-mono mt-0.5 ${val >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {fmtPct(val)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ─── Right: Indicators ─── */}
          <aside className="space-y-3">

            {/* Indicators Panel */}
            <div className="bg-zinc-900/60 border border-zinc-800/50 rounded-xl overflow-hidden">
              <div className="px-3 py-2 border-b border-zinc-800/40">
                <h3 className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Indicators · {TF_LABELS[data.timeframe]}</h3>
              </div>
              <div className="p-3 space-y-2">
                {([
                  ['SMA 10', `$${ind.sma10.toFixed(2)}`, data.price > ind.sma10 ? 'text-emerald-400' : 'text-red-400', data.price > ind.sma10 ? 'Above' : 'Below'],
                  ['SMA 20', `$${ind.sma20.toFixed(2)}`, data.price > ind.sma20 ? 'text-emerald-400' : 'text-red-400', data.price > ind.sma20 ? 'Above' : 'Below'],
                  ['SMA 50', `$${ind.sma50.toFixed(2)}`, data.price > ind.sma50 ? 'text-emerald-400' : 'text-red-400', data.price > ind.sma50 ? 'Above' : 'Below'],
                  ['RSI 14', ind.rsi14.toFixed(1), rsiCol, rsiZone],
                  ['MACD', ind.macd.toFixed(4), ind.macdHist > 0 ? 'text-emerald-400' : 'text-red-400', `Sig: ${ind.macdSignal.toFixed(4)}`],
                  ['Stoch K', ind.stochK.toFixed(1), ind.stochK > 80 ? 'text-red-400' : ind.stochK < 20 ? 'text-emerald-400' : 'text-zinc-400', `D: ${ind.stochD.toFixed(1)}`],
                  ['KDJ J', ind.kdjJ.toFixed(1), ind.kdjJ > 80 ? 'text-red-400' : ind.kdjJ < 20 ? 'text-emerald-400' : 'text-zinc-400', `K: ${ind.kdjK.toFixed(1)}`],
                  ['CCI', ind.cci.toFixed(1), ind.cci > 100 ? 'text-red-400' : ind.cci < -100 ? 'text-emerald-400' : 'text-zinc-400', ind.cci > 100 ? 'Overbought' : ind.cci < -100 ? 'Oversold' : 'Neutral'],
                  ['ADX', ind.adx.toFixed(1), ind.adx > 25 ? 'text-amber-400' : 'text-zinc-500', ind.adx > 25 ? 'Trending' : 'Ranging'],
                  ['BB %B', ind.bbPercentB.toFixed(3), ind.bbPercentB > 1 ? 'text-red-400' : ind.bbPercentB < 0 ? 'text-emerald-400' : 'text-zinc-400', `U: $${ind.bbUpper.toFixed(2)}`],
                ] as const).map(([label, value, color, sub]) => (
                  <div key={label} className="flex justify-between items-center">
                    <span className="text-[10px] text-zinc-600">{label}</span>
                    <div className="text-right">
                      <span className={`text-[10px] font-mono font-medium ${color}`}>{value}</span>
                      <span className="text-[8px] text-zinc-700 ml-1.5">{sub}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* RSI Gauge */}
            <div className="bg-zinc-900/60 border border-zinc-800/50 rounded-xl p-3">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">RSI (14)</h3>
                <span className={`text-sm font-bold font-mono ${rsiCol}`}>{ind.rsi14.toFixed(1)}</span>
              </div>
              <div className="relative h-1.5 rounded-full overflow-hidden" style={{ background: 'linear-gradient(to right, #22c55e 0%, #22c55e 30%, #eab308 30%, #eab308 70%, #ef4444 70%, #ef4444 100%)' }}>
                <div className="absolute top-0 h-full w-0.5 bg-white rounded-full shadow-sm transition-all duration-500" style={{ left: `${Math.min(100, Math.max(0, ind.rsi14))}%` }} />
              </div>
              <div className="flex justify-between text-[8px] text-zinc-700 mt-1">
                <span>Oversold (30)</span><span>Neutral</span><span>Overbought (70)</span>
              </div>
            </div>

            {/* S/R Levels */}
            {(data.srLevels.resistances.length > 0 || data.srLevels.supports.length > 0) && (
              <div className="bg-zinc-900/60 border border-zinc-800/50 rounded-xl overflow-hidden">
                <div className="px-3 py-2 border-b border-zinc-800/40">
                  <h3 className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Support / Resistance</h3>
                </div>
                <div className="p-3 space-y-1.5">
                  {data.srLevels.resistances.map((r, i) => (
                    <div key={`r${i}`} className="flex justify-between items-center">
                      <span className="text-[10px] text-red-400/70">R{i + 1}</span>
                      <span className="text-[10px] font-mono text-red-400">${r.price.toFixed(2)}</span>
                      <span className="text-[8px] text-zinc-600">{r.strength}%</span>
                    </div>
                  ))}
                  {data.srLevels.supports.map((s, i) => (
                    <div key={`s${i}`} className="flex justify-between items-center">
                      <span className="text-[10px] text-emerald-400/70">S{i + 1}</span>
                      <span className="text-[10px] font-mono text-emerald-400">${s.price.toFixed(2)}</span>
                      <span className="text-[8px] text-zinc-600">{s.strength}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="text-[9px] text-zinc-800 space-y-0.5 pt-2">
              <div>Hyperliquid · {fetchCount} fetches</div>
              <div>Updated {new Date(data.lastUpdated).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</div>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
