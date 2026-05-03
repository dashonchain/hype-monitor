'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import PriceChart from '../components/PriceChart';
import IndicatorTutorial from '../components/IndicatorTutorial';

// ─── Types ───
type Candle = { time: number; open: number; high: number; low: number; close: number; volume: number };

type Data = {
  price: number;
  price_change: { '24h': string; '7d': string; '30d': string };
  high_24h: number; low_24h: number;
  market_cap: number; market_cap_rank: number; total_volume: number;
  circulating_supply: number; total_supply: number; ath: number;
  sma10: number | null; sma20: number | null; sma50: number | null; rsi: number | null;
  candles: Candle[];
  sma10History: [number, number][]; sma20History: [number, number][]; sma50History: [number, number][];
  rsiHistory: [number, number][]; prices: [number, number][];
  open_interest: { usd: number; tokens: number } | null;
  funding_rate: number; funding_8h_pct: number; funding_annual_pct: number;
  timeframe: string; last_updated: string; source: string;
  fetch_duration_ms: number; errors: string[]; cached: boolean;
  decision?: {
    action: string; action_display: string; score: number;
    summary: string; signals: { buy: number; sell: number; neutral: number };
  };
};

// ─── Helpers ───
const fmt = (n: number, d = 2): string => {
  if (!n || isNaN(n)) return '—';
  if (Math.abs(n) >= 1e9) return `${n < 0 ? '-' : ''}$${(Math.abs(n) / 1e9).toFixed(d)}B`;
  if (Math.abs(n) >= 1e6) return `${n < 0 ? '-' : ''}$${(Math.abs(n) / 1e6).toFixed(d)}M`;
  if (Math.abs(n) >= 1e3) return `${n < 0 ? '-' : ''}$${(Math.abs(n) / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(d)}`;
};

const fmtSupply = (n: number): string => {
  if (!n) return '—';
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  return `${(n / 1e3).toFixed(1)}K`;
};

const timeAgo = (ts: string) => {
  const s = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  return `${Math.floor(s / 3600)}h`;
};

const isStale = (ts: string) => (Date.now() - new Date(ts).getTime()) > 120_000;

// ─── Signal computation ───
function computeSignal(d: Data) {
  let buy = 0, sell = 0, neutral = 0;
  const p = d.price || 0;

  if (d.sma10 && d.sma20 && d.sma50) {
    if (p > d.sma10) buy++; else sell++;
    if (p > d.sma20) buy++; else sell++;
    if (p > d.sma50) buy++; else sell++;
    if (d.sma10 > d.sma20) buy++; else sell++;
    if (d.sma20 > d.sma50) buy++; else sell++;
  }
  if (d.rsi != null) {
    if (d.rsi < 30) buy += 2;
    else if (d.rsi > 70) sell += 2;
    else if (d.rsi > 50) buy++;
    else sell++;
    neutral++;
  }
  if (d.open_interest) {
    // OI > $15M is high for HYPE
    if (d.open_interest.usd > 15e6) neutral++; // high OI = caution
  }

  const total = buy + sell + neutral || 1;
  const score = Math.round((buy / total) * 100);
  let action = 'neutral', display = 'NEUTRAL', summary = 'Mixed signals';
  if (score >= 70) { action = 'strong_buy'; display = 'STRONG BUY'; summary = 'Strong bullish consensus'; }
  else if (score >= 58) { action = 'buy'; display = 'BUY'; summary = 'Bullish bias'; }
  else if (score <= 30) { action = 'strong_sell'; display = 'STRONG SELL'; summary = 'Strong bearish consensus'; }
  else if (score <= 42) { action = 'sell'; display = 'SELL'; summary = 'Bearish bias'; }

  // Disable signal if stale
  if (isStale(d.last_updated)) {
    action = 'neutral';
    display = 'STALE';
    summary = 'Data is stale — signal disabled';
  }

  return { action, action_display: display, score, summary, signals: { buy, sell, neutral } };
}

const COLORS: Record<string, { bg: string; border: string; text: string }> = {
  strong_buy:  { bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', text: 'text-emerald-400' },
  buy:         { bg: 'bg-emerald-500/5',  border: 'border-emerald-500/20', text: 'text-emerald-400' },
  neutral:     { bg: 'bg-zinc-500/5',     border: 'border-zinc-500/20',    text: 'text-zinc-400' },
  sell:        { bg: 'bg-red-500/5',      border: 'border-red-500/20',     text: 'text-red-400' },
  strong_sell: { bg: 'bg-red-500/10',     border: 'border-red-500/30',     text: 'text-red-400' },
};

const TFS = [
  { key: '1h', label: '1H', minutes: 60 },
  { key: '4h', label: '4H', minutes: 240 },
  { key: '1d', label: '1D', minutes: 1440 },
];

// ─── Stat Card ───
function Stat({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="bg-zinc-900/60 border border-zinc-800/50 rounded-xl px-3 py-2.5">
      <div className="text-[9px] text-zinc-600 uppercase tracking-wider font-medium">{label}</div>
      <div className={`text-sm font-semibold mt-0.5 font-mono ${color || 'text-zinc-200'}`}>{value}</div>
      {sub && <div className="text-[9px] text-zinc-600 mt-0.5">{sub}</div>}
    </div>
  );
}

// ─── Main ───
export default function Home() {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tf, setTf] = useState('1d');
  const [fetchCount, setFetchCount] = useState(0);
  const [tfLoading, setTfLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const fetchData = useCallback(async (timeframe?: string, silent = false) => {
    // Cancel previous request
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    try {
      if (!silent) setTfLoading(true);
      const res = await fetch(`/api/hype?timeframe=${timeframe || tf}`, {
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const raw: any = await res.json();
      if (raw.error) throw new Error(raw.error);
      const d: Data = raw;
      d.decision = computeSignal(d);
      setData(d);
      setFetchCount(c => c + 1);
      setError('');
    } catch (e: any) {
      if (e.name !== 'AbortError') {
        setError(e.name === 'TimeoutError' ? 'Timeout' : e.message || 'Error');
      }
    } finally {
      setLoading(false);
      setTfLoading(false);
    }
  }, [tf]);

  useEffect(() => {
    fetchData();
    const i = setInterval(() => fetchData(undefined, true), 60000);
    return () => { clearInterval(i); abortRef.current?.abort(); };
  }, [fetchData]);

  const changeTimeframe = (t: string) => {
    setTf(t);
    fetchData(t);
  };

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

  const dc = COLORS[data.decision?.action || 'neutral'];
  const ch24 = parseFloat(data.price_change?.['24h'] || '0');
  const rsiOk = data.rsi != null;
  const rsiZone = !rsiOk ? '' : data.rsi! > 70 ? 'Overbought' : data.rsi! < 30 ? 'Oversold' : data.rsi! > 50 ? 'Bullish' : 'Bearish';
  const rsiCol = !rsiOk ? 'text-zinc-500' : data.rsi! > 70 ? 'text-red-400' : data.rsi! < 30 ? 'text-emerald-400' : data.rsi! > 50 ? 'text-emerald-400/70' : 'text-red-400/70';
  const stale = isStale(data.last_updated);

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100 antialiased">

      {/* ═══ HEADER ═══ */}
      <header className="sticky top-0 z-50 bg-[#09090b]/95 backdrop-blur-xl border-b border-zinc-800/40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-12 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-md bg-cyan-500/15 border border-cyan-500/25 flex items-center justify-center text-cyan-400 text-[10px] font-black leading-none">H</div>
            <span className="text-sm font-semibold"><span className="text-white">HYPE</span><span className="text-zinc-500 font-normal">Monitor</span></span>
            <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${stale ? 'bg-red-500/10 text-red-500' : data.cached ? 'bg-zinc-800 text-zinc-500' : 'bg-emerald-500/10 text-emerald-500'}`}>
              {stale ? `⚠ Stale ${timeAgo(data.last_updated)}` : data.cached ? `Cached ${timeAgo(data.last_updated)}` : '● Live'}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-base font-semibold font-mono leading-tight">${data.price?.toFixed(2) || '—'}</div>
              <div className={`text-[10px] font-medium leading-tight ${ch24 >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {ch24 >= 0 ? '+' : ''}{ch24.toFixed(2)}% <span className="text-zinc-600">24h</span>
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
        <div className={`rounded-xl border ${dc.border} ${dc.bg} p-4 ${stale ? 'opacity-60' : ''}`}>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg ${dc.bg} border ${dc.border} flex items-center justify-center text-xl font-black ${dc.text}`}>
                {data.decision?.action === 'strong_buy' ? '↑↑' : data.decision?.action === 'buy' ? '↑' : data.decision?.action === 'strong_sell' ? '↓↓' : data.decision?.action === 'sell' ? '↓' : '—'}
              </div>
              <div>
                <div className="text-[9px] text-zinc-600 uppercase tracking-widest font-medium">Signal · {data.timeframe || '1D'} · {data.source}</div>
                <div className={`text-xl font-bold tracking-tight ${dc.text}`}>{data.decision?.action_display || 'NEUTRAL'}</div>
                <div className="text-[10px] text-zinc-500">{data.decision?.summary}</div>
              </div>
            </div>
            <div className="flex items-center gap-5">
              <div className="w-28">
                <div className="flex justify-between text-[9px] text-zinc-600 mb-0.5">
                  <span>Sell</span>
                  <span className={`font-mono font-bold ${dc.text}`}>{data.decision?.score || 0}%</span>
                  <span>Buy</span>
                </div>
                <div className="w-full bg-zinc-800 rounded-full h-1">
                  <div className={`h-full rounded-full transition-all duration-500 ${(data.decision?.score || 0) > 60 ? 'bg-emerald-500' : (data.decision?.score || 0) > 40 ? 'bg-amber-500' : 'bg-red-500'}`}
                    style={{ width: `${data.decision?.score || 50}%` }} />
                </div>
              </div>
              <div className="flex gap-3 text-center">
                <div><div className="text-base font-bold text-emerald-400">{data.decision?.signals.buy || 0}</div><div className="text-[8px] text-zinc-600 uppercase">Buy</div></div>
                <div><div className="text-base font-bold text-zinc-400">{data.decision?.signals.neutral || 0}</div><div className="text-[8px] text-zinc-600 uppercase">Neut</div></div>
                <div><div className="text-base font-bold text-red-400">{data.decision?.signals.sell || 0}</div><div className="text-[8px] text-zinc-600 uppercase">Sell</div></div>
              </div>
            </div>
          </div>
        </div>

        {/* ═══ STATS ROW ═══ */}
        <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5">
          <Stat label="Mcap" value={data.market_cap > 0 ? fmt(data.market_cap) : '—'} />
          <Stat label="Rank" value={data.market_cap_rank ? `#${data.market_cap_rank}` : '—'} />
          <Stat label="Vol 24h" value={fmt(data.total_volume)} />
          <Stat label="High 24h" value={data.high_24h ? `$${data.high_24h.toFixed(2)}` : '—'} />
          <Stat label="Low 24h" value={data.low_24h ? `$${data.low_24h.toFixed(2)}` : '—'} />
          <Stat label="ATH" value={data.ath ? `$${data.ath.toFixed(2)}` : '—'} sub={data.ath && data.price ? `${((data.price / data.ath - 1) * 100).toFixed(1)}%` : undefined} />
          <Stat label="Supply" value={fmtSupply(data.circulating_supply)} />
          <Stat label="RSI(14)" value={data.rsi?.toFixed(1) || '—'} color={rsiCol} sub={`${rsiZone} · ${data.timeframe || '1D'}`} />
        </div>

        {/* ═══ DERIVATIVES ROW ═══ */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
          {data.open_interest && (
            <div className="bg-zinc-900/60 border border-zinc-800/50 rounded-xl px-3 py-2.5">
              <div className="text-[9px] text-zinc-600 uppercase tracking-wider font-medium">Open Interest</div>
              <div className="text-sm font-semibold mt-0.5 font-mono text-zinc-200">{fmt(data.open_interest.usd)}</div>
              <div className="text-[9px] text-zinc-600 mt-0.5">{fmt(data.open_interest.tokens)} HYPE</div>
            </div>
          )}
          {data.funding_rate != null && (
            <div className="bg-zinc-900/60 border border-zinc-800/50 rounded-xl px-3 py-2.5">
              <div className="text-[9px] text-zinc-600 uppercase tracking-wider font-medium">Funding (8h)</div>
              <div className={`text-sm font-semibold mt-0.5 font-mono ${data.funding_rate > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {data.funding_8h_pct > 0 ? '+' : ''}{data.funding_8h_pct.toFixed(4)}%
              </div>
              <div className="text-[9px] text-zinc-600 mt-0.5">
                {data.funding_rate > 0 ? 'Longs pay shorts' : 'Shorts pay longs'} · Ann. {data.funding_annual_pct.toFixed(1)}%
              </div>
            </div>
          )}
          <div className="bg-zinc-900/60 border border-zinc-800/50 rounded-xl px-3 py-2.5">
            <div className="text-[9px] text-zinc-600 uppercase tracking-wider font-medium">SMA 10</div>
            <div className="text-sm font-semibold mt-0.5 font-mono text-pink-300">{data.sma10 ? `$${data.sma10.toFixed(2)}` : '—'}</div>
            {data.sma10 && data.price && (
              <div className={`text-[9px] mt-0.5 ${data.price > data.sma10 ? 'text-emerald-500/60' : 'text-red-500/60'}`}>
                {data.price > data.sma10 ? '▲ Above' : '▼ Below'}
              </div>
            )}
          </div>
          <div className="bg-zinc-900/60 border border-zinc-800/50 rounded-xl px-3 py-2.5">
            <div className="text-[9px] text-zinc-600 uppercase tracking-wider font-medium">SMA 50</div>
            <div className="text-sm font-semibold mt-0.5 font-mono text-blue-400">{data.sma50 ? `$${data.sma50.toFixed(2)}` : '—'}</div>
            {data.sma50 && data.price && (
              <div className={`text-[9px] mt-0.5 ${data.price > data.sma50 ? 'text-emerald-500/60' : 'text-red-500/60'}`}>
                {data.price > data.sma50 ? '▲ Above' : '▼ Below'}
              </div>
            )}
          </div>
        </div>

        {/* ═══ TIMEFRAMES ═══ */}
        <div className="flex items-center gap-1">
          {TFS.map(t => (
            <button key={t.key} onClick={() => changeTimeframe(t.key)}
              className={`relative px-5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                tf === t.key
                  ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/25'
                  : 'bg-zinc-900/40 text-zinc-500 border border-zinc-800/30 hover:text-zinc-300 hover:border-zinc-700/50'
              }`}>
              {t.label}
              {tfLoading && tf === t.key && <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-cyan-500 rounded-full animate-pulse" />}
            </button>
          ))}
          <div className="flex-1" />
          {data.errors && data.errors.length > 0 && (
            <span className="text-[9px] text-amber-500/70">⚠ {data.errors[0]}</span>
          )}
        </div>

        {/* ═══ MAIN GRID ═══ */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* ─── Left ─── */}
          <div className="lg:col-span-2 space-y-4">

            {/* Chart — key={tf} forces remount on timeframe change */}
            {data.candles?.length > 0 && (
              <PriceChart
                key={tf}
                candles={data.candles}
                sma10History={data.sma10History || []}
                sma20History={data.sma20History || []}
                sma50History={data.sma50History || []}
                rsiHistory={data.rsiHistory || []}
              />
            )}

            {/* Price Changes */}
            <div className="grid grid-cols-3 gap-1.5">
              {(['24h', '7d', '30d'] as const).map(k => {
                const v = parseFloat(data.price_change?.[k] || '0');
                return (
                  <div key={k} className="bg-zinc-900/60 border border-zinc-800/50 rounded-xl px-3 py-2.5">
                    <div className="text-[9px] text-zinc-600 uppercase tracking-wider font-medium">{k}</div>
                    <div className={`text-sm font-bold font-mono mt-0.5 ${v >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {v >= 0 ? '+' : ''}{data.price_change?.[k]}%
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ─── Right Sidebar ─── */}
          <aside className="space-y-3">

            {/* Market Overview */}
            <div className="bg-zinc-900/60 border border-zinc-800/50 rounded-xl overflow-hidden">
              <div className="px-3 py-2 border-b border-zinc-800/40"><h3 className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Market Overview</h3></div>
              <div className="p-3 space-y-2">
                {[
                  ['Volume 24h', fmt(data.total_volume)],
                  ['High 24h', data.high_24h ? `$${data.high_24h.toFixed(2)}` : '—'],
                  ['Low 24h', data.low_24h ? `$${data.low_24h.toFixed(2)}` : '—'],
                  ['ATH', data.ath ? `$${data.ath.toFixed(2)}` : '—'],
                  ['ATH Dist', data.ath && data.price ? `${((data.price / data.ath - 1) * 100).toFixed(1)}%` : '—'],
                  ['Supply', fmtSupply(data.circulating_supply)],
                  ['Max Supply', data.total_supply ? fmtSupply(data.total_supply) : '—'],
                ].map(([l, v]) => (
                  <div key={l} className="flex justify-between items-center">
                    <span className="text-[10px] text-zinc-600">{l}</span>
                    <span className="text-[10px] font-mono font-medium text-zinc-400">{v}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* RSI Gauge */}
            {rsiOk && (
              <div className="bg-zinc-900/60 border border-zinc-800/50 rounded-xl p-3">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">RSI (14) · {data.timeframe || '1D'}</h3>
                  <span className={`text-sm font-bold font-mono ${rsiCol}`}>{data.rsi!.toFixed(1)}</span>
                </div>
                <div className="relative h-1.5 rounded-full overflow-hidden" style={{ background: 'linear-gradient(to right, #22c55e 0%, #22c55e 30%, #eab308 30%, #eab308 70%, #ef4444 70%, #ef4444 100%)' }}>
                  <div className="absolute top-0 h-full w-0.5 bg-white rounded-full shadow-sm transition-all duration-500" style={{ left: `${Math.min(100, Math.max(0, data.rsi!))}%` }} />
                </div>
                <div className="flex justify-between text-[8px] text-zinc-700 mt-1">
                  <span>Oversold (30)</span><span>Neutral (50)</span><span>Overbought (70)</span>
                </div>
              </div>
            )}

            {/* Derivatives */}
            {(data.open_interest || data.funding_rate != null) && (
              <div className="bg-zinc-900/60 border border-zinc-800/50 rounded-xl overflow-hidden">
                <div className="px-3 py-2 border-b border-zinc-800/40"><h3 className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Derivatives</h3></div>
                <div className="p-3 space-y-2">
                  {data.open_interest && (
                    <>
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] text-zinc-600">Open Interest</span>
                        <span className="text-[10px] font-mono text-zinc-300">{fmt(data.open_interest.usd)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] text-zinc-600">OI (tokens)</span>
                        <span className="text-[10px] font-mono text-zinc-400">{fmt(data.open_interest.tokens)} HYPE</span>
                      </div>
                    </>
                  )}
                  {data.funding_rate != null && (
                    <>
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] text-zinc-600">Funding (8h)</span>
                        <span className={`text-[10px] font-mono ${data.funding_rate > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {data.funding_8h_pct > 0 ? '+' : ''}{data.funding_8h_pct.toFixed(4)}%
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] text-zinc-600">Annualized</span>
                        <span className="text-[10px] font-mono text-zinc-400">{data.funding_annual_pct.toFixed(1)}%</span>
                      </div>
                      <div className={`text-[9px] px-2 py-1 rounded ${data.funding_rate > 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                        {data.funding_rate > 0 ? '↑ Longs pay shorts' : '↓ Shorts pay longs'}
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="text-[9px] text-zinc-800 space-y-0.5 pt-2">
              <div>{data.source} · {data.fetch_duration_ms}ms {data.cached ? '(cached)' : ''}</div>
              <div>Updated {new Date(data.last_updated).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })} · {fetchCount} fetches</div>
            </div>
          </aside>
        </div>
      </main>

      {/* Indicator Tutorial */}
      <IndicatorTutorial />
    </div>
  );
}
