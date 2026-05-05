'use client';

import { useState, useEffect } from 'react';
import { TokenHYPE, TokenBTC, TokenETH } from '@web3icons/react';
import { useMarketData } from '../hooks/useMarketData';
import TradingViewChart from '../components/chart/TradingViewChart';
import { fmtPct, isStale } from '../lib/format';
import type { Timeframe } from '../types';
import { TIMEFRAME_CONFIG } from '../types';

const TFS: Timeframe[] = ['1h', '4h', '1d'];

/* ── name: font-mono fallback ─────────────────────────────── */
const MF = "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, monospace";

/* ═══════════════════════════════════════════
   TOOLTIP OVERLAY
   ═══════════════════════════════════════════ */
const tooltipState = { text: '', x: 0, y: 0, show: false };

function Info({ tip }: { tip: string }) {
  return (
    <span className="info-trigger"
      onMouseEnter={() => { tooltipState.show = true; tooltipState.text = tip; }}
      onMouseMove={(e) => { tooltipState.x = e.clientX; tooltipState.y = e.clientY; }}
      onMouseLeave={() => { tooltipState.show = false; }}>
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
    <div className="tooltip-bubble" style={{ position: 'fixed', left: pos.x, top: pos.y - 16, transform: 'translate(-50%, -100%)', zIndex: 9999 }}>
      {pos.text}
    </div>
  );
}

/* ═══════════════════════════════════════════
   SIGNAL GAUGE
   ═══════════════════════════════════════════ */
function SignalGauge({ data }: { data: NonNullable<ReturnType<typeof useMarketData>['data']> }) {
  const sig = data.signal;
  const bull = sig.action === 'strong_buy' || sig.action === 'buy';
  const bear = sig.action === 'strong_sell' || sig.action === 'sell';
  const stale = (Date.now() - data.lastUpdated) > 120_000;
  const c = bull ? '#34D399' : bear ? '#F87171' : 'rgba(255,255,255,0.35)';
  const bg = bull ? 'rgba(52,211,153,0.06)' : bear ? 'rgba(248,113,113,0.06)' : 'rgba(255,255,255,0.03)';

  return (
    <div className="glass-2" style={{ borderRadius: 24, padding: '28px 32px', background: bg, borderColor: bull ? 'rgba(52,211,153,0.15)' : bear ? 'rgba(248,113,113,0.15)' : 'rgba(255,255,255,0.06)', opacity: stale ? 0.5 : 1, transition: 'opacity .3s' }}>
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
        <div className="flex items-center gap-5">
          <div className="glass-3" style={{ width: 60, height: 60, borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <TokenHYPE style={{ width: 40, height: 40 }} />
          </div>
          <div>
            <div style={{ fontSize: 10, letterSpacing: '.15em', fontWeight: 600, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', marginBottom: 4 }}>
              Trading Signal · {data.timeframe.toUpperCase()} · Hyperliquid
            </div>
            <div style={{ fontWeight: 800, fontSize: 26, letterSpacing: '-.02em', color: c }}>{sig.display}</div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>{sig.summary}</div>
          </div>
        </div>
        <div className="flex items-center gap-6 w-full lg:w-auto">
          <div className="flex-1 lg:w-44">
            <div className="flex justify-between items-center mb-2">
              <span style={{ fontSize: 9, fontWeight: 700, color: '#F87171', letterSpacing: '.1em' }}>SELL</span>
              <span style={{ fontSize: 20, fontWeight: 900, fontFamily: MF, color: c }}>{sig.score}</span>
              <span style={{ fontSize: 9, fontWeight: 700, color: '#34D399', letterSpacing: '.1em' }}>BUY</span>
            </div>
            <div style={{ width: '100%', height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.05)', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${sig.score}%`, background: c, borderRadius: 3, transition: 'width .7s ease' }} />
            </div>
          </div>
          <div className="flex gap-5">
            {[{ n: sig.buy, l: 'Buy', c: '#34D399' }, { n: sig.neutral, l: 'Neut', c: 'rgba(255,255,255,0.35)' }, { n: sig.sell, l: 'Sell', c: '#F87171' }].map(s => (
              <div key={s.l} className="text-center">
                <div style={{ fontSize: 18, fontWeight: 800, color: s.c }}>{s.n}</div>
                <div style={{ fontSize: 8, fontWeight: 700, color: 'rgba(255,255,255,0.2)', letterSpacing: '.12em', textTransform: 'uppercase' }}>{s.l}</div>
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
  const fmt = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`;
  const fp = (n: number) => n >= 1000 ? `$${(n / 1000).toFixed(1)}k` : `$${n.toFixed(2)}`;
  const coins = [
    { d: dom[0], Icon: TokenHYPE, hex: '#4ADE80' },
    { d: dom[1], Icon: TokenBTC, hex: '#F59E0B' },
    { d: dom[2], Icon: TokenETH, hex: '#60A5FA' },
  ];

  return (
    <div className="glass" style={{ borderRadius: 18, overflow: 'hidden' }}>
      <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center' }}>
        <h3 style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.6)' }}>Market Dominance</h3>
        <Info tip="HYPE performance vs BTC and ETH over 24h, 7d and 30d" />
      </div>
      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {coins.map(c => (
          <div key={c.d.symbol} style={{ borderRadius: 10, padding: 12, background: `${c.hex}0f`, border: `1px solid ${c.hex}25` }}>
            <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
              <div className="flex items-center gap-2">
                <c.Icon style={{ width: 22, height: 22, borderRadius: 6 }} />
                <span style={{ fontSize: 12, fontWeight: 700, color: c.hex }}>{c.d.symbol}</span>
              </div>
              <span style={{ fontSize: 11, fontWeight: 700, fontFamily: MF, color: 'rgba(255,255,255,0.6)' }}>{fp(c.d.price)}</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {(['24h', '7d', '30d'] as const).map(p => {
                const v = p === '24h' ? c.d.change24h : p === '7d' ? c.d.change7d : c.d.change30d;
                return (
                  <div key={p} className="text-center">
                    <div style={{ fontSize: 8, fontWeight: 700, color: 'rgba(255,255,255,0.2)', textTransform: 'uppercase' }}>{p}</div>
                    <div style={{ fontSize: 11, fontWeight: 700, fontFamily: MF, color: v >= 0 ? '#34D399' : '#F87171' }}>{fmt(v)}</div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        <div style={{ borderRadius: 10, padding: 12, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.2)', marginBottom: 8 }}>HYPE Delta</div>
          {coins.slice(1).map(c => (
            <div key={c.d.symbol} className="flex items-center justify-between" style={{ padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <span style={{ fontSize: 10, fontWeight: 600, color: c.hex }}>vs {c.d.symbol}</span>
              <div className="flex gap-3">
                <span style={{ fontSize: 9, fontWeight: 700, fontFamily: MF, color: (dom[0].change24h - c.d.change24h) >= 0 ? '#34D399' : '#F87171' }}>24h {fmt(dom[0].change24h - c.d.change24h)}</span>
                <span style={{ fontSize: 9, fontWeight: 700, fontFamily: MF, color: (dom[0].change7d - c.d.change7d) >= 0 ? '#34D399' : '#F87171' }}>7d {fmt(dom[0].change7d - c.d.change7d)}</span>
              </div>
            </div>
          ))}
          <div style={{ fontSize: 8, fontWeight: 600, color: 'rgba(255,255,255,0.2)', marginTop: 8 }}>
            {dom[0].change24h > dom[1].change24h && dom[0].change24h > dom[2].change24h ? '● Outperforming (24h)'
              : dom[0].change24h < dom[1].change24h && dom[0].change24h < dom[2].change24h ? '● Underperforming (24h)'
              : '● Mixed (24h)'}
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
    <div className="glass" style={{ borderRadius: 14, padding: '14px 16px' }}>
      <div className="flex items-center" style={{ fontSize: 9, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.2)', marginBottom: 6 }}>
        {label}
        <Info tip={tip} />
      </div>
      <div style={{ fontSize: 15, fontWeight: 700, fontFamily: MF, color: color || 'rgba(255,255,255,0.95)' }}>{value}</div>
      {sub && <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.2)', marginTop: 2 }}>{sub}</div>}
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
          <div className="spin" style={{ width: 36, height: 36, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.08)', borderTopColor: '#4ADE80' }} />
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.35)' }}>Loading market data…</p>
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="ambient-bg">
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 }}>
          <div style={{ fontSize: 32 }}>⚠️</div>
          <div style={{ fontWeight: 600, color: '#F87171' }}>Connection Error</div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)' }}>{error}</div>
          <button onClick={() => refetch()} className="glass-2" style={{ marginTop: 8, padding: '10px 24px', borderRadius: 10, fontSize: 13, fontWeight: 600, color: '#4ADE80', cursor: 'pointer' }}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const stale = isStale(data.lastUpdated);
  const ind = data.indicators;
  const rsiZ = ind.rsi14 > 70 ? 'Overbought' : ind.rsi14 < 30 ? 'Oversold' : ind.rsi14 > 50 ? 'Bullish zone' : 'Bearish zone';
  const tsu = Math.floor((now - data.lastUpdated) / 1000);

  return (
    <div className="ambient-bg">
      <TooltipOverlay />

      {/* ═══ HEADER ═══ */}
      <header className="glass-3" style={{ position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: 1440, margin: '0 auto', padding: '0 24px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div className="flex items-center gap-3">
            <TokenHYPE style={{ width: 30, height: 30, borderRadius: 8 }} />
            <div>
              <span style={{ fontSize: 14, fontWeight: 700 }}>HYPE</span>
              <span style={{ fontSize: 14, fontWeight: 400, color: 'rgba(255,255,255,0.35)', marginLeft: 6 }}>Monitor</span>
            </div>
            <span className="glass" style={{ fontSize: 9, fontWeight: 700, padding: '3px 10px', borderRadius: 999, color: stale ? '#F87171' : '#4ADE80', borderColor: stale ? 'rgba(248,113,113,0.2)' : 'rgba(74,222,128,0.2)' }}>
              {stale ? `Stale ${tsu}s` : '● Live'}
            </span>
          </div>
          <div className="flex items-center gap-4">
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 20, fontWeight: 700, fontFamily: MF, letterSpacing: '-.02em' }}>${data.price.toFixed(2)}</div>
              <div style={{ fontSize: 11, fontWeight: 600, color: data.change24h >= 0 ? '#34D399' : '#F87171' }}>
                {data.change24h >= 0 ? '+' : ''}{data.change24h.toFixed(2)}% <span style={{ color: 'rgba(255,255,255,0.2)' }}>24h</span>
              </div>
            </div>
            <button onClick={() => refetch()} className="glass" style={{ width: 34, height: 34, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="rgba(255,255,255,0.6)" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: 1440, margin: '0 auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: 20 }}>

        <SignalGauge data={data} />

        {/* ═══ METRICS ═══ */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          <MetricCard label="Market Cap" value={data.marketCap > 0 ? `$${(data.marketCap / 1e9).toFixed(2)}B` : '—'} tip="Total market value of all HYPE tokens in circulation" />
          <MetricCard label="Volume 24h" value={`$${(data.volume24h / 1e6).toFixed(1)}M`} tip="Total trading volume across all exchanges in the last 24 hours" />
          <MetricCard label="High 24h" value={`$${data.high24h.toFixed(2)}`} tip="Highest price reached in the last 24 hours" />
          <MetricCard label="Low 24h" value={`$${data.low24h.toFixed(2)}`} tip="Lowest price reached in the last 24 hours" />
          <MetricCard label="Open Interest" value={`$${(data.oiUsd / 1e6).toFixed(1)}M`} sub={`${(data.oiTokens / 1e6).toFixed(1)}M HYPE`} tip="Total value of all open perpetual futures contracts" />
          <MetricCard label="Funding 8h" value={`${data.funding8h >= 0 ? '+' : ''}${data.funding8h.toFixed(4)}%`} sub={`Ann. ${data.fundingAnn.toFixed(1)}%`} color={data.funding8h > 0 ? '#34D399' : '#F87171'} tip="Funding rate paid every 8h. Positive = longs pay shorts" />
          <MetricCard label="RSI 14" value={ind.rsi14.toFixed(1)} sub={rsiZ} color={ind.rsi14 > 70 ? '#F87171' : ind.rsi14 < 30 ? '#34D399' : 'rgba(255,255,255,0.6)'} tip="Relative Strength Index (14 periods). >70 overbought, <30 oversold" />
        </div>

        {/* ═══ DERIVATIVES + SMA ═══ */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <MetricCard label="Long Liqs" value={data.liqZones[0] ? `$${(data.liqZones[0].valueUsd / 1e6).toFixed(1)}M` : '—'} sub={data.liqZones[0] ? `$${data.liqZones[0].priceLow.toFixed(2)}–$${data.liqZones[0].priceHigh.toFixed(2)}` : ''} color="#34D399" tip="Estimated value of long positions liquidated at this price zone" />
          <MetricCard label="Short Liqs" value={data.liqZones[1] ? `$${(data.liqZones[1].valueUsd / 1e6).toFixed(1)}M` : '—'} sub={data.liqZones[1] ? `$${data.liqZones[1].priceLow.toFixed(2)}–$${data.liqZones[1].priceHigh.toFixed(2)}` : ''} color="#60A5FA" tip="Estimated value of short positions liquidated at this price zone" />
          <MetricCard label="SMA 10" value={`$${ind.sma10.toFixed(2)}`} sub={data.price > ind.sma10 ? '▲ Above' : '▼ Below'} color="#F9A8D4" tip="Simple Moving Average over 10 periods" />
          <MetricCard label="SMA 50" value={`$${ind.sma50.toFixed(2)}`} sub={data.price > ind.sma50 ? '▲ Above' : '▼ Below'} color="#60A5FA" tip="Simple Moving Average over 50 periods" />
        </div>

        {/* ═══ TIMEFRAMES ═══ */}
        <div className="flex items-center gap-2">
          {TFS.map(t => (
            <button key={t} onClick={() => changeTimeframe(t)}
              className={tf === t ? 'glass-accent' : 'glass'}
              style={{ position: 'relative', padding: '8px 20px', borderRadius: 10, fontSize: 11, fontWeight: 700, cursor: 'pointer', color: tf === t ? '#4ADE80' : 'rgba(255,255,255,0.6)', transition: 'all .2s' }}>
              {TIMEFRAME_CONFIG[t].label}
              {tfLoading && tf === t && (
                <span className="pulse" style={{ position: 'absolute', top: -2, right: -2, width: 6, height: 6, borderRadius: '50%', background: '#4ADE80', display: 'block' }} />
              )}
            </button>
          ))}
        </div>

        {/* ═══ MAIN GRID ═══ */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            <div className="glass-2" style={{ borderRadius: 18, overflow: 'hidden' }}>
              <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h3 style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.6)' }}>HYPE/USDT · TradingView</h3>
                <div className="flex gap-3" style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.2)' }}>
                  <span className="flex items-center gap-1.5"><span style={{ width: 8, height: 8, borderRadius: 2, background: '#34D399', display: 'inline-block' }} /> Bullish</span>
                  <span className="flex items-center gap-1.5"><span style={{ width: 8, height: 8, borderRadius: 2, background: '#F87171', display: 'inline-block' }} /> Bearish</span>
                </div>
              </div>
              <TradingViewChart timeframe={tf} />
            </div>

            <div className="grid grid-cols-3 gap-3">
              {(['24h', '7d', '30d'] as const).map(p => {
                const v = p === '24h' ? data.change24h : p === '7d' ? data.change7d : data.change30d;
                return (
                  <div key={p} className="glass" style={{ borderRadius: 14, padding: '16px 20px' }}>
                    <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.2)', marginBottom: 4 }}>{p}</div>
                    <div style={{ fontSize: 18, fontWeight: 800, fontFamily: MF, color: v >= 0 ? '#34D399' : '#F87171' }}>{fmtPct(v)}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ═══ SIDEBAR ═══ */}
          <aside style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Technical Indicators */}
            <div className="glass" style={{ borderRadius: 18, overflow: 'hidden' }}>
              <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                <h3 style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.6)' }}>Indicators · {data.timeframe.toUpperCase()}</h3>
              </div>
              <div style={{ padding: '8px 20px 12px' }}>
                {([
                  { l: 'SMA 10', v: `$${ind.sma10.toFixed(2)}`, c: data.price > ind.sma10 ? '#34D399' : '#F87171', s: data.price > ind.sma10 ? 'Above' : 'Below', t: 'Simple Moving Average over 10 periods' },
                  { l: 'SMA 20', v: `$${ind.sma20.toFixed(2)}`, c: data.price > ind.sma20 ? '#34D399' : '#F87171', s: data.price > ind.sma20 ? 'Above' : 'Below', t: 'Simple Moving Average over 20 periods' },
                  { l: 'SMA 50', v: `$${ind.sma50.toFixed(2)}`, c: data.price > ind.sma50 ? '#34D399' : '#F87171', s: data.price > ind.sma50 ? 'Above' : 'Below', t: 'Simple Moving Average over 50 periods' },
                  { l: 'RSI 14', v: ind.rsi14.toFixed(1), c: ind.rsi14 > 70 ? '#F87171' : ind.rsi14 < 30 ? '#34D399' : 'rgba(255,255,255,0.6)', s: rsiZ, t: 'Relative Strength Index. >70 overbought, <30 oversold' },
                  { l: 'MACD', v: ind.macd.toFixed(4), c: ind.macdHist > 0 ? '#34D399' : '#F87171', s: `Sig: ${ind.macdSignal.toFixed(3)}`, t: 'Moving Average Convergence Divergence' },
                  { l: 'Stoch K', v: ind.stochK.toFixed(1), c: ind.stochK > 80 ? '#F87171' : ind.stochK < 20 ? '#34D399' : 'rgba(255,255,255,0.6)', s: `D: ${ind.stochD.toFixed(1)}`, t: 'Stochastic Oscillator. >80 overbought, <20 oversold' },
                  { l: 'KDJ J', v: ind.kdjJ.toFixed(1), c: ind.kdjJ > 80 ? '#F87171' : ind.kdjJ < 20 ? '#34D399' : 'rgba(255,255,255,0.6)', s: `K: ${ind.kdjK.toFixed(1)}`, t: 'KDJ Momentum indicator' },
                  { l: 'CCI', v: ind.cci.toFixed(1), c: ind.cci > 100 ? '#F87171' : ind.cci < -100 ? '#34D399' : 'rgba(255,255,255,0.6)', s: ind.cci > 100 ? 'Overbought' : ind.cci < -100 ? 'Oversold' : 'Neutral', t: 'Commodity Channel Index. >+100 overbought, <-100 oversold' },
                  { l: 'ADX', v: ind.adx.toFixed(1), c: ind.adx > 25 ? '#FBBF24' : 'rgba(255,255,255,0.2)', s: ind.adx > 25 ? 'Trending' : 'Ranging', t: 'Average Directional Index. >25 = strong trend' },
                  { l: 'BB %B', v: ind.bbPercentB.toFixed(3), c: ind.bbPercentB > 1 ? '#F87171' : ind.bbPercentB < 0 ? '#34D399' : 'rgba(255,255,255,0.6)', s: '', t: 'Bollinger Bands %B. >1 above upper, <0 below lower' },
                ] as { l: string; v: string; c: string; s: string; t: string }[]).map((r, i) => (
                  <div key={r.l} className="flex items-center justify-between" style={{ padding: '8px 0', borderBottom: i < 9 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                    <div className="flex items-center" style={{ fontSize: 11, fontWeight: 500, color: 'rgba(255,255,255,0.6)' }}>
                      {r.l}
                      <Info tip={r.t} />
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: 12, fontWeight: 700, fontFamily: MF, color: r.c }}>{r.v}</span>
                      {r.s && <span style={{ fontSize: 9, marginLeft: 6, color: 'rgba(255,255,255,0.2)' }}>{r.s}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* RSI Gauge */}
            <div className="glass" style={{ borderRadius: 18, padding: 20 }}>
              <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
                <div className="flex items-center" style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.6)' }}>
                  RSI (14)
                  <Info tip="0-100 scale. Green zone = oversold, Red zone = overbought" />
                </div>
                <span style={{ fontSize: 20, fontWeight: 800, fontFamily: MF, color: ind.rsi14 > 70 ? '#F87171' : ind.rsi14 < 30 ? '#34D399' : 'rgba(255,255,255,0.6)' }}>{ind.rsi14.toFixed(1)}</span>
              </div>
              <div style={{ position: 'relative', height: 8, borderRadius: 4, overflow: 'hidden', background: 'linear-gradient(to right, #34D399 0%, #34D399 30%, #FBBF24 30%, #FBBF24 70%, #F87171 70%, #F87171 100%)' }}>
                <div style={{ position: 'absolute', top: -2, height: 12, width: 4, background: '#fff', borderRadius: 2, boxShadow: '0 0 10px rgba(255,255,255,0.5)', left: `${Math.min(99, Math.max(0, ind.rsi14))}%`, transition: 'left .5s ease' }} />
              </div>
              <div className="flex justify-between" style={{ marginTop: 6 }}>
                <span style={{ fontSize: 8, fontWeight: 700, color: '#34D399' }}>30 Oversold</span>
                <span style={{ fontSize: 8, fontWeight: 700, color: 'rgba(255,255,255,0.2)' }}>50</span>
                <span style={{ fontSize: 8, fontWeight: 700, color: '#F87171' }}>70 Overbought</span>
              </div>
            </div>

            {/* S/R */}
            {(data.srLevels.resistances.length > 0 || data.srLevels.supports.length > 0) && (
              <div className="glass" style={{ borderRadius: 18, overflow: 'hidden' }}>
                <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center' }}>
                  <h3 style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.6)' }}>Support / Resistance</h3>
                  <Info tip="Key price levels where price has previously reversed" />
                </div>
                <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {data.srLevels.resistances.map((r, i) => (
                    <div key={`r${i}`} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span style={{ width: 24, height: 24, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 800, color: '#F87171', background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)' }}>R{i + 1}</span>
                        <span style={{ fontSize: 12, fontWeight: 700, fontFamily: MF, color: '#F87171' }}>${r.price.toFixed(2)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div style={{ width: 56, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.05)', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${r.strength}%`, background: '#F87171', borderRadius: 2 }} />
                        </div>
                        <span style={{ fontSize: 9, fontWeight: 700, width: 28, textAlign: 'right', color: 'rgba(255,255,255,0.2)' }}>{r.strength}%</span>
                      </div>
                    </div>
                  ))}
                  {data.srLevels.supports.map((s, i) => (
                    <div key={`s${i}`} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span style={{ width: 24, height: 24, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 800, color: '#34D399', background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.2)' }}>S{i + 1}</span>
                        <span style={{ fontSize: 12, fontWeight: 700, fontFamily: MF, color: '#34D399' }}>${s.price.toFixed(2)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div style={{ width: 56, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.05)', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${s.strength}%`, background: '#34D399', borderRadius: 2 }} />
                        </div>
                        <span style={{ fontSize: 9, fontWeight: 700, width: 28, textAlign: 'right', color: 'rgba(255,255,255,0.2)' }}>{s.strength}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <DominancePanel data={data} />

            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)', padding: '0 4px', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div className="flex justify-between"><span>Source</span><span style={{ fontWeight: 600, color: 'rgba(255,255,255,0.35)' }}>Hyperliquid</span></div>
              <div className="flex justify-between"><span>Fetches</span><span style={{ fontWeight: 600, color: 'rgba(255,255,255,0.35)' }}>{fetchCount}</span></div>
              <div className="flex justify-between"><span>Updated</span><span style={{ fontWeight: 600, color: 'rgba(255,255,255,0.35)' }}>{tsu < 60 ? `${tsu}s ago` : `${Math.floor(tsu / 60)}m ago`}</span></div>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
