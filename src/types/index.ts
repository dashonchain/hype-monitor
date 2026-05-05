export interface ParsedCandle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface Indicators {
  sma10: number;
  sma20: number;
  sma50: number;
  rsi14: number;
  macd: number;
  macdSignal: number;
  macdHist: number;
  stochK: number;
  stochD: number;
  kdjK: number;
  kdjD: number;
  kdjJ: number;
  cci: number;
  adx: number;
  bbUpper: number;
  bbMiddle: number;
  bbLower: number;
  bbPercentB: number;
  // New pro indicators
  vwap: number;
  vwapUpper: number;
  vwapLower: number;
  atr: number;
  atrStop: number;
  obvTrend: string;
  williamsR: number;
  mfi: number;
  stochRsi: number;
}

export interface SRLevel {
  price: number;
  strength: number;
  type: 'support' | 'resistance';
}

export interface LiqZone {
  priceLow: number;
  priceHigh: number;
  valueUsd: number;
  side: 'long' | 'short';
}

export type SignalAction = 'strong_buy' | 'buy' | 'neutral' | 'sell' | 'strong_sell';

export interface Signal {
  action: SignalAction;
  display: string;
  score: number;
  summary: string;
  buy: number;
  sell: number;
  neutral: number;
}

export interface DominanceData {
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  change7d: number;
  change30d: number;
  marketCap: number;
}

export interface MarketData {
  price: number;
  change24h: number;
  change7d: number;
  change30d: number;
  high24h: number;
  low24h: number;
  marketCap: number;
  volume24h: number;
  oiUsd: number;
  oiTokens: number;
  funding8h: number;
  fundingAnn: number;
  indicators: Indicators;
  srLevels: { supports: SRLevel[]; resistances: SRLevel[] };
  liqZones: LiqZone[];
  lastUpdated: number;
  timeframe: string;
  signal: Signal;
  dominance: DominanceData[];
}

export type Timeframe = '1h' | '4h' | '1d';

export interface TimeframeConfig {
  interval: string;
  tvRes: string;
  days: number;
  label: string;
}

export const TIMEFRAME_CONFIG: Record<Timeframe, TimeframeConfig> = {
  '1h': { interval: '1h',  tvRes: '60',  days: 7,   label: '1H' },
  '4h': { interval: '4h',  tvRes: '240', days: 30,  label: '4H' },
  '1d': { interval: '1d',  tvRes: 'D',   days: 365, label: '1D' },
};

export const SIGNAL_COLORS: Record<SignalAction, { bg: string; border: string; text: string }> = {
  strong_buy:  { bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', text: 'text-emerald-400' },
  buy:         { bg: 'bg-emerald-500/5',  border: 'border-emerald-500/20', text: 'text-emerald-400' },
  neutral:     { bg: 'bg-zinc-500/5',     border: 'border-zinc-500/20',    text: 'text-zinc-400' },
  sell:        { bg: 'bg-red-500/5',      border: 'border-red-500/20',     text: 'text-red-400' },
  strong_sell: { bg: 'bg-red-500/10',     border: 'border-red-500/30',     text: 'text-red-400' },
};

export const SIGNAL_ICONS: Record<SignalAction, string> = {
  strong_buy: '↑↑', buy: '↑', neutral: '—', sell: '↓', strong_sell: '↓↓',
};
