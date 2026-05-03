'use client';

import { useEffect, useState, useCallback } from 'react';
import PriceChart from '../components/PriceChart';

// ─── Types ───
type Indicator = { name: string; value: number; action: string; detail: string };
type Category = { title: string; items: Indicator[]; color: string };
type Decision = { action: string; buy_signals: number; sell_signals: number; neutral_signals: number; buy_ratio: number; sell_ratio: number; summary: string; action_display?: string; score_percent?: number };
type SRChannel = { hi: number; lo: number; strength: number };

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
  atl: number;
  indicators: { trend: Indicator[]; momentum: Indicator[]; volatility: Indicator[]; volume_indicators: Indicator[] };
  support_resistance: { channels?: SRChannel[]; current_price?: number };
  overall_decision: Decision;
  signal_score?: number;
  signal_emoji?: string;
  derivatives?: {
    open_interest: { current_oi: number; oi_change_1d: number; oi_change_4h: number; oi_percentile_7d: number; oi_mcap_ratio: number };
    funding_rate: { current_rate_pct: number; annualized_cost_pct: number; funding_percentile_7d: number; change_1d_pct: number };
    liquidations: { short_liq_points: Array<{ price: number; liq_usd: number; distance_pct: number }>; long_liq_points: Array<{ price: number; liq_usd: number; distance_pct: number }>; imbalance_ratio: number; interpretation: string };
  };
  ema20History?: [number, number][];
  ema50History?: [number, number][];
  ema200History?: [number, number][];
  ema20?: number | null;
  ema50?: number | null;
  ema200?: number | null;
  obv?: number | null;
  rsi?: number | null;
  // Variational Omni data
  open_interest?: { total: number; long: number; short: number; long_pct: string; short_pct: string };
  funding_rate?: number;
  funding_interval_h?: number;
  bid?: number;
  ask?: number;
  spread_bps?: number;
  bid_100k?: number;
  ask_100k?: number;
  variational_updated_at?: string;
  platform_volume_24h?: number;
  platform_tvl?: number;
  platform_oi?: number;
  num_markets?: number;
  rsiHistory?: [number, number][];
  rsiDivergence?: { hasDivergence: boolean; type: string | null; description: string | null };
  history?: { prices: [number, number][]; volumes: [number, number][] };
  timeframe?: string;
  last_updated: string;
  source: string;
  fetch_duration_ms?: number;
  errors?: string[];
};

// ─── Helpers ───
const fmt = (n: number, decimals = 2): string => {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(decimals)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(decimals)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(decimals)}`;
};

const fmtCompact = (n: number): string => {
  if (Math.abs(n) >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (Math.abs(n) >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (Math.abs(n) >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return n.toFixed(2);
};

const actionColor: Record<string, string> = {
  buy: 'text-emerald-400', sell: 'text-red-400', neutral: 'text-amber-400',
  strong_buy: 'text-emerald-300', strong_sell: 'text-red-300',
};
const actionBg: Record<string, string> = {
  buy: 'bg-emerald-950/60 border-emerald-800', sell: 'bg-red-950/60 border-red-800', neutral: 'bg-amber-950/60 border-amber-800',
};

const getTimeAgo = (ts: string) => {
  const diff = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
  if (diff < 60) return { text: `${diff}s`, isStale: false };
  if (diff < 3600) return { text: `${Math.floor(diff / 60)}m`, isStale: diff > 300 };
  return { text: `${Math.floor(diff / 3600)}h`, isStale: true };
};

const TIMEFRAMES = ['1h', '4h', '1d'];

// ─── Main Component ───
export default function Home() {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [timeframe, setTimeframe] = useState('1d');
  const [fetchCount, setFetchCount] = useState(0);

  const API_URL = 'https://renew-willing-inflation-bangkok.trycloudflare.com';

  const fetchData = useCallback(async (tf?: string) => {
    try {
      setRefreshing(true);
      const res = await fetch(`${API_URL}/api/live-data?timeframe=${tf || timeframe}`, {
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const d = await res.json();
      if (d.error) throw new Error(d.error);
      setData(d);
      setFetchCount(c => c + 1);
      setError('');
    } catch (e: any) {
      setError(e.name === 'AbortError' ? 'Timeout: Backend not responding' : e.message || 'Unknown error');
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

  const changeTimeframe = (tf: string) => { setTimeframe(tf); fetchData(tf); };

  const freshness = data?.last_updated ? getTimeAgo(data.last_updated) : null;
  const isStale = freshness?.isStale || false;

  // ─── Loading State ───
  if (loading) return (
    <div className="min-h-screen bg-[#0a0e17] text-gray-100 flex flex-col items-center justify-center gap-4">
      <div className="w-10 h-10 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
      <p className="text-gray-400 text-sm">Loading HYPE Monitor...</p>
    </div>
  );

  // ─── Error State ───
  if (error && !data) return (
    <div className="min-h-screen bg-[#0a0e17] flex flex-col items-center justify-center gap-4 p-4">
      <div className="text-4xl">⚠️</div>
      <div className="text-red-400 text-lg font-medium">Connection Error</div>
      <div className="text-gray-500 text-sm">{error}</div>
      <button onClick={() => fetchData()} className="mt-2 px-5 py-2 bg-red-900/40 border border-red-800 rounded-lg text-red-300 hover:bg-red-900/60 transition text-sm">
        Retry
      </button>
    </div>
  );

  if (!data) return null;

  const categories: Category[] = [
    { title: '📈 Trend', items: data.indicators?.trend || [], color: 'from-slate-900/80 to-slate-800/40' },
    { title: '⚡ Momentum', items: data.indicators?.momentum || [], color: 'from-slate-900/80 to-slate-800/40' },
    { title: '📉 Volatility', items: data.indicators?.volatility || [], color: 'from-slate-900/80 to-slate-800/40' },
    { title: '📊 Volume', items: data.indicators?.volume_indicators || [], color: 'from-slate-900/80 to-slate-800/40' },
  ];

  const priceChange24h = parseFloat(data.price_change?.['24h'] || '0');

  return (
    <div className="min-h-screen bg-[#0a0e17] text-gray-100">
      {/* ─── Header ─── */}
      <header className="border-b border-slate-800/60 bg-[#0d1220]/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold tracking-tight">
                <span className="text-cyan-400">HYPE</span>
                <span className="text-gray-400 font-normal ml-1">Monitor</span>
              </h1>
              {freshness && (
                <span className={`text-xs px-2 py-0.5 rounded-full ${isStale ? 'bg-red-900/40 text-red-400' : 'bg-emerald-900/40 text-emerald-400'}`}>
                  {isStale ? '⚠ Stale' : `● ${freshness.text}`}
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-0.5">Hyperliquid • TrueNorth AI</p>
          </div>

          <div className="flex items-center gap-6">
            <div className="text-right">
              <div className="text-2xl font-mono font-bold tracking-tight">
                ${data.price?.toFixed(3) || '—'}
              </div>
              <div className="flex items-center gap-2 text-xs mt-0.5">
                <span className={priceChange24h >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                  {priceChange24h >= 0 ? '▲' : '▼'} {Math.abs(priceChange24h).toFixed(2)}%
                </span>
                <span className="text-gray-600">24h</span>
              </div>
            </div>
            <button
              onClick={() => fetchData()}
              disabled={refreshing}
              className="p-2 rounded-lg bg-slate-800/60 border border-slate-700/50 hover:bg-slate-700/60 transition disabled:opacity-40"
              title="Refresh"
            >
              <span className={refreshing ? 'animate-spin inline-block' : ''}>↻</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-4 space-y-4">
        {/* ─── Market Stats Row ─── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2">
          {[
            { label: 'Market Cap', value: fmt(data.market_cap) },
            { label: 'Rank', value: data.market_cap_rank ? `#${data.market_cap_rank}` : '—' },
            { label: 'Volume 24h', value: fmt(data.total_volume) },
            { label: 'High 24h', value: data.high_24h ? `$${data.high_24h.toFixed(3)}` : '—' },
            { label: 'Low 24h', value: data.low_24h ? `$${data.low_24h.toFixed(3)}` : '—' },
            { label: 'ATH', value: data.ath ? `$${data.ath.toFixed(3)}` : '—' },
          ].map(s => (
            <div key={s.label} className="bg-slate-900/50 border border-slate-800/40 rounded-lg px-3 py-2">
              <div className="text-[10px] text-gray-500 uppercase tracking-wider">{s.label}</div>
              <div className="text-sm font-semibold mt-0.5">{s.value}</div>
            </div>
          ))}
        </div>

        {/* ─── Timeframe Selector ─── */}
        <div className="flex gap-1">
          {TIMEFRAMES.map(tf => (
            <button
              key={tf}
              onClick={() => changeTimeframe(tf)}
              className={`px-4 py-1.5 rounded-md text-xs font-medium transition ${
                timeframe === tf
                  ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-900/30'
                  : 'bg-slate-800/50 text-gray-400 hover:bg-slate-700/50 hover:text-gray-300'
              }`}
            >
              {tf}
            </button>
          ))}
        </div>

        {/* ─── RSI Divergence Alert ─── */}
        {data.rsiDivergence?.hasDivergence && (
          <div className={`rounded-lg px-4 py-3 border ${
            data.rsiDivergence.type === 'bearish'
              ? 'bg-red-950/30 border-red-800/50'
              : 'bg-emerald-950/30 border-emerald-800/50'
          }`}>
            <div className="flex items-start gap-3">
              <span className="text-xl">{data.rsiDivergence.type === 'bearish' ? '🔴' : '🟢'}</span>
              <div>
                <div className="font-semibold text-sm">
                  RSI Divergence — {data.rsiDivergence.type === 'bearish' ? 'Bearish' : 'Bullish'}
                </div>
                <div className="text-xs text-gray-400 mt-0.5">{data.rsiDivergence.description}</div>
              </div>
            </div>
          </div>
        )}

        {/* ─── Decision Banner ─── */}
        <div className={`rounded-xl border p-4 ${isStale ? 'opacity-50' : ''} ${actionBg[data.overall_decision?.action?.toLowerCase() || 'neutral']}`}>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex-1">
              <div className="text-xs text-gray-400 mb-1">
                TRUENORTH DECISION ({data.timeframe || '1d'})
                <span className="ml-2 text-gray-600">{new Date(data.last_updated).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              <div className={`text-3xl font-bold tracking-tight ${actionColor[data.overall_decision?.action?.toLowerCase() || 'neutral']}`}>
                {data.overall_decision?.action_display || '🟡 NEUTRAL'}
              </div>

              {/* Signal Score Bar */}
              {data.signal_score !== undefined && (
                <div className="mt-3 max-w-sm">
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>Signal Score</span>
                    <span className="font-mono font-bold text-gray-300">{data.signal_score}%</span>
                  </div>
                  <div className="w-full bg-slate-800 rounded-full h-2">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${
                        data.signal_score > 75 ? 'bg-emerald-500' :
                        data.signal_score > 60 ? 'bg-emerald-400' :
                        data.signal_score > 40 ? 'bg-amber-400' :
                        data.signal_score > 25 ? 'bg-red-400' : 'bg-red-500'
                      }`}
                      style={{ width: `${data.signal_score}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-gray-600 mt-1">
                    <span>🔴 Short</span><span>🟡 Neutral</span><span>🟢 Long</span>
                  </div>
                </div>
              )}

              <p className="text-sm text-gray-400 mt-2 max-w-xl">{data.overall_decision?.summary}</p>
            </div>

            <div className="grid grid-cols-3 gap-6 text-center">
              <div>
                <div className="text-2xl font-bold text-emerald-400">{data.overall_decision?.buy_signals || 0}</div>
                <div className="text-[10px] text-gray-500 uppercase">Buy</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-amber-400">{data.overall_decision?.neutral_signals || 0}</div>
                <div className="text-[10px] text-gray-500 uppercase">Neutral</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-red-400">{data.overall_decision?.sell_signals || 0}</div>
                <div className="text-[10px] text-gray-500 uppercase">Sell</div>
              </div>
            </div>
          </div>
        </div>

        {/* ─── Error Banner ─── */}
        {error && data && (
          <div className="bg-amber-950/30 border border-amber-800/40 rounded-lg px-4 py-2 text-xs text-amber-400">
            ⚠️ {error} — Showing last known data
          </div>
        )}

        {/* ─── Main Grid ─── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Left: Indicators + Chart */}
          <div className="lg:col-span-2 space-y-4">
            {/* Indicator Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {categories.map(cat => (
                <div key={cat.title} className="bg-slate-900/50 border border-slate-800/40 rounded-xl overflow-hidden">
                  <div className="px-4 py-2.5 border-b border-slate-800/40">
                    <h2 className="text-sm font-semibold">{cat.title}</h2>
                  </div>
                  <div className="divide-y divide-slate-800/30">
                    {cat.items.map(ind => (
                      <div key={ind.name} className="px-4 py-2.5 flex justify-between items-center hover:bg-slate-800/20 transition">
                        <div>
                          <div className="text-xs font-mono font-medium">{ind.name}</div>
                          <div className="text-[10px] text-gray-500 mt-0.5">{ind.detail}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs font-mono font-bold">{typeof ind.value === 'number' ? ind.value.toFixed(2) : ind.value}</div>
                          <div className={`text-[10px] font-semibold uppercase ${actionColor[ind.action] || 'text-gray-400'}`}>
                            {ind.action.replace('_', ' ')}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

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

            {/* Derivatives */}
            {(data.derivatives || data.open_interest) && (
              <div className="bg-slate-900/50 border border-slate-800/40 rounded-xl overflow-hidden">
                <div className="px-4 py-2.5 border-b border-slate-800/40 flex items-center justify-between">
                  <h2 className="text-sm font-semibold">📑 Derivatives & Liquidations</h2>
                  {data.variational_updated_at && (
                    <span className="text-[10px] text-gray-500">Live: {new Date(data.variational_updated_at).toLocaleTimeString('en-US', {hour:'2-digit',minute:'2-digit',second:'2-digit'})}</span>
                  )}
                </div>
                <div className="p-4 grid grid-cols-1 md:grid-cols-4 gap-3">

                  {/* Open Interest - Variational */}
                  {data.open_interest && (
                    <div className="bg-slate-800/30 rounded-lg p-3">
                      <div className="text-[10px] text-gray-500 uppercase">Open Interest (Omni)</div>
                      <div className="text-lg font-bold mt-1">{fmt(data.open_interest.total)}</div>
                      <div className="flex gap-2 text-xs mt-1">
                        <span className="text-emerald-400">L: {data.open_interest.long_pct}%</span>
                        <span className="text-red-400">S: {data.open_interest.short_pct}%</span>
                      </div>
                      <div className="text-[10px] text-gray-500 mt-0.5">{fmtCompact(data.open_interest.long)} / {fmtCompact(data.open_interest.short)}</div>
                    </div>
                  )}

                  {/* OI from TrueNorth fallback */}
                  {!data.open_interest && data.derivatives && (
                    <div className="bg-slate-800/30 rounded-lg p-3">
                      <div className="text-[10px] text-gray-500 uppercase">Open Interest (TN)</div>
                      <div className="text-lg font-bold mt-1">{fmt(data.derivatives!.open_interest.current_oi)}</div>
                      <div className="text-xs mt-1">
                        <span className={data.derivatives!.open_interest.oi_change_1d >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                          1d: {data.derivatives!.open_interest.oi_change_1d >= 0 ? '+' : ''}{fmtCompact(data.derivatives!.open_interest.oi_change_1d)}
                        </span>
                        <span className="text-gray-600 ml-1">({data.derivatives!.open_interest.oi_percentile_7d}th)</span>
                      </div>
                    </div>
                  )}

                  {/* Funding Rate */}
                  <div className="bg-slate-800/30 rounded-lg p-3">
                    <div className="text-[10px] text-gray-500 uppercase">Funding Rate</div>
                    <div className="text-lg font-bold mt-1">
                      {data.funding_rate ? `${(data.funding_rate * 100).toFixed(4)}%` : data.derivatives ? `${(data.derivatives!.funding_rate.current_rate_pct * 100).toFixed(3)}%` : '—'}
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      {data.funding_interval_h ? `Every ${data.funding_interval_h}h` : data.derivatives ? `Ann. ${data.derivatives!.funding_rate.annualized_cost_pct.toFixed(2)}%` : ''}
                    </div>
                  </div>

                  {/* Spread */}
                  {data.bid && data.ask && (
                    <div className="bg-slate-800/30 rounded-lg p-3">
                      <div className="text-[10px] text-gray-500 uppercase">Bid / Ask</div>
                      <div className="text-lg font-bold mt-1 font-mono">${data.bid.toFixed(4)} / ${data.ask.toFixed(4)}</div>
                      <div className="text-xs text-gray-400 mt-1">
                        Spread: {data.spread_bps?.toFixed(2)} bps
                      </div>
                    </div>
                  )}

                  {/* Liquidation Imbalance */}
                  {data.derivatives && (
                    <div className="bg-slate-800/30 rounded-lg p-3">
                      <div className="text-[10px] text-gray-500 uppercase">Liq. Imbalance</div>
                      <div className="text-lg font-bold mt-1">
                        {data.derivatives!.liquidations.imbalance_ratio > 0 ? '🟢 Longs' : '🔴 Shorts'} Favored
                      </div>
                      <div className="text-xs text-gray-400 mt-1">
                        Ratio: {data.derivatives!.liquidations.imbalance_ratio.toFixed(3)}
                      </div>
                    </div>
                  )}

                  {/* Short Liq Points */}
                  {data.derivatives!.liquidations.short_liq_points?.length > 0 && (
                    <div className="md:col-span-3 bg-red-950/20 rounded-lg p-3 border border-red-900/30">
                      <div className="text-xs text-red-400 font-medium mb-2">Short Liquidation Levels (Top 3)</div>
                      <div className="grid grid-cols-3 gap-2">
                        {data.derivatives!.liquidations.short_liq_points.map((pt, i) => (
                          <div key={i} className="bg-red-950/30 rounded p-2 border border-red-900/20">
                            <div className="font-mono text-sm">${pt.price.toFixed(2)}</div>
                            <div className="text-[10px] text-gray-400">{fmtCompact(pt.liq_usd)} USD</div>
                            <div className="text-[10px] text-red-400">{pt.distance_pct.toFixed(1)}% away</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Long Liq Points */}
                  {data.derivatives!.liquidations.long_liq_points?.length > 0 && (
                    <div className="md:col-span-3 bg-emerald-950/20 rounded-lg p-3 border border-emerald-900/30">
                      <div className="text-xs text-emerald-400 font-medium mb-2">Long Liquidation Levels (Top 3)</div>
                      <div className="grid grid-cols-3 gap-2">
                        {data.derivatives!.liquidations.long_liq_points.map((pt, i) => (
                          <div key={i} className="bg-emerald-950/30 rounded p-2 border border-emerald-900/20">
                            <div className="font-mono text-sm">${pt.price.toFixed(2)}</div>
                            <div className="text-[10px] text-gray-400">{fmtCompact(pt.liq_usd)} USD</div>
                            <div className="text-[10px] text-emerald-400">{pt.distance_pct.toFixed(1)}% away</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Right: Sidebar */}
          <aside className="space-y-4">
            {/* Support & Resistance */}
            <div className="bg-slate-900/50 border border-slate-800/40 rounded-xl p-4">
              <h3 className="text-sm font-semibold mb-3">🎯 Support & Resistance</h3>
              {(data.support_resistance?.channels?.length || 0) > 0 ? (
                <div className="space-y-2">
                  {data.support_resistance!.channels!.slice(0, 5).map((ch, i) => {
                    const isSupport = ch.hi < (data.price || 0);
                    return (
                      <div key={i} className={`p-2.5 rounded-lg border ${
                        isSupport ? 'border-emerald-800/40 bg-emerald-950/20' : 'border-red-800/40 bg-red-950/20'
                      }`}>
                        <div className="flex justify-between text-xs">
                          <span className={isSupport ? 'text-emerald-400' : 'text-red-400'}>
                            {isSupport ? 'Support' : 'Resistance'}
                          </span>
                          <span className="text-gray-500">{ch.strength}%</span>
                        </div>
                        <div className="font-mono text-xs mt-1">${ch.lo.toFixed(3)} — ${ch.hi.toFixed(3)}</div>
                        <div className="w-full bg-slate-800 h-1 rounded-full mt-1.5">
                          <div className={`h-full rounded-full ${isSupport ? 'bg-emerald-500' : 'bg-red-500'}`} style={{ width: `${ch.strength}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-gray-500">No channel data available</p>
              )}
            </div>

            {/* Key Levels */}
            <div className="bg-slate-900/50 border border-slate-800/40 rounded-xl p-4">
              <h3 className="text-sm font-semibold mb-3">📊 Key Levels</h3>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-500">EMA 20</span>
                  <span className="font-mono">{data.ema20 ? `$${data.ema20.toFixed(3)}` : '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">EMA 50</span>
                  <span className="font-mono">{data.ema50 ? `$${data.ema50.toFixed(3)}` : '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">EMA 200</span>
                  <span className="font-mono">{data.ema200 ? `$${data.ema200.toFixed(3)}` : '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">RSI(14)</span>
                  <span className={`font-mono ${data.rsi ? (data.rsi > 70 ? 'text-red-400' : data.rsi < 30 ? 'text-emerald-400' : 'text-gray-300') : ''}`}>
                    {data.rsi?.toFixed(2) || '—'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">OBV</span>
                  <span className="font-mono">{data.obv ? fmtCompact(data.obv) : '—'}</span>
                </div>
              </div>
            </div>

            {/* Info */}
            <div className="bg-slate-900/50 border border-slate-800/40 rounded-xl p-4 text-[10px] text-gray-600 space-y-1">
              <div>Source: {data.source}</div>
              <div>Latency: {data.fetch_duration_ms}ms</div>
              <div>Fetches: {fetchCount}</div>
              {data.errors && data.errors.length > 0 && (
                <div className="text-amber-500 mt-2">
                  {data.errors.map((e, i) => <div key={i}>⚠ {e}</div>)}
                </div>
              )}
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
