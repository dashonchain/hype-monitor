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
