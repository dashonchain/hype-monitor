'use client';

import { useEffect, useState, useCallback } from 'react';
import PriceChart from '../components/PriceChart';

// ─── Types ───
type Data = {
  price: number;
  price_change: { '24h': string; '7d': string; '30d': string };
  market_cap: number;
  market_cap_rank: number;
  total_volume: number;
  high_24h: number;
  low_24h: number;
  circulating_supply: number;
  total_supply: number;
  ath: number;
  atl?: number;
  // Technicals (calculated locally)
  ema20?: number;
  ema50?: number;
  ema200?: number;
  rsi?: number;
  obv?: number;
  // Derivatives
  open_interest?: { total: number; long: number; short: number; long_pct: number; short_pct: number };
  funding_rate?: number;
  funding_interval_h?: number;
  bid?: number;
  ask?: number;
  spread_bps?: number;
  // Chart data
  ema20History?: [number, number][];
  ema50History?: [number, number][];
  ema200History?: [number, number][];
  rsiHistory?: [number, number][];
  history?: { prices: [number, number][] };
  // Meta
  timeframe?: string;
  last_updated: string;
  source: string;
  fetch_duration_ms?: number;
  errors?: string[];
  cached?: boolean;
  // Computed decision
  decision?: {
    action: string;
    action_display: string;
    score: number;
    summary: string;
    signals: { buy: number; sell: number; neutral: number };
  };
};

// ─── Helpers ───
const fmt = (n: number, d = 2): string => {
  if (!n || isNaN(n)) return '—';
  if (n >= 1e9) return `$${(n / 1e9).toFixed(d)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(d)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(d)}`;
};

const fmtCompact = (n: number): string => {
  if (!n || isNaN(n)) return '—';
  if (Math.abs(n) >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (Math.abs(n) >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (Math.abs(n) >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return n.toFixed(2);
};

const fmtSupply = (n: number): string => {
  if (!n) return '—';
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return n.toFixed(0);
};

const getTimeAgo = (ts: string) => {
  const diff = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
  if (diff < 60) return { text: `${diff}s ago`, stale: false };
  if (diff < 3600) return { text: `${Math.floor(diff / 60)}m ago`, stale: diff > 600 };
  return { text: `${Math.floor(diff / 3600)}h ago`, stale: true };
};

// ─── Compute decision from indicators ───
function computeDecision(data: Data): Data['decision'] {
  let buy = 0, sell = 0, neutral = 0;
  const p = data.price || 0;

  // EMA signals
  if (data.ema20 && data.ema50 && data.ema200) {
    if (p > data.ema20) { buy++; } else { sell++; }
    if (p > data.ema50) { buy++; } else { sell++; }
    if (p > data.ema200) { buy++; } else { sell++; }
    if (data.ema20 > data.ema50) { buy++; } else { sell++; }
    if (data.ema50 > data.ema200) { buy++; } else { sell++; }
  }

  // RSI signals
  if (data.rsi) {
    if (data.rsi < 30) { buy += 2; }
    else if (data.rsi > 70) { sell += 2; }
    else if (data.rsi > 50) { buy++; }
    else { sell++; }
    neutral += 1;
  }

  // OI bias
  if (data.open_interest) {
    if (data.open_interest.long_pct > 55) { buy++; }
    else if (data.open_interest.short_pct > 55) { sell++; }
    else { neutral++; }
  }

  const total = buy + sell + neutral || 1;
  const score = Math.round((buy / total) * 100);

  let action = 'neutral', action_display = 'NEUTRAL', summary = 'Mixed signals';
  if (score >= 70) { action = 'strong_buy'; action_display = 'STRONG BUY'; summary = 'Strong bullish consensus'; }
  else if (score >= 58) { action = 'buy'; action_display = 'BUY'; summary = 'Bullish bias'; }
  else if (score <= 30) { action = 'strong_sell'; action_display = 'STRONG SELL'; summary = 'Strong bearish consensus'; }
  else if (score <= 42) { action = 'sell'; action_display = 'SELL'; summary = 'Bearish bias'; }

  return { action, action_display, score, summary, signals: { buy, sell, neutral } };
}

// ─── Decision color mapping ───
const decisionColors: Record<string, { bg: string; border: string; text: string; glow: string }> = {
  strong_buy:  { bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', text: 'text-emerald-400', glow: 'shadow-emerald-500/5' },
  buy:         { bg: 'bg-emerald-500/5',  border: 'border-emerald-500/20', text: 'text-emerald-400', glow: '' },
  neutral:     { bg: 'bg-amber-500/5',    border: 'border-amber-500/20',   text: 'text-amber-400',   glow: '' },
  sell:        { bg: 'bg-red-500/5',      border: 'border-red-500/20',     text: 'text-red-400',     glow: '' },
  strong_sell: { bg: 'bg-red-500/10',     border: 'border-red-500/30',     text: 'text-red-400',     glow: 'shadow-red-500/5' },
};

const TIMEFRAMES = [
  { key: '1h', label: '1H' },
  { key: '4h', label: '4H' },
  { key: '1d', label: '1D' },
];

// ─── Main Component ───
export default function Home() {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [timeframe, setTimeframe] = useState('1d');
  const [fetchCount, setFetchCount] = useState(0);

  const fetchData = useCallback(async (tf?: string) => {
    try {
      setRefreshing(true);
      const res = await fetch(`/api/hype?timeframe=${tf || timeframe}`, {
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const raw: any = await res.json();
      if (raw.error) throw new Error(raw.error);
      const d: Data = raw;
      // Compute decision locally
      d.decision = computeDecision(d);
      setData(d);
      setFetchCount(c => c + 1);
      setError('');
    } catch (e: any) {
      setError(e.name === 'AbortError' ? 'Timeout — backend not responding' : e.message || 'Unknown error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [timeframe]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => fetchData(), 60000);
    return () => clearInterval(interval);
  }, [timeframe, fetchData]);

  // ─── Loading ───
  if (loading) return (
    <div className="min-h-screen bg-[#09090b] flex flex-col items-center justify-center gap-5">
      <div className="relative">
        <div className="w-12 h-12 rounded-full border-2 border-zinc-800 border-t-cyan-500 animate-spin" />
      </div>
      <div className="text-center">
        <p className="text-zinc-400 text-sm font-medium">Loading HYPE Monitor</p>
        <p className="text-zinc-600 text-xs mt-1">Fetching market data...</p>
      </div>
    </div>
  );

  // ─── Error ───
  if (error && !data) return (
    <div className="min-h-screen bg-[#09090b] flex flex-col items-center justify-center gap-5 p-6">
      <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-3xl">
        ⚠
      </div>
      <div className="text-center">
        <p className="text-red-400 text-lg font-semibold">Connection Error</p>
        <p className="text-zinc-500 text-sm mt-1 max-w-xs">{error}</p>
      </div>
      <button
        onClick={() => fetchData()}
        className="mt-2 px-6 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-300 hover:bg-zinc-700 hover:text-white transition text-sm font-medium"
      >
        Retry
      </button>
    </div>
  );

  if (!data) return null;

  const freshness = data.last_updated ? getTimeAgo(data.last_updated) : null;
  const dc = decisionColors[data.decision?.action || 'neutral'];
  const change24h = parseFloat(data.price_change?.['24h'] || '0');

  // RSI zone
  const rsiZone = data.rsi === null || data.rsi === undefined ? '—' :
    data.rsi > 70 ? 'Overbought' : data.rsi < 30 ? 'Oversold' : data.rsi > 50 ? 'Bullish' : 'Bearish';
  const rsiColor = data.rsi === null || data.rsi === undefined ? 'text-zinc-500' :
    data.rsi > 70 ? 'text-red-400' : data.rsi < 30 ? 'text-emerald-400' : data.rsi > 50 ? 'text-emerald-400/70' : 'text-red-400/70';

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100 antialiased">
      {/* ═══════════ HEADER ═══════════ */}
      <header className="sticky top-0 z-50 bg-[#09090b]/90 backdrop-blur-xl border-b border-zinc-800/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="h-14 flex items-center justify-between">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 text-xs font-black">H</div>
              <span className="text-sm font-semibold tracking-tight">
                <span className="text-zinc-100">HYPE</span>
                <span className="text-zinc-500 font-normal">Monitor</span>
              </span>
              {freshness && (
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${freshness.stale ? 'bg-amber-500/10 text-amber-500' : 'bg-emerald-500/10 text-emerald-500'}`}>
                  {freshness.stale ? '● Stale' : '● Live'}
                </span>
              )}
            </div>

            {/* Price + Refresh */}
            <div className="flex items-center gap-4">
              <div className="text-right hidden sm:block">
                <div className="text-lg font-semibold font-mono tracking-tight">
                  ${data.price?.toFixed(2) || '—'}
                </div>
                <div className={`text-xs font-medium ${change24h >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {change24h >= 0 ? '+' : ''}{change24h.toFixed(2)}% <span className="text-zinc-600">24h</span>
                </div>
              </div>
              <button
                onClick={() => fetchData()}
                disabled={refreshing}
                className="w-8 h-8 rounded-lg bg-zinc-800/80 border border-zinc-700/50 flex items-center justify-center hover:bg-zinc-700 transition disabled:opacity-30"
                title="Refresh"
              >
                <svg className={`w-4 h-4 text-zinc-400 ${refreshing ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-5 space-y-5">

        {/* ═══════════ DECISION BANNER ═══════════ */}
        <div className={`rounded-2xl border ${dc.border} ${dc.bg} p-5 ${dc.glow ? `shadow-lg ${dc.glow}` : ''}`}>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-xl ${dc.bg} border ${dc.border} flex items-center justify-center`}>
                <span className={`text-2xl font-black ${dc.text}`}>
                  {data.decision?.action === 'strong_buy' ? '↑↑' : data.decision?.action === 'buy' ? '↑' : data.decision?.action === 'strong_sell' ? '↓↓' : data.decision?.action === 'sell' ? '↓' : '—'}
                </span>
              </div>
              <div>
                <div className="text-[10px] text-zinc-500 uppercase tracking-widest font-medium">Signal • {data.timeframe || '1D'}</div>
                <div className={`text-2xl font-bold tracking-tight ${dc.text}`}>
                  {data.decision?.action_display || 'NEUTRAL'}
                </div>
                <div className="text-xs text-zinc-500 mt-0.5">{data.decision?.summary}</div>
              </div>
            </div>

            <div className="flex items-center gap-6">
              {/* Score bar */}
              <div className="w-32">
                <div className="flex justify-between text-[10px] text-zinc-500 mb-1">
                  <span>Sell</span>
                  <span className={`font-mono font-bold ${dc.text}`}>{data.decision?.score || 0}%</span>
                  <span>Buy</span>
                </div>
                <div className="w-full bg-zinc-800 rounded-full h-1.5">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${
                      (data.decision?.score || 0) > 60 ? 'bg-emerald-500' :
                      (data.decision?.score || 0) > 40 ? 'bg-amber-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${data.decision?.score || 50}%` }}
                  />
                </div>
              </div>

              {/* Signal counts */}
              <div className="flex items-center gap-4 text-center">
                <div>
                  <div className="text-lg font-bold text-emerald-400">{data.decision?.signals.buy || 0}</div>
                  <div className="text-[9px] text-zinc-600 uppercase tracking-wider">Buy</div>
                </div>
                <div>
                  <div className="text-lg font-bold text-amber-400">{data.decision?.signals.neutral || 0}</div>
                  <div className="text-[9px] text-zinc-600 uppercase tracking-wider">Neut</div>
                </div>
                <div>
                  <div className="text-lg font-bold text-red-400">{data.decision?.signals.sell || 0}</div>
                  <div className="text-[9px] text-zinc-600 uppercase tracking-wider">Sell</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ═══════════ MARKET STATS + DERIVATIVES ═══════════ */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
          {[
            { label: 'Mcap', value: fmt(data.market_cap) },
            { label: 'Rank', value: data.market_cap_rank ? `#${data.market_cap_rank}` : '—' },
            { label: 'Vol 24h', value: fmt(data.total_volume) },
            { label: 'High 24h', value: data.high_24h ? `$${data.high_24h.toFixed(2)}` : '—' },
            { label: 'Low 24h', value: data.low_24h ? `$${data.low_24h.toFixed(2)}` : '—' },
            { label: 'ATH', value: data.ath ? `$${data.ath.toFixed(2)}` : '—' },
            { label: 'Supply', value: fmtSupply(data.circulating_supply) },
            { label: 'RSI', value: data.rsi ? data.rsi.toFixed(1) : '—', highlight: true, color: rsiColor },
          ].map(s => (
            <div key={s.label} className={`rounded-xl px-3 py-2.5 border ${s.highlight ? 'bg-zinc-800/30 border-zinc-700/50' : 'bg-zinc-900/50 border-zinc-800/40'}`}>
              <div className="text-[9px] text-zinc-600 uppercase tracking-wider font-medium">{s.label}</div>
              <div className={`text-sm font-semibold mt-0.5 font-mono ${s.color || 'text-zinc-200'}`}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* ═══════════ DERIVATIVES STRIP ═══════════ */}
        {(data.bid || data.open_interest || data.funding_rate !== undefined) && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {data.bid && data.ask && (
              <div className="col-span-2 rounded-xl bg-zinc-900/50 border border-zinc-800/40 px-4 py-3">
                <div className="flex items-baseline justify-between">
                  <div>
                    <div className="text-[9px] text-zinc-600 uppercase tracking-wider font-medium">Bid / Ask</div>
                    <div className="text-base font-semibold font-mono mt-0.5">
                      <span className="text-emerald-400">${data.bid.toFixed(2)}</span>
                      <span className="text-zinc-600 mx-1.5">/</span>
                      <span className="text-red-400">${data.ask.toFixed(2)}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[9px] text-zinc-600">Spread</div>
                    <div className="text-xs font-mono text-zinc-400">{data.spread_bps?.toFixed(1)} bps</div>
                  </div>
                </div>
              </div>
            )}
            {data.open_interest && (
              <div className="rounded-xl bg-zinc-900/50 border border-zinc-800/40 px-4 py-3">
                <div className="text-[9px] text-zinc-600 uppercase tracking-wider font-medium">Open Interest</div>
                <div className="text-base font-semibold mt-0.5">{fmt(data.open_interest.total)}</div>
                <div className="flex gap-3 mt-1">
                  <span className="text-[10px] text-emerald-400">L {data.open_interest.long_pct.toFixed(1)}%</span>
                  <span className="text-[10px] text-red-400">S {data.open_interest.short_pct.toFixed(1)}%</span>
                </div>
              </div>
            )}
            {data.funding_rate !== undefined && (
              <div className="rounded-xl bg-zinc-900/50 border border-zinc-800/40 px-4 py-3">
                <div className="text-[9px] text-zinc-600 uppercase tracking-wider font-medium">Funding Rate</div>
                <div className={`text-base font-semibold mt-0.5 ${data.funding_rate > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {(data.funding_rate * 100).toFixed(4)}%
                </div>
                <div className="text-[10px] text-zinc-500 mt-1">Every {data.funding_interval_h || 8}h</div>
              </div>
            )}
          </div>
        )}

        {/* ═══════════ TIMEFRAME ═══════════ */}
        <div className="flex items-center gap-1.5">
          {TIMEFRAMES.map(tf => (
            <button
              key={tf.key}
              onClick={() => { setTimeframe(tf.key); fetchData(tf.key); }}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                timeframe === tf.key
                  ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 shadow-sm shadow-cyan-500/10'
                  : 'bg-zinc-800/40 text-zinc-500 border border-zinc-800/40 hover:bg-zinc-800/60 hover:text-zinc-400'
              }`}
            >
              {tf.label}
            </button>
          ))}
          <div className="flex-1" />
          {data.rsi !== undefined && (
            <div className="flex items-center gap-2 text-[10px]">
              <span className="text-zinc-600">RSI(14):</span>
              <span className={`font-mono font-semibold ${rsiColor}`}>{data.rsi.toFixed(1)}</span>
              <span className="text-zinc-600">({rsiZone})</span>
            </div>
          )}
        </div>

        {/* ═══════════ MAIN GRID ═══════════ */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

          {/* ─── Left: Chart + Key Levels ─── */}
          <div className="lg:col-span-2 space-y-4">

            {/* Price Chart */}
            {data.history?.prices && data.ema20History && (
              <PriceChart
                prices={data.history.prices}
                ema20History={data.ema20History}
                ema50History={data.ema50History || []}
                ema200History={data.ema200History || []}
                rsiHistory={data.rsiHistory || []}
              />
            )}

            {/* Key Levels Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { label: 'EMA 20', value: data.ema20, color: 'text-pink-400' },
                { label: 'EMA 50', value: data.ema50, color: 'text-blue-400' },
                { label: 'EMA 200', value: data.ema200, color: 'text-yellow-400' },
                { label: 'RSI', value: data.rsi, color: rsiColor },
              ].map(level => (
                <div key={level.label} className="rounded-xl bg-zinc-900/50 border border-zinc-800/40 px-4 py-3">
                  <div className="text-[9px] text-zinc-600 uppercase tracking-wider font-medium">{level.label}</div>
                  <div className={`text-base font-bold font-mono mt-1 ${level.color}`}>
                    {level.value ? (level.label === 'RSI' ? level.value.toFixed(1) : `$${level.value.toFixed(2)}`) : '—'}
                  </div>
                  {level.value && level.label !== 'RSI' && data.price && (
                    <div className={`text-[10px] mt-0.5 ${data.price > level.value ? 'text-emerald-500/70' : 'text-red-500/70'}`}>
                      {data.price > level.value ? 'Above' : 'Below'}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Price Change Row */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: '24h', val: data.price_change?.['24h'] },
                { label: '7d', val: data.price_change?.['7d'] },
                { label: '30d', val: data.price_change?.['30d'] },
              ].map(pc => {
                const v = parseFloat(pc.val || '0');
                return (
                  <div key={pc.label} className="rounded-xl bg-zinc-900/50 border border-zinc-800/40 px-4 py-3">
                    <div className="text-[9px] text-zinc-600 uppercase tracking-wider font-medium">{pc.label} Change</div>
                    <div className={`text-base font-bold font-mono mt-1 ${v >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {v >= 0 ? '+' : ''}{pc.val}%
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ─── Right: Sidebar ─── */}
          <aside className="space-y-4">

            {/* Quick Stats */}
            <div className="rounded-2xl bg-zinc-900/50 border border-zinc-800/40 overflow-hidden">
              <div className="px-4 py-3 border-b border-zinc-800/40">
                <h3 className="text-xs font-semibold text-zinc-300">Market Overview</h3>
              </div>
              <div className="p-4 space-y-3">
                {[
                  { label: 'Market Cap', value: fmt(data.market_cap) },
                  { label: 'Volume 24h', value: fmt(data.total_volume) },
                  { label: 'Vol/Mcap', value: data.market_cap > 0 ? `${((data.total_volume / data.market_cap) * 100).toFixed(2)}%` : '—' },
                  { label: 'High 24h', value: data.high_24h ? `$${data.high_24h.toFixed(2)}` : '—' },
                  { label: 'Low 24h', value: data.low_24h ? `$${data.low_24h.toFixed(2)}` : '—' },
                  { label: 'ATH', value: data.ath ? `$${data.ath.toFixed(2)}` : '—' },
                  { label: 'ATH Distance', value: data.ath && data.price ? `${((data.price / data.ath - 1) * 100).toFixed(1)}%` : '—' },
                  { label: 'Supply', value: fmtSupply(data.circulating_supply) },
                  { label: 'Max Supply', value: data.total_supply ? fmtSupply(data.total_supply) : '—' },
                ].map(row => (
                  <div key={row.label} className="flex justify-between items-center">
                    <span className="text-xs text-zinc-500">{row.label}</span>
                    <span className="text-xs font-mono font-medium text-zinc-300">{row.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* RSI Gauge */}
            {data.rsi !== undefined && data.rsi !== null && (
              <div className="rounded-2xl bg-zinc-900/50 border border-zinc-800/40 p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-semibold text-zinc-300">RSI (14)</h3>
                  <span className={`text-lg font-bold font-mono ${rsiColor}`}>{data.rsi.toFixed(1)}</span>
                </div>
                {/* RSI bar */}
                <div className="relative h-2 rounded-full bg-zinc-800 overflow-hidden">
                  <div className="absolute inset-0 rounded-full" style={{
                    background: 'linear-gradient(to right, #22c55e 0%, #22c55e 30%, #eab308 30%, #eab308 50%, #eab308 50%, #eab308 70%, #ef4444 70%, #ef4444 100%)',
                    opacity: 0.4
                  }} />
                  <div
                    className="absolute top-0 h-full w-1 rounded-full bg-white shadow-sm transition-all duration-500"
                    style={{ left: `${Math.min(100, Math.max(0, data.rsi))}%` }}
                  />
                </div>
                <div className="flex justify-between text-[9px] text-zinc-600 mt-1">
                  <span>Oversold (30)</span>
                  <span>Neutral (50)</span>
                  <span>Overbought (70)</span>
                </div>
              </div>
            )}

            {/* Error / Warning */}
            {data.errors && data.errors.length > 0 && (
              <div className="rounded-2xl bg-amber-500/5 border border-amber-500/20 p-4">
                <div className="flex items-start gap-2">
                  <span className="text-amber-500 text-sm">⚠</span>
                  <div className="space-y-1">
                    {data.errors.map((e, i) => (
                      <p key={i} className="text-xs text-amber-400/80">{e}</p>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="text-[10px] text-zinc-700 space-y-0.5">
              <div>Source: {data.source}</div>
              <div>Updated: {new Date(data.last_updated).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</div>
              <div>Latency: {data.fetch_duration_ms}ms {data.cached ? '(cached)' : ''}</div>
            </div>
          </aside>
        </div>
      </main>

      {/* ═══════════ FOOTER ═══════════ */}
      <footer className="border-t border-zinc-800/30 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between text-[10px] text-zinc-700">
          <span>HYPE Monitor • Hyperliquid</span>
          <span>{fetchCount} updates</span>
        </div>
      </footer>
    </div>
  );
}
