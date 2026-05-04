'use client';

import { useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
import { TokenHYPE, TokenBTC, TokenETH } from '@web3icons/react';
import { useMarketData } from '../hooks/useMarketData';
import TradingViewChart from '../components/chart/TradingViewChart';
import { fmtPct, isStale } from '../lib/format';
import type { Timeframe } from '../types';
import { TIMEFRAME_CONFIG } from '../types';

const TFS: Timeframe[] = ['1h', '4h', '1d'];

/* ═══════════════════════════════════════════
   TOOLTIP OVERLAY — fixed, follows cursor
   ═══════════════════════════════════════════ */
const tooltipState = { text: '', x: 0, y: 0, show: false };

function Info({ tip }: { tip: string }) {
  return (
    <span
      className="info-trigger"
      onMouseEnter={() => { tooltipState.show = true; tooltipState.text = tip; }}
      onMouseMove={(e) => { tooltipState.x = e.clientX; tooltipState.y = e.clientY; }}
      onMouseLeave={() => { tooltipState.show = false; }}
    >
      <span className="info-dot" />
    </span>
  );
}

function TooltipOverlay() {
  const [pos, setPos] = useState({ x: 0, y: 0, show: false, text: '' });
  useEffect(() => {
    const handler = () => {
      if (tooltipState.show) setPos({ x: tooltipState.x, y: tooltipState.y, show: true, text: tooltipState.text });
      else setPos(p => ({ ...p, show: false }));
    };
    window.addEventListener('mousemove', handler);
    return () => window.removeEventListener('mousemove', handler);
  }, []);
  if (!pos.show) return null;
  return (
    <div className="tooltip-bubble" style={{ position: 'fixed', left: pos.x, top: pos.y - 16, transform: 'translate(-50%, -100%)', zIndex: 9999, pointerEvents: 'none' }}>
      {pos.text}
    </div>
  );
}

/* ═══════════════════════════════════════════
   SIGNAL GAUGE
   ═══════════════════════════════════════════ */
function SignalGauge({ data }: { data: NonNullable<ReturnType<typeof useMarketData>['data']> }) {
  const sig = data.signal;
  const isBullish = sig.action === 'strong_buy' || sig.action === 'buy';
  const isBearish = sig.action === 'strong_sell' || sig.action === 'sell';
  const stale = (Date.now() - data.lastUpdated) > 120_000;
  const mainColor = isBullish ? 'var(--green)' : isBearish ? 'var(--red)' : 'var(--text-3)';
  const glowBg = isBullish ? 'var(--green-bg)' : isBearish ? 'var(--red-bg)' : 'var(--glass-1)';
  const glowBorder = isBullish ? 'var(--green-border)' : isBearish ? 'var(--red-border)' : 'var(--glass-border)';

  return (
    <div className="glass-2" style={{ borderRadius: 'var(--r-xl)', padding: '28px 32px', background: glowBg, border: `1px solid ${glowBorder}`, opacity: stale ? 0.5 : 1, transition: 'opacity 0.3s' }}>
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
        <div className="flex items-center gap-5">
          <div className="glass-3" style={{ width: 60, height: 60, borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <TokenHYPE className="w-10 h-10" />
          </div>
          <div>
            <div style={{ fontSize: 10, letterSpacing: '0.15em', fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', marginBottom: 4 }}>
              Trading Signal · {data.timeframe.toUpperCase()} · Hyperliquid
            </div>
            <div style={{ fontWeight: 800, fontSize: 26, letterSpacing: '-0.02em', color: mainColor }}>{sig.display}</div>
            <div style={{ fontSize: 13, color: 'var(--text-2)', marginTop: 2 }}>{sig.summary}</div>
          </div>
        </div>
        <div className="flex items-center gap-6 w-full lg:w-auto">
          <div className="flex-1 lg:w-44">
            <div className="flex justify-between items-center mb-2">
              <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--red)', letterSpacing: '0.1em' }}>SELL</span>
              <span style={{ fontSize: 20, fontWeight: 900, fontFamily: 'var(--font-mono), monospace', color: mainColor }}>{sig.score}</span>
              <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--green)', letterSpacing: '0.1em' }}>BUY</span>
            </div>
            <div style={{ width: '100%', height: 6, borderRadius: 3, background: 'var(--glass-1)', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${sig.score}%`, background: mainColor, borderRadius: 3, transition: 'width 0.7s ease' }} />
            </div>
          </div>
          <div className="flex gap-5">
            {[ { n: sig.buy, l: 'Buy', c: 'var(--green)' }, { n: sig.neutral, l: 'Neut', c: 'var(--text-3)' }, { n: sig.sell, l: 'Sell', c: 'var(--red)' } ].map(s => (
              <div key={s.l} className="text-center">
                <div style={{ fontSize: 18, fontWeight: 800, color: s.c }}>{s.n}</div>
                <div style={{ fontSize: 8, fontWeight: 700, color: 'var(--text-4)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>{s.l}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   DOMINANCE PANEL
   ═══════════════════════════════════════════ */
function DominancePanel({ data }: { data: NonNullable<ReturnType<typeof useMarketData>['data']> }) {
  const dom = data.dominance;
  if (!dom || dom.length < 3) return null;
  const fmt = (n: number) => n >= 0 ? `+${n.toFixed(1)}%` : `${n.toFixed(1)}%`;
  const fmtPrice = (n: number) => n >= 1000 ? `$${(n / 1000).toFixed(1)}k` : `$${n.toFixed(2)}`;
  const coins = [
    { d: dom[0], Icon: TokenHYPE, hex: '#4ADE80', bg: 'rgba(74,222,128,0.06)', border: 'rgba(74,222,128,0.15)' },
    { d: dom[1], Icon: TokenBTC, hex: '#F59E0B', bg: 'rgba(245,158,11,0.06)', border: 'rgba(245,158,11,0.15)' },
    { d: dom[2], Icon: TokenETH, hex: '#60A5FA', bg: 'rgba(96,165,250,0.06)', border: 'rgba(96,165,250,0.15)' },
  ];

  return (
    <div className="glass" style={{ borderRadius: 'var(--r-lg)', overflow: 'hidden' }}>
      <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--glass-border)', display: 'flex', alignItems: 'center' }}>
        <h3 style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-2)' }}>Market Dominance</h3>
        <Info tip="HYPE performance vs BTC and ETH over 24h, 7d and 30d" />
      </div>
      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {coins.map(c => (
          <div key={c.d.symbol} style={{ borderRadius: 10, padding: 12, background: c.bg, border: `1px solid ${c.border}` }}>
            <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
              <div className="flex items-center gap-2">
                <c.Icon style={{ width: 22, height: 22, borderRadius: 6 }} />
                <span style={{ fontSize: 12, fontWeight: 700, color: c.hex }}>{c.d.symbol}</span>
              </div>
              <span style={{ fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-mono), monospace', color: 'var(--text-2)' }}>{fmtPrice(c.d.price)}</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {(['24h', '7d', '30d'] as const).map(p => {
                const val = p === '24h' ? c.d.change24h : p === '7d' ? c.d.change7d : c.d.change30d;
                return (
                  <div key={p} className="text-center">
                    <div style={{ fontSize: 8, fontWeight: 700, color: 'var(--text-4)', textTransform: 'uppercase' }}>{p}</div>
                    <div style={{ fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-mono), monospace', color: val >= 0 ? 'var(--green)' : 'var(--red)' }}>{fmt(val)}</div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        {/* Delta */}
        <div style={{ borderRadius: 10, padding: 12, background: 'var(--glass-1)', border: '1px solid var(--glass-border)' }}>
          <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-4)', marginBottom: 8 }}>HYPE Delta</div>
          {coins.slice(1).map(c => {
            const d24 = dom[0].change24h - c.d.change24h;
            const d7 = dom[0].change7d - c.d.change7d;
            return (
              <div key={c.d.symbol} className="flex items-center justify-between" style={{ padding: '5px 0', borderBottom: '1px solid var(--glass-border)' }}>
                <span style={{ fontSize: 10, fontWeight: 600, color: c.hex }}>vs {c.d.symbol}</span>
                <div className="flex gap-3">
                  <span style={{ fontSize: 9, fontWeight: 700, fontFamily: 'var(--font-mono), monospace', color: d24 >= 0 ? 'var(--green)' : 'var(--red)' }}>24h {fmt(d24)}</span>
                  <span style={{ fontSize: 9, fontWeight: 700, fontFamily: 'var(--font-mono), monospace', color: d7 >= 0 ? 'var(--green)' : 'var(--red)' }}>7d {fmt(d7)}</span>
                </div>
              </div>
            );
          })}
          <div style={{ fontSize: 8, fontWeight: 600, color: 'var(--text-4)', marginTop: 8 }}>
            {dom[0].change24h > dom[1].change24h && dom[0].change24h > dom[2].change24h
              ? '● HYPE outperforming (24h)'
              : dom[0].change24h < dom[1].change24h && dom[0].change24h < dom[2].change24h
              ? '● HYPE underperforming (24h)'
              : '● HYPE mixed (24h)'}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   METRIC CARD
   ═══════════════════════════════════════════ */
function MetricCard({ label, value, sub, color, tip }: { label: string; value: string; sub?: string; color?: string; tip: string }) {
  return (
    <div className="glass" style={{ borderRadius: 'var(--r-md)', padding: '14px 16px' }}>
      <div className="flex items-center" style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-4)', marginBottom: 6 }}>
        {label}
        <Info tip={tip} />
      </div>
      <div style={{ fontSize: 15, fontWeight: 700, fontFamily: 'var(--font-mono), monospace', color: color || 'var(--text-1)' }}>{value}</div>
      {sub && <div style={{ fontSize: 9, color: 'var(--text-4)', marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

/* ═══════════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════════ */
export default function Home() {
  const { data, loading, error, tf, tfLoading, fetchCount, changeTimeframe, refetch } = useMarketData('4h');
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(i);
  }, []);

  if (loading) {
    return (
      <div className="ambient-bg">
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
          <div style={{ width: 40, height: 40, borderRadius: '50%', border: '2px solid var(--glass-border)', borderTopColor: 'var(--accent)', animation: 'spin 1s linear infinite' }} />
          <p style={{ fontSize: 13, color: 'var(--text-3)' }}>Loading market data…</p>
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="ambient-bg">
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 }}>
          <div style={{ fontSize: 32 }}>⚠️</div>
          <div style={{ fontWeight: 600, color: 'var(--red)' }}>Connection Error</div>
          <div style={{ fontSize: 13, color: 'var(--text-3)' }}>{error}</div>
          <button onClick={() => refetch()} className="glass-2" style={{ marginTop: 8, padding: '10px 20px', borderRadius: 'var(--r-sm)', fontSize: 13, fontWeight: 600, color: 'var(--accent)', cursor: 'pointer', border: '1px solid var(--accent-border)' }}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const stale = isStale(data.lastUpdated);
  const ind = data.indicators;
  const rsiZone = ind.rsi14 > 70 ? 'Overbought' : ind.rsi14 < 30 ? 'Oversold' : ind.rsi14 > 50 ? 'Bullish zone' : 'Bearish zone';
  const timeSinceUpdate = Math.floor((now - data.lastUpdated) / 1000);

  return (
    <div className="ambient-bg">
      <TooltipOverlay />

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .info-trigger { display: inline-flex; align-items: center; margin-left: 4px; cursor: help; }
        .info-dot { display: inline-block; width: 4px; height: 4px; border-radius: 50%; background: var(--text-4); flex-shrink: 0; transition: background 0.15s; }
        .info-trigger:hover .info-dot { background: var(--text-3); }
        .tooltip-bubble { padding: 7px 12px; font-size: 11px; line-height: 1.4; color: var(--text-2); background: rgba(20, 30, 25, 0.95); border: 1px solid var(--glass-border-highlight); border-radius: 8px; box-shadow: var(--shadow-3); white-space: nowrap; backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); }
      `}</style>

      <div style={{ position: 'relative', zIndex: 1, minHeight: '100vh' }}>

        {/* ═══ HEADER ═══ */}
        <header className="glass-3" style={{ position: 'sticky', top: 0, zIndex: 50, borderBottom: '1px solid var(--glass-border)' }}>
          <div style={{ maxWidth: 1440, margin: '0 auto', padding: '0 24px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div className="flex items-center gap-3">
              <TokenHYPE style={{ width: 30, height: 30, borderRadius: 8 }} />
              <div>
                <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-1)' }}>HYPE</span>
                <span style={{ fontSize: 14, fontWeight: 400, color: 'var(--text-3)', marginLeft: 6 }}>Monitor</span>
              </div>
              <span className="glass" style={{ fontSize: 9, fontWeight: 700, padding: '3px 10px', borderRadius: 'var(--r-full)', color: stale ? 'var(--red)' : 'var(--accent)', border: `1px solid ${stale ? 'var(--red-border)' : 'var(--accent-border)'}` }}>
                {stale ? `Stale ${timeSinceUpdate}s` : '● Live'}
              </span>
            </div>
            <div className="flex items-center gap-4">
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'var(--font-mono), monospace', color: 'var(--text-1)', letterSpacing: '-0.02em' }}>${data.price.toFixed(2)}</div>
                <div style={{ fontSize: 11, fontWeight: 600, color: data.change24h >= 0 ? 'var(--green)' : 'var(--red)' }}>
                  {data.change24h >= 0 ? '+' : ''}{data.change24h.toFixed(2)}% <span style={{ color: 'var(--text-4)' }}>24h</span>
                </div>
              </div>
              <button onClick={() => refetch()} className="glass" style={{ width: 34, height: 34, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="var(--text-2)" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            </div>
          </div>
        </header>

        <main style={{ maxWidth: 1440, margin: '0 auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* ═══ SIGNAL ═══ */}
          <SignalGauge data={data} />

          {/* ═══ METRICS ROW ═══ */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
            {([
              { label: 'Market Cap', value: data.marketCap > 0 ? `$${(data.marketCap / 1e9).toFixed(2)}B` : '—', tip: 'Total market value of all HYPE tokens in circulation' },
              { label: 'Volume 24h', value: `$${(data.volume24h / 1e6).toFixed(1)}M`, tip: 'Total trading volume across all exchanges in the last 24 hours' },
              { label: 'High 24h', value: `$${data.high24h.toFixed(2)}`, tip: 'Highest price reached in the last 24 hours' },
              { label: 'Low 24h', value: `$${data.low24h.toFixed(2)}`, tip: 'Lowest price reached in the last 24 hours' },
              { label: 'Open Interest', value: `$${(data.oiUsd / 1e6).toFixed(1)}M`, sub: `${(data.oiTokens / 1e6).toFixed(1)}M HYPE`, tip: 'Total value of all open perpetual futures contracts' },
              { label: 'Funding 8h', value: `${data.funding8h >= 0 ? '+' : ''}${data.funding8h.toFixed(4)}%`, sub: `Ann. ${data.fundingAnn.toFixed(1)}%`, color: data.funding8h > 0 ? 'var(--green)' : 'var(--red)', tip: 'Funding rate paid every 8h. Positive = longs pay shorts' },
              { label: 'RSI 14', value: ind.rsi14.toFixed(1), sub: rsiZone, color: ind.rsi14 > 70 ? 'var(--red)' : ind.rsi14 < 30 ? 'var(--green)' : 'var(--text-2)', tip: 'Relative Strength Index (14 periods). >70 overbought, <30 oversold' },
            ] as { label: string; value: string; sub?: string; color?: string; tip: string }[]).map(m => (
              <MetricCard key={m.label} {...m} />
            ))}
          </div>

          {/* ═══ DERIVATIVES + SMA ROW ═══ */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <MetricCard label="Long Liquidations" value={data.liqZones[0] ? `$${(data.liqZones[0].valueUsd / 1e6).toFixed(1)}M` : '—'} sub={data.liqZones[0] ? `$${data.liqZones[0].priceLow.toFixed(2)}–$${data.liqZones[0].priceHigh.toFixed(2)}` : ''} color="var(--green)" tip="Estimated value of long positions liquidated at this price zone" />
            <MetricCard label="Short Liquidations" value={data.liqZones[1] ? `$${(data.liqZones[1].valueUsd / 1e6).toFixed(1)}M` : '—'} sub={data.liqZones[1] ? `$${data.liqZones[1].priceLow.toFixed(2)}–$${data.liqZones[1].priceHigh.toFixed(2)}` : ''} color="#60A5FA" tip="Estimated value of short positions liquidated at this price zone" />
            <MetricCard label="SMA 10" value={`$${ind.sma10.toFixed(2)}`} sub={data.price > ind.sma10 ? '▲ Above' : '▼ Below'} color="#F9A8D4" tip="Simple Moving Average over 10 periods" />
            <MetricCard label="SMA 50" value={`$${ind.sma50.toFixed(2)}`} sub={data.price > ind.sma50 ? '▲ Above' : '▼ Below'} color="#60A5FA" tip="Simple Moving Average over 50 periods" />
          </div>

          {/* ═══ TIMEFRAMES ═══ */}
          <div className="flex items-center gap-2">
            {TFS.map(t => (
              <button key={t} onClick={() => changeTimeframe(t)}
                className={tf === t ? 'glass-accent' : 'glass'}
                style={{
                  position: 'relative',
                  padding: '8px 20px',
                  borderRadius: 'var(--r-sm)',
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: 'pointer',
                  color: tf === t ? 'var(--accent)' : 'var(--text-2)',
                  transition: 'all 0.2s',
                }}>
                {TIMEFRAME_CONFIG[t].label}
                {tfLoading && tf === t && (
                  <span style={{ position: 'absolute', top: -2, right: -2, width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', animation: 'pulse 1.5s ease-in-out infinite' }} />
                )}
              </button>
            ))}
          </div>

          {/* ═══ MAIN GRID ═══ */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <div className="lg:col-span-2" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

              {/* Chart */}
              <div className="glass-2" style={{ borderRadius: 'var(--r-lg)', overflow: 'hidden' }}>
                <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--glass-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <h3 style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-2)' }}>HYPE/USDT · TradingView</h3>
                  <div className="flex gap-3" style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-4)' }}>
                    <span className="flex items-center gap-1"><span style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--green)', display: 'inline-block' }} /> Bullish</span>
                    <span className="flex items-center gap-1"><span style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--red)', display: 'inline-block' }} /> Bearish</span>
                  </div>
                </div>
                <TradingViewChart timeframe={tf} />
              </div>

              {/* Performance */}
              <div className="grid grid-cols-3 gap-3">
                {(['24h', '7d', '30d'] as const).map(period => {
                  const val = period === '24h' ? data.change24h : period === '7d' ? data.change7d : data.change30d;
                  return (
                    <div key={period} className="glass" style={{ borderRadius: 'var(--r-md)', padding: '16px 20px' }}>
                      <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-4)', marginBottom: 4 }}>{period}</div>
                      <div style={{ fontSize: 18, fontWeight: 800, fontFamily: 'var(--font-mono), monospace', color: val >= 0 ? 'var(--green)' : 'var(--red)' }}>{fmtPct(val)}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ═══ SIDEBAR ═══ */}
            <aside style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* Technical Indicators */}
              <div className="glass" style={{ borderRadius: 'var(--r-lg)', overflow: 'hidden' }}>
                <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--glass-border)' }}>
                  <h3 style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-2)' }}>Technical Indicators · {data.timeframe.toUpperCase()}</h3>
                </div>
                <div style={{ padding: '12px 20px' }}>
                  {([
                    { label: 'SMA 10', value: `$${ind.sma10.toFixed(2)}`, color: data.price > ind.sma10 ? 'var(--green)' : 'var(--red)', sub: data.price > ind.sma10 ? 'Above' : 'Below', tip: 'Simple Moving Average over 10 periods' },
                    { label: 'SMA 20', value: `$${ind.sma20.toFixed(2)}`, color: data.price > ind.sma20 ? 'var(--green)' : 'var(--red)', sub: data.price > ind.sma20 ? 'Above' : 'Below', tip: 'Simple Moving Average over 20 periods' },
                    { label: 'SMA 50', value: `$${ind.sma50.toFixed(2)}`, color: data.price > ind.sma50 ? 'var(--green)' : 'var(--red)', sub: data.price > ind.sma50 ? 'Above' : 'Below', tip: 'Simple Moving Average over 50 periods' },
                    { label: 'RSI 14', value: ind.rsi14.toFixed(1), color: ind.rsi14 > 70 ? 'var(--red)' : ind.rsi14 < 30 ? 'var(--green)' : 'var(--text-2)', sub: rsiZone, tip: 'Relative Strength Index. >70 overbought, <30 oversold' },
                    { label: 'MACD', value: ind.macd.toFixed(4), color: ind.macdHist > 0 ? 'var(--green)' : 'var(--red)', sub: `Sig: ${ind.macdSignal.toFixed(3)}`, tip: 'Moving Average Convergence Divergence' },
                    { label: 'Stoch K', value: ind.stochK.toFixed(1), color: ind.stochK > 80 ? 'var(--red)' : ind.stochK < 20 ? 'var(--green)' : 'var(--text-2)', sub: `D: ${ind.stochD.toFixed(1)}`, tip: 'Stochastic Oscillator. >80 overbought, <20 oversold' },
                    { label: 'KDJ J', value: ind.kdjJ.toFixed(1), color: ind.kdjJ > 80 ? 'var(--red)' : ind.kdjJ < 20 ? 'var(--green)' : 'var(--text-2)', sub: `K: ${ind.kdjK.toFixed(1)}`, tip: 'KDJ Momentum indicator' },
                    { label: 'CCI', value: ind.cci.toFixed(1), color: ind.cci > 100 ? 'var(--red)' : ind.cci < -100 ? 'var(--green)' : 'var(--text-2)', sub: ind.cci > 100 ? 'Overbought' : ind.cci < -100 ? 'Oversold' : 'Neutral', tip: 'Commodity Channel Index. >+100 overbought, <-100 oversold' },
                    { label: 'ADX', value: ind.adx.toFixed(1), color: ind.adx > 25 ? 'var(--amber)' : 'var(--text-4)', sub: ind.adx > 25 ? 'Trending' : 'Ranging', tip: 'Average Directional Index. >25 = strong trend' },
                    { label: 'BB %B', value: ind.bbPercentB.toFixed(3), color: ind.bbPercentB > 1 ? 'var(--red)' : ind.bbPercentB < 0 ? 'var(--green)' : 'var(--text-2)', sub: '', tip: 'Bollinger Bands %B. >1 above upper, <0 below lower' },
                  ] as { label: string; value: string; color: string; sub: string; tip: string }[]).map((r, i) => (
                    <div key={r.label} className="flex items-center justify-between" style={{ padding: '9px 0', borderBottom: i < 9 ? '1px solid var(--glass-border)' : 'none' }}>
                      <div className="flex items-center" style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-2)' }}>
                        {r.label}
                        <Info tip={r.tip} />
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span style={{ fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-mono), monospace', color: r.color }}>{r.value}</span>
                        {r.sub && <span style={{ fontSize: 9, marginLeft: 6, color: 'var(--text-4)' }}>{r.sub}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* RSI Gauge */}
              <div className="glass" style={{ borderRadius: 'var(--r-lg)', padding: 20 }}>
                <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
                  <div className="flex items-center" style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-2)' }}>
                    RSI (14)
                    <Info tip="0-100 scale. Green zone = oversold, Red zone = overbought" />
                  </div>
                  <span style={{ fontSize: 20, fontWeight: 800, fontFamily: 'var(--font-mono), monospace', color: ind.rsi14 > 70 ? 'var(--red)' : ind.rsi14 < 30 ? 'var(--green)' : 'var(--text-2)' }}>{ind.rsi14.toFixed(1)}</span>
                </div>
                <div style={{ position: 'relative', height: 8, borderRadius: 4, overflow: 'hidden', background: 'linear-gradient(to right, var(--green) 0%, var(--green) 30%, var(--amber) 30%, var(--amber) 70%, var(--red) 70%, var(--red) 100%)' }}>
                  <div style={{ position: 'absolute', top: 0, height: '100%', width: 4, background: '#fff', borderRadius: 2, boxShadow: '0 0 8px rgba(255,255,255,0.5)', left: `${Math.min(100, Math.max(0, ind.rsi14))}%`, transition: 'left 0.5s ease' }} />
                </div>
                <div className="flex justify-between" style={{ marginTop: 6 }}>
                  <span style={{ fontSize: 8, fontWeight: 700, color: 'var(--green)' }}>30 Oversold</span>
                  <span style={{ fontSize: 8, fontWeight: 700, color: 'var(--text-4)' }}>50</span>
                  <span style={{ fontSize: 8, fontWeight: 700, color: 'var(--red)' }}>70 Overbought</span>
                </div>
              </div>

              {/* S/R */}
              {(data.srLevels.resistances.length > 0 || data.srLevels.supports.length > 0) && (
                <div className="glass" style={{ borderRadius: 'var(--r-lg)', overflow: 'hidden' }}>
                  <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--glass-border)', display: 'flex', alignItems: 'center' }}>
                    <h3 style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-2)' }}>Support / Resistance</h3>
                    <Info tip="Key price levels where price has previously reversed" />
                  </div>
                  <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {data.srLevels.resistances.map((r, i) => (
                      <div key={`r${i}`} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="glass" style={{ width: 24, height: 24, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 800, color: 'var(--red)', border: '1px solid var(--red-border)' }}>R{i+1}</span>
                          <span style={{ fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-mono), monospace', color: 'var(--red)' }}>${r.price.toFixed(2)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div style={{ width: 60, height: 4, borderRadius: 2, background: 'var(--glass-1)', overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${r.strength}%`, background: 'var(--red)', borderRadius: 2 }} />
                          </div>
                          <span style={{ fontSize: 9, fontWeight: 700, width: 28, textAlign: 'right', color: 'var(--text-4)' }}>{r.strength}%</span>
                        </div>
                      </div>
                    ))}
                    {data.srLevels.supports.map((s, i) => (
                      <div key={`s${i}`} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="glass" style={{ width: 24, height: 24, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 800, color: 'var(--green)', border: '1px solid var(--green-border)' }}>S{i+1}</span>
                          <span style={{ fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-mono), monospace', color: 'var(--green)' }}>${s.price.toFixed(2)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div style={{ width: 60, height: 4, borderRadius: 2, background: 'var(--glass-1)', overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${s.strength}%`, background: 'var(--green)', borderRadius: 2 }} />
                          </div>
                          <span style={{ fontSize: 9, fontWeight: 700, width: 28, textAlign: 'right', color: 'var(--text-4)' }}>{s.strength}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Dominance */}
              <DominancePanel data={data} />

              {/* Footer info */}
              <div style={{ fontSize: 10, color: 'var(--text-4)', padding: '0 4px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div className="flex justify-between"><span>Source</span><span style={{ fontWeight: 600, color: 'var(--text-3)' }}>Hyperliquid</span></div>
                <div className="flex justify-between"><span>Fetches</span><span style={{ fontWeight: 600, color: 'var(--text-3)' }}>{fetchCount}</span></div>
                <div className="flex justify-between"><span>Updated</span><span style={{ fontWeight: 600, color: 'var(--text-3)' }}>{timeSinceUpdate < 60 ? `${timeSinceUpdate}s ago` : `${Math.floor(timeSinceUpdate/60)}m ago`}</span></div>
              </div>
            </aside>
          </div>
        </main>
      </div>
    </div>
  );
}
