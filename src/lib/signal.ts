import type { MarketData, Signal, SignalAction, SRLevel, LiqZone, ParsedCandle } from '../types';
import { isStale } from './format';

export function computeSignal(d: MarketData): Signal {
  let buy = 0, sell = 0, neutral = 0;
  const p = d.price, ind = d.indicators;

  if (p > ind.sma10) buy++; else sell++;
  if (p > ind.sma20) buy++; else sell++;
  if (p > ind.sma50) buy++; else sell++;
  if (ind.sma10 > ind.sma20) buy++; else sell++;
  if (ind.sma20 > ind.sma50) buy++; else sell++;

  if (ind.rsi14 < 30) buy += 2;
  else if (ind.rsi14 > 70) sell += 2;
  else if (ind.rsi14 > 50) buy++;
  else sell++;
  neutral++;

  if (ind.macdHist > 0) buy++; else sell++;
  if (ind.stochK < 20) buy++;
  else if (ind.stochK > 80) sell++;
  else neutral++;
  if (ind.kdjJ < 20) buy++;
  else if (ind.kdjJ > 80) sell++;
  else neutral++;
  if (ind.cci < -100) buy++;
  else if (ind.cci > 100) sell++;
  else neutral++;
  if (ind.bbPercentB < 0) buy++;
  else if (ind.bbPercentB > 1) sell++;
  else neutral++;
  if (d.funding8h < 0) buy++;
  else if (d.funding8h > 0.01) neutral++;
  if (p > ind.vwap) buy++; else sell++;
  if (ind.williamsR < -80) buy++;
  else if (ind.williamsR > -20) sell++;
  else neutral++;
  if (ind.mfi < 20) buy += 2;
  else if (ind.mfi > 80) sell += 2;
  else if (ind.mfi > 50) buy++;
  else sell++;
  if (ind.stochRsi < 0.2) buy++;
  else if (ind.stochRsi > 0.8) sell++;
  else neutral++;
  if (ind.obvTrend === 'rising') buy++;
  else if (ind.obvTrend === 'falling') sell++;
  else neutral++;

  // ERROR 6 — Composite Signal: add Smart Money as weighted factor
  if (d.smartMoney) {
    const sm = d.smartMoney;
    // Smart Money sentiment (weight = 3)
    if (sm.sentiment === 'BULLISH') { buy += 3; }
    else if (sm.sentiment === 'BEARISH') { sell += 3; }
    // Bonus: strong net position
    if (Math.abs(sm.netUsd) > 50_000_000) {
      if (sm.netUsd > 0) buy += 2;
      else sell += 2;
    }
  }

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
  const zoneRadius = currentPrice * 0.008;

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
      .map(c => ({ price: c.price, strength: Math.min(99, 40 + c.count * 20), type: isResistance ? 'resistance' as const : 'support' as const }));
  };

  return { resistances: cluster(swingHighs, true), supports: cluster(swingLows, false) };
}

/**
 * Estimate liquidation zones from candle wick clusters.
 * Long liqs cluster around candle lows (panic sell wicks).
 * Short liqs cluster around candle highs (panic buy wicks).
 * Uses the actual candle data to find real price levels where liquidations concentrate.
 */
export function estimateLiqZonesFromCandles(candles: ParsedCandle[], markPrice: number, oiTokens: number): LiqZone[] {
  if (!oiTokens || candles.length < 20) return [];

  const liqOI = oiTokens * 0.075; // ~7.5% of OI is typically at risk

  // Find clusters of lows (long liquidation zones)
  const lows = candles.map(c => c.low).sort((a, b) => a - b);
  const highs = candles.map(c => c.high).sort((a, b) => b - a);

  // Simple clustering: group prices within 0.5% of each other
  const clusterPrices = (prices: number[], count: number): { avg: number; strength: number }[] => {
    const clusters: { sum: number; count: number }[] = [];
    const threshold = markPrice * 0.005;
    for (const p of prices) {
      const existing = clusters.find(c => Math.abs(c.sum / c.count - p) < threshold);
      if (existing) { existing.sum += p; existing.count++; }
      else clusters.push({ sum: p, count: 1 });
    }
    return clusters
      .filter(c => c.count >= 3) // at least 3 touches
      .sort((a, b) => b.count - a.count)
      .slice(0, count)
      .map(c => ({ avg: c.sum / c.count, strength: c.count }));
  };

  const longClusters = clusterPrices(lows.slice(0, Math.floor(lows.length * 0.3)), 2)
    .filter(c => c.avg < markPrice * 0.99); // below current price

  const shortClusters = clusterPrices(highs.slice(0, Math.floor(highs.length * 0.3)), 2)
    .filter(c => c.avg > markPrice * 1.01); // above current price

  const zones: LiqZone[] = [];

  for (const c of longClusters) {
    const range = markPrice * 0.008;
    zones.push({
      priceLow: c.avg - range,
      priceHigh: c.avg + range,
      valueUsd: liqOI * markPrice * (0.3 + c.strength * 0.05),
      side: 'long' as const,
    });
  }

  for (const c of shortClusters) {
    const range = markPrice * 0.008;
    zones.push({
      priceLow: c.avg - range,
      priceHigh: c.avg + range,
      valueUsd: liqOI * markPrice * (0.3 + c.strength * 0.05),
      side: 'short' as const,
    });
  }

  // Fallback: if no clusters found, use statistical levels
  if (zones.length === 0) {
    zones.push(
      { priceLow: markPrice * 0.96, priceHigh: markPrice * 0.975, valueUsd: liqOI * markPrice * 0.4, side: 'long' as const },
      { priceLow: markPrice * 1.025, priceHigh: markPrice * 1.04, valueUsd: liqOI * markPrice * 0.4, side: 'short' as const },
    );
  }

  return zones;
}
