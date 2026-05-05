import type { MarketData, Signal, SignalAction, SRLevel, LiqZone, ParsedCandle } from '../types';
import { isStale } from './format';

export function computeSignal(d: MarketData): Signal {
  let buy = 0, sell = 0, neutral = 0;
  const p = d.price, ind = d.indicators;

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
  if (d.funding8h < 0) buy++;
  else if (d.funding8h > 0.01) neutral++;

  // VWAP — price above VWAP = bullish (institutional accumulation)
  if (p > ind.vwap) buy++;
  else sell++;

  // Williams %R — <-80 oversold (buy), >-20 overbought (sell)
  if (ind.williamsR < -80) buy++;
  else if (ind.williamsR > -20) sell++;
  else neutral++;

  // MFI — volume-weighted RSI. <20 oversold, >80 overbought
  if (ind.mfi < 20) buy += 2;
  else if (ind.mfi > 80) sell += 2;
  else if (ind.mfi > 50) buy++;
  else sell++;

  // StochRSI — <0.2 oversold, >0.8 overbought (catches reversals early)
  if (ind.stochRsi < 0.2) buy++;
  else if (ind.stochRsi > 0.8) sell++;
  else neutral++;

  // OBV trend confirmation
  if (ind.obvTrend === 'rising') buy++;
  else if (ind.obvTrend === 'falling') sell++;
  else neutral++;

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

export function calcSR(candles: ParsedCandle[]): { supports: SRLevel[]; resistances: SRLevel[] } {
  if (candles.length < 20) return { supports: [], resistances: [] };

  const swingHighs: { price: number; idx: number }[] = [];
  const swingLows: { price: number; idx: number }[] = [];

  for (let i = 2; i < candles.length - 2; i++) {
    const h = candles[i].high;
    if (h > candles[i-1].high && h > candles[i-2].high && h > candles[i+1].high && h > candles[i+2].high) {
      swingHighs.push({ price: h, idx: i });
    }
    const l = candles[i].low;
    if (l < candles[i-1].low && l < candles[i-2].low && l < candles[i+1].low && l < candles[i+2].low) {
      swingLows.push({ price: l, idx: i });
    }
  }

  const currentPrice = candles[candles.length - 1].close;
  const zoneRadius = currentPrice * 0.005;

  const cluster = (levels: { price: number; idx: number }[], isResistance: boolean): SRLevel[] => {
    if (!levels.length) return [];
    const sorted = [...levels].sort((a, b) => a.price - b.price);
    const clusters: { price: number; count: number }[] = [];
    for (const l of sorted) {
      const existing = clusters.find(c => Math.abs(c.price - l.price) < zoneRadius);
      if (existing) { existing.price = (existing.price * existing.count + l.price) / (existing.count + 1); existing.count++; }
      else clusters.push({ price: l.price, count: 1 });
    }
    return clusters
      .filter(c => isResistance ? c.price > currentPrice : c.price < currentPrice)
      .sort((a, b) => isResistance ? a.price - b.price : b.price - a.price)
      .slice(0, 3)
      .map(c => ({ price: c.price, strength: Math.min(99, 50 + c.count * 15), type: isResistance ? 'resistance' as const : 'support' as const }));
  };

  return { resistances: cluster(swingHighs, true), supports: cluster(swingLows, false) };
}

export function estimateLiqZones(markPrice: number, oiTokens: number): LiqZone[] {
  if (!oiTokens) return [];
  const liqOI = oiTokens * 0.075;
  return [
    { priceLow: markPrice * 0.97, priceHigh: markPrice * 0.975, valueUsd: liqOI * markPrice * 0.5, side: 'long' as const },
    { priceLow: markPrice * 1.025, priceHigh: markPrice * 1.03, valueUsd: liqOI * markPrice * 0.5, side: 'short' as const },
  ];
}
