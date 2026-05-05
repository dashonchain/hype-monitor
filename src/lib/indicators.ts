export function SMA(data: number[], period: number): number[] {
  if (data.length < period) return [];
  const result: number[] = [];
  for (let i = period - 1; i < data.length; i++) {
    result.push(data.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0) / period);
  }
  return result;
}

export function EMA(data: number[], period: number): number[] {
  if (data.length < period) return [];
  const k = 2 / (period + 1);
  const result: number[] = [data.slice(0, period).reduce((a, b) => a + b, 0) / period];
  for (let i = period; i < data.length; i++) {
    result.push(data[i] * k + result[result.length - 1] * (1 - k));
  }
  return result;
}

export function RSI(data: number[], period = 14): number {
  if (data.length < period + 1) return 50;
  const changes = data.slice(1).map((c, i) => c - data[i]);
  let avgGain = changes.slice(0, period).filter(x => x > 0).reduce((a, b) => a + b, 0) / period;
  let avgLoss = changes.slice(0, period).filter(x => x < 0).reduce((a, b) => a + Math.abs(b), 0) / period;
  for (let i = period; i < changes.length; i++) {
    avgGain = (avgGain * (period - 1) + Math.max(changes[i], 0)) / period;
    avgLoss = (avgLoss * (period - 1) + Math.max(-changes[i], 0)) / period;
  }
  if (avgLoss === 0) return 100;
  return 100 - 100 / (1 + avgGain / avgLoss);
}

export function calcMACD(closes: number[]): { macd: number; signal: number; hist: number } {
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

export function calcStoch(highs: number[], lows: number[], closes: number[], kP = 14, dP = 3): { k: number; d: number } {
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

export function calcKDJ(highs: number[], lows: number[], closes: number[], period = 9): { k: number; d: number; j: number } {
  if (closes.length < period) return { k: 50, d: 50, j: 50 };
  const rsvs: number[] = [];
  for (let i = period - 1; i < closes.length; i++) {
    const hh = Math.max(...highs.slice(i - period + 1, i + 1));
    const ll = Math.min(...lows.slice(i - period + 1, i + 1));
    rsvs.push(hh === ll ? 50 : ((closes[i] - ll) / (hh - ll)) * 100);
  }
  let k = 50, d = 50;
  for (const r of rsvs) { k = (2 / 3) * k + (1 / 3) * r; d = (2 / 3) * d + (1 / 3) * k; }
  return { k, d, j: 3 * k - 2 * d };
}

export function calcCCI(highs: number[], lows: number[], closes: number[], period = 20): number {
  if (closes.length < period) return 0;
  const tp = closes.map((c, i) => (highs[i] + lows[i] + c) / 3);
  const smaTP = tp.slice(-period).reduce((a, b) => a + b, 0) / period;
  const meanDev = tp.slice(-period).reduce((a, v) => a + Math.abs(v - smaTP), 0) / period;
  return meanDev === 0 ? 0 : (tp[tp.length - 1] - smaTP) / (0.015 * meanDev);
}

export function calcADX(highs: number[], lows: number[], closes: number[], period = 14): number {
  if (closes.length < period + 1) return 25;
  const trs: number[] = [], pDM: number[] = [], mDM: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    trs.push(Math.max(highs[i] - lows[i], Math.abs(highs[i] - closes[i - 1]), Math.abs(lows[i] - closes[i - 1])));
    const up = highs[i] - highs[i - 1], dn = lows[i - 1] - lows[i];
    pDM.push(up > dn && up > 0 ? up : 0);
    mDM.push(dn > up && dn > 0 ? dn : 0);
  }
  if (trs.length < period) return 25;
  let atr = trs.slice(0, period).reduce((a, b) => a + b, 0) / period;
  let sp = pDM.slice(0, period).reduce((a, b) => a + b, 0) / period;
  let sm = mDM.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < trs.length; i++) { atr = (atr * (period - 1) + trs[i]) / period; sp = (sp * (period - 1) + pDM[i]) / period; sm = (sm * (period - 1) + mDM[i]) / period; }
  if (atr === 0) return 25;
  const pDI = (sp / atr) * 100, mDI = (sm / atr) * 100;
  return pDI + mDI === 0 ? 0 : Math.abs(pDI - mDI) / (pDI + mDI) * 100;
}

export function calcBB(closes: number[], period = 20, mult = 2): { upper: number; middle: number; lower: number; percentB: number } {
  if (closes.length < period) return { upper: 0, middle: 0, lower: 0, percentB: 0.5 };
  const slice = closes.slice(-period);
  const mid = slice.reduce((a, b) => a + b, 0) / period;
  const std = Math.sqrt(slice.reduce((a, v) => a + (v - mid) ** 2, 0) / period);
  const upper = mid + mult * std, lower = mid - mult * std;
  return { upper, middle: mid, lower, percentB: upper === lower ? 0.5 : (closes[closes.length - 1] - lower) / (upper - lower) };
}

// ── VWAP (Volume-Weighted Average Price) ──────────────────────
// Standard VWAP: cumulative(TP * V) / cumulative(V) where TP = (H+L+C)/3
// Resets each session — here we use a rolling 24-candle window
export function calcVWAP(highs: number[], lows: number[], closes: number[], volumes: number[], period = 24): { vwap: number; upper: number; lower: number } {
  const len = Math.min(period, closes.length);
  if (len === 0) return { vwap: 0, upper: 0, lower: 0 };
  let cumTPV = 0, cumV = 0, sumSq = 0;
  for (let i = closes.length - len; i < closes.length; i++) {
    const tp = (highs[i] + lows[i] + closes[i]) / 3;
    cumTPV += tp * volumes[i];
    cumV += volumes[i];
  }
  const vwap = cumV > 0 ? cumTPV / cumV : closes[closes.length - 1];
  // VWAP standard deviation bands
  for (let i = closes.length - len; i < closes.length; i++) {
    const tp = (highs[i] + lows[i] + closes[i]) / 3;
    sumSq += volumes[i] * (tp - vwap) ** 2;
  }
  const std = cumV > 0 ? Math.sqrt(sumSq / cumV) : 0;
  return { vwap, upper: vwap + 2 * std, lower: vwap - 2 * std };
}

// ── ATR (Average True Range) ──────────────────────────────────
// Measures volatility — used for stop placement (1.5x ATR)
export function calcATR(highs: number[], lows: number[], closes: number[], period = 14): number {
  if (closes.length < 2) return 0;
  const trs: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    trs.push(Math.max(highs[i] - lows[i], Math.abs(highs[i] - closes[i - 1]), Math.abs(lows[i] - closes[i - 1])));
  }
  if (trs.length === 0) return 0;
  let atr = trs.slice(0, Math.min(period, trs.length)).reduce((a, b) => a + b, 0) / Math.min(period, trs.length);
  for (let i = period; i < trs.length; i++) {
    atr = (atr * (period - 1) + trs[i]) / period;
  }
  return atr;
}

// ── OBV (On-Balance Volume) ──────────────────────────────────
// Cumulative volume flow — confirms trend or diverges (warning signal)
export function calcOBV(closes: number[], volumes: number[]): { obv: number; obvSma: number; trend: 'rising' | 'falling' | 'flat' } {
  if (closes.length < 2) return { obv: 0, obvSma: 0, trend: 'flat' };
  let obv = 0;
  const obvSeries: number[] = [0];
  for (let i = 1; i < closes.length; i++) {
    if (closes[i] > closes[i - 1]) obv += volumes[i];
    else if (closes[i] < closes[i - 1]) obv -= volumes[i];
    obvSeries.push(obv);
  }
  // SMA of OBV for trend detection
  const smaPeriod = Math.min(20, obvSeries.length);
  const obvSma = obvSeries.slice(-smaPeriod).reduce((a, b) => a + b, 0) / smaPeriod;
  const recent = obvSeries.slice(-5);
  const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
  const older = obvSeries.slice(-20, -5);
  const olderAvg = older.length > 0 ? older.reduce((a, b) => a + b, 0) / older.length : recentAvg;
  const trend = recentAvg > olderAvg * 1.02 ? 'rising' : recentAvg < olderAvg * 0.98 ? 'falling' : 'flat';
  return { obv, obvSma, trend };
}

// ── Williams %R ──────────────────────────────────────────────
// Inverse of Stochastic — overbought/oversold momentum
export function calcWilliamsR(highs: number[], lows: number[], closes: number[], period = 14): number {
  if (closes.length < period) return -50;
  const hh = Math.max(...highs.slice(-period));
  const ll = Math.min(...lows.slice(-period));
  if (hh === ll) return -50;
  return ((hh - closes[closes.length - 1]) / (hh - ll)) * -100;
}

// ── MFI (Money Flow Index) ──────────────────────────────────
// Volume-weighted RSI — confirms trend strength with volume
export function calcMFI(highs: number[], lows: number[], closes: number[], volumes: number[], period = 14): number {
  if (closes.length < period + 1) return 50;
  const tp = closes.map((c, i) => (highs[i] + lows[i] + c) / 3);
  const mf = tp.map((v, i) => v * volumes[i]);
  let posMF = 0, negMF = 0;
  for (let i = closes.length - period; i < closes.length; i++) {
    if (tp[i] > tp[i - 1]) posMF += mf[i];
    else negMF += mf[i];
  }
  if (negMF === 0) return 100;
  const mfr = posMF / negMF;
  return 100 - 100 / (1 + mfr);
}

// ── Stochastic RSI ──────────────────────────────────────────
// More sensitive than regular RSI — catches reversals earlier
export function calcStochRSI(closes: number[], rsiPeriod = 14, stochPeriod = 14): number {
  if (closes.length < rsiPeriod + stochPeriod) return 0.5;
  // Calculate RSI series
  const changes = closes.slice(1).map((c, i) => c - closes[i]);
  const rsiSeries: number[] = [];
  let avgGain = changes.slice(0, rsiPeriod).filter(x => x > 0).reduce((a, b) => a + b, 0) / rsiPeriod;
  let avgLoss = changes.slice(0, rsiPeriod).filter(x => x < 0).reduce((a, b) => a + Math.abs(b), 0) / rsiPeriod;
  rsiSeries.push(avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss));
  for (let i = rsiPeriod; i < changes.length; i++) {
    avgGain = (avgGain * (rsiPeriod - 1) + Math.max(changes[i], 0)) / rsiPeriod;
    avgLoss = (avgLoss * (rsiPeriod - 1) + Math.max(-changes[i], 0)) / rsiPeriod;
    rsiSeries.push(avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss));
  }
  if (rsiSeries.length < stochPeriod) return 0.5;
  const recent = rsiSeries.slice(-stochPeriod);
  const hh = Math.max(...recent), ll = Math.min(...recent);
  return hh === ll ? 0.5 : (rsiSeries[rsiSeries.length - 1] - ll) / (hh - ll);
}
