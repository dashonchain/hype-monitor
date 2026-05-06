'use client';

import { useState, useEffect, useMemo, memo, useRef } from 'react';
import { TokenHYPE, TokenBTC, TokenETH } from '@web3icons/react';
import { useMarketData } from '../hooks/useMarketData';
import TradingViewChart from '../components/chart/TradingViewChart';
import { fmtPct, isStale } from '../lib/format';
import type { Timeframe } from '../types';

const MF = "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace";
const SF = "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', Roboto, sans-serif";

/* ─── TOOLTIP ─── */
const tt = { text: '', x: 0, y: 0, show: false };
function Info({ tip }: { tip: string }) {
  return (
    <span className="info-trigger"
      onMouseEnter={() => { tt.show = true; tt.text = tip; }}
      onMouseMove={(e) => { tt.x = e.clientX; tt.y = e.clientY; }}
      onMouseLeave={() => { tt.show = false; }}>
      <span className="info-dot" />
    </span>
  );
}
function TooltipOverlay() {
  const [p, setP] = useState({ x: 0, y: 0, show: false, text: '' });
  useEffect(() => {
    const h = () => { if (p.show !== tt.show || p.text !== tt.text) setP({ x: tt.x, y: tt.y, show: tt.show, text: tt.text }); };
    window.addEventListener('mousemove', h); return () => window.removeEventListener('mousemove', h);
  }, [p.show, p.text]);
  if (!p.show) return null;
  return (<div className="tooltip-bubble" style={{ position: 'fixed', left: p.x, top: p.y - 12, transform: 'translate(-50%,-100%)', zIndex: 9999 }}>{p.text}</div>);
}

/* ─── SIGNAL ─── */
const CRITERIA = [
  { key: 'sma10', label: 'SMA 10' }, { key: 'sma20', label: 'SMA 20' },
  { key: 'sma50', label: 'SMA 50' }, { key: 'smaCross', label: 'SMA 10>20' },
  { key: 'smaCross2', label: 'SMA 20>50' }, { key: 'rsi', label: 'RSI' },
  { key: 'macd', label: 'MACD' }, { key: 'stoch', label: 'Stoch' },
  { key: 'kdj', label: 'KDJ' }, { key: 'cci', label: 'CCI' },
  { key: 'bb', label: 'BB %B' }, { key: 'funding', label: 'Funding' },
  { key: 'vwap', label: 'VWAP' }, { key: 'williamsR', label: 'W%R' },
  { key: 'mfi', label: 'MFI' }, { key: 'stochRsi', label: 'StochRSI' },
  { key: 'obv', label: 'OBV' },
] as const;

function brkdown(ind: any, price: number, funding: number) {
  const r: { key: string; label: string; s: 'buy' | 'sell' | 'neutral' }[] = [];
  r.push({ key: 'sma10', label: 'SMA 10', s: price > ind.sma10 ? 'buy' : 'sell' });
  r.push({ key: 'sma20', label: 'SMA 20', s: price > ind.sma20 ? 'buy' : 'sell' });
  r.push({ key: 'sma50', label: 'SMA 50', s: price > ind.sma50 ? 'buy' : 'sell' });
  r.push({ key: 'smaCross', label: 'SMA 10>20', s: ind.sma10 > ind.sma20 ? 'buy' : 'sell' });
  r.push({ key: 'smaCross2', label: 'SMA 20>50', s: ind.sma20 > ind.sma50 ? 'buy' : 'sell' });
  r.push({ key: 'rsi', label: 'RSI', s: ind.rsi14 < 30 ? 'buy' : ind.rsi14 > 70 ? 'sell' : ind.rsi14 > 50 ? 'buy' : 'sell' });
  r.push({ key: 'macd', label: 'MACD', s: ind.macdHist > 0 ? 'buy' : 'sell' });
  r.push({ key: 'stoch', label: 'Stoch', s: ind.stochK < 20 ? 'buy' : ind.stochK > 80 ? 'sell' : 'neutral' });
  r.push({ key: 'kdj', label: 'KDJ', s: ind.kdjJ < 20 ? 'buy' : ind.kdjJ > 80 ? 'sell' : 'neutral' });
  r.push({ key: 'cci', label: 'CCI', s: ind.cci < -100 ? 'buy' : ind.cci > 100 ? 'sell' : 'neutral' });
  r.push({ key: 'bb', label: 'BB %B', s: ind.bbPercentB < 0 ? 'buy' : ind.bbPercentB > 1 ? 'sell' : 'neutral' });
  r.push({ key: 'funding', label: 'Funding', s: funding < 0 ? 'buy' : funding > 0.01 ? 'neutral' : 'buy' });
  r.push({ key: 'vwap', label: 'VWAP', s: price > ind.vwap ? 'buy' : 'sell' });
  r.push({ key: 'williamsR', label: 'W%R', s: ind.williamsR < -80 ? 'buy' : ind.williamsR > -20 ? 'sell' : 'neutral' });
  r.push({ key: 'mfi', label: 'MFI', s: ind.mfi < 20 ? 'buy' : ind.mfi > 80 ? 'sell' : ind.mfi > 50 ? 'buy' : 'sell' });
  r.push({ key: 'stochRsi', label: 'StochRSI', s: ind.stochRsi < 0.2 ? 'buy' : ind.stochRsi > 0.8 ? 'sell' : 'neutral' });
  r.push({ key: 'obv', label: 'OBV', s: ind.obvTrend === 'rising' ? 'buy' : ind.obvTrend === 'falling' ? 'sell' : 'neutral' });
  return r;
}

const SignalGauge = memo(function SignalGauge({ data }: { data: any }) {
  const [exp, setExp] = useState(false);
  const sig = data.signal;
  const bull = sig.action === 'strong_buy' || sig.action === 'buy';
  const bear = sig.action === 'strong_sell' || sig.action === 'sell';
  const c = bull ? '#34D399' : bear ? '#F87171' : '#9CA3AF';
  const bgc = bull ? 'rgba(52,211,153,0.08)' : bear ? 'rgba(248,113,113,0.08)' : 'rgba(255,255,255,0.03)';
  const bdrc = bull ? 'rgba(52,211,153,0.2)' : bear ? 'rgba(248,113,113,0.2)' : 'rgba(255,255,255,0.08)';
  const stale = (Date.now() - data.lastUpdated) > 120_000;
  const brk = useMemo(() => brkdown(data.indicators, data.price, data.funding8h), [data]);

  return (
    <div style={{ borderRadius: 16, padding: exp ? '28px 32px 24px' : '28px 32px', background: bgc, border: `1px solid ${bdrc}`, opacity: stale ? 0.5 : 1, transition: 'all .3s' }}>
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
        <div className="flex items-center gap-5">
          <div style={{ width: 52, height: 52, borderRadius: 14, background: 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <TokenHYPE style={{ width: 32, height: 32 }} />
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 500, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 4, fontFamily: SF }}>Composite Signal · 17 indicators</div>
            <div style={{ fontSize: 32, fontWeight: 700, color: c, fontFamily: SF, letterSpacing: '-.03em', lineHeight: 1.05 }}>{sig.display}</div>
            <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', marginTop: 3, fontFamily: SF }}>{sig.summary}</div>
          </div>
        </div>
        <div className="flex items-center gap-5 w-full lg:w-auto">
          <div className="flex-1 lg:w-40">
            <div className="flex justify-between items-center mb-2">
              <span style={{ fontSize: 10, fontWeight: 600, color: '#F87171', fontFamily: SF }}>SELL</span>
              <span style={{ fontSize: 24, fontWeight: 700, fontFamily: MF, color: c }}>{sig.score}</span>
              <span style={{ fontSize: 10, fontWeight: 600, color: '#34D399', fontFamily: SF }}>BUY</span>
            </div>
            <div style={{ width: '100%', height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.08)' }}>
              <div style={{ height: '100%', width: `${sig.score}%`, background: c, borderRadius: 3, transition: 'width .7s ease' }} />
            </div>
          </div>
          <div className="flex gap-4">
            {[{ n: sig.buy, l: 'B', c: '#34D399' }, { n: sig.neutral, l: 'N', c: '#6B7280' }, { n: sig.sell, l: 'S', c: '#F87171' }].map(x => (
              <div key={x.l} className="text-center">
                <div style={{ fontSize: 16, fontWeight: 700, color: x.c, fontFamily: MF }}>{x.n}</div>
                <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', fontFamily: SF }}>{x.l}</div>
              </div>
            ))}
          </div>
          <button onClick={() => setExp(e => !e)} style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', fontSize: 11, fontWeight: 500, color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontFamily: SF }}>
            {exp ? 'Less' : 'Details'}
          </button>
        </div>
      </div>
      {exp && (
        <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 10, fontFamily: SF }}>Breakdown</div>
          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-9 gap-1.5">
            {brk.map(cr => (
              <div key={cr.key} style={{ borderRadius: 6, padding: '6px 8px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', fontFamily: SF }}>{cr.label}</span>
                <span style={{ fontSize: 9, fontWeight: 700, color: cr.s === 'buy' ? '#34D399' : cr.s === 'sell' ? '#F87171' : '#6B7280', fontFamily: SF }}>
                  {cr.s === 'buy' ? '▲' : cr.s === 'sell' ? '▼' : '—'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
});

/* ─── KEY METRICS ─── */
const KeyMetrics = memo(function KeyMetrics({ data, ind }: { data: any; ind: any }) {
  const m = [
    { l: 'RSI 14', v: ind.rsi14.toFixed(1), s: ind.rsi14 > 70 ? 'Overbought' : ind.rsi14 < 30 ? 'Oversold' : ind.rsi14 > 50 ? 'Bullish' : 'Bearish', c: ind.rsi14 > 70 ? '#F87171' : ind.rsi14 < 30 ? '#34D399' : '#9CA3AF', a: ind.rsi14 > 70 || ind.rsi14 < 30 },
    { l: 'VWAP', v: `$${ind.vwap.toFixed(2)}`, s: data.price > ind.vwap ? 'Price above' : 'Price below', c: data.price > ind.vwap ? '#34D399' : '#F87171', a: false },
    { l: 'Funding 8h', v: `${data.funding8h >= 0 ? '+' : ''}${data.funding8h.toFixed(2)}%`, s: data.fundingDirection, c: data.funding8h > 0.001 ? '#F87171' : data.funding8h < -0.001 ? '#34D399' : '#9CA3AF', a: Math.abs(data.funding8h) > 0.005 },
    { l: 'ATR (14)', v: `$${ind.atr.toFixed(2)}`, s: `Stop: $${ind.atrStop.toFixed(2)}`, c: '#FBBF24', a: false },
    { l: 'MFI', v: ind.mfi.toFixed(1), s: ind.mfi > 80 ? 'Overbought' : ind.mfi < 20 ? 'Oversold' : 'Neutral', c: ind.mfi > 80 ? '#F87171' : ind.mfi < 20 ? '#34D399' : '#9CA3AF', a: ind.mfi > 80 || ind.mfi < 20 },
    { l: 'L/S Ratio', v: data.smartMoney?.ratio ? (data.smartMoney?.longPct?.toFixed(1) + '% L / ' + data.smartMoney?.shortPct?.toFixed(1) + '% S') : '—', s: data.smartMoney ? (data.smartMoney.longPct > data.smartMoney.shortPct ? (data.smartMoney.longPct > 65 ? 'Crowded Longs ⚠️' : 'Longs dominant') : data.smartMoney.shortPct > 65 ? 'Squeeze setup 🔥' : 'Shorts dominant') : '—', c: data.smartMoney ? (data.smartMoney.longPct > data.smartMoney.shortPct ? '#34D399' : '#F87171') : '#9CA3AF', a: false },
  ];
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      {m.map(x => (
        <div key={x.l} style={{ borderRadius: 12, padding: '16px 18px', background: 'rgba(255,255,255,0.03)', border: x.a ? `1px solid ${x.c}30` : '1px solid rgba(255,255,255,0.06)', position: 'relative' }}>
          {x.a && <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: x.c, borderRadius: '12px 12px 0 0' }} />}
          <div style={{ fontSize: 10, fontWeight: 500, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8, fontFamily: SF }}>{x.l}</div>
          <div style={{ fontSize: x.a ? 22 : 20, fontWeight: 700, fontFamily: MF, color: x.a ? '#fff' : 'rgba(255,255,255,0.9)', letterSpacing: '-.01em' }}>{x.v}</div>
          <div style={{ fontSize: 11, fontWeight: 500, color: x.c, marginTop: 4, fontFamily: SF }}>{x.s}</div>
        </div>
      ))}
    </div>
  );
});
function lsL(d: any) { const r = d.derivatives?.longShortRatio?.ratio || 1; return r > 1.05 ? 'Longs dominant' : r < 0.95 ? 'Shorts dominant' : 'Balanced'; }
function lsC(d: any) { const r = d.derivatives?.longShortRatio?.ratio || 1; return r > 1.05 ? '#34D399' : r < 0.95 ? '#F87171' : '#9CA3AF'; }

/* ─── CHART + LIQUIDATION ─── */
const ChartSection = memo(function ChartSection({ data, tf, show, onToggle }: { data: any; tf: string; show: boolean; onToggle: () => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.06)' }}>
        <TradingViewChart
          timeframe={tf as Timeframe}
          srLevels={data.srLevels}
          liqZones={data.liqZones}
          smartMoneySignal={data.smartMoney?.signal}
        />
      </div>
      {data.liqZones.length > 0 && (
        <>
          <button onClick={onToggle} style={{ alignSelf: 'flex-start', padding: '6px 14px', borderRadius: 6, border: show ? '1px solid rgba(74,222,128,0.25)' : '1px solid rgba(255,255,255,0.08)', background: show ? 'rgba(74,222,128,0.06)' : 'rgba(255,255,255,0.02)', fontSize: 12, fontWeight: 500, color: show ? '#4ADE80' : 'rgba(255,255,255,0.4)', cursor: 'pointer', fontFamily: SF }}>
            {show ? 'Hide Levels' : 'Show Levels'}
          </button>
          {show && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {data.liqZones.filter((z: any) => z.side === 'long').map((z: any, i: number) => (
                <div key={`ll${i}`} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', borderRadius: 8, background: 'rgba(52,211,153,0.05)', border: '1px solid rgba(52,211,153,0.1)' }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#34D399' }} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#34D399', fontFamily: SF, width: 70 }}>Long Liq</span>
                  <span style={{ fontSize: 14, fontWeight: 600, fontFamily: MF, color: '#34D399' }}>${z.priceLow.toFixed(2)}–${z.priceHigh.toFixed(2)}</span>
                  <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', fontFamily: SF, flex: 1, textAlign: 'right' }}>-{((data.price - z.priceHigh) / data.price * 100).toFixed(1)}%</span>
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', fontFamily: SF }}>${(z.valueUsd / 1e6).toFixed(1)}M</span>
                </div>
              ))}
              {data.liqZones.filter((z: any) => z.side === 'short').map((z: any, i: number) => (
                <div key={`sl${i}`} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', borderRadius: 8, background: 'rgba(248,113,113,0.05)', border: '1px solid rgba(248,113,113,0.1)' }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#F87171' }} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#F87171', fontFamily: SF, width: 70 }}>Short Liq</span>
                  <span style={{ fontSize: 14, fontWeight: 600, fontFamily: MF, color: '#F87171' }}>${z.priceLow.toFixed(2)}–${z.priceHigh.toFixed(2)}</span>
                  <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', fontFamily: SF, flex: 1, textAlign: 'right' }}>+{((z.priceLow - data.price) / data.price * 100).toFixed(1)}%</span>
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', fontFamily: SF }}>${(z.valueUsd / 1e6).toFixed(1)}M</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
});

/* ─── PANELS ─── */
const Panels = memo(function Panels({ data, derivatives }: { data: any; derivatives: any }) {
  const dom = data.dominance;
  const hasDom = dom && dom.length >= 3;
  const hasSR = data.srLevels.resistances.length > 0 || data.srLevels.supports.length > 0;
  const hasSM = data.smartMoney;
  const fmt = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`;
  const fp = (n: number) => n >= 1000 ? `$${(n / 1000).toFixed(1)}k` : `$${n.toFixed(2)}`;
  const sm = data.smartMoney;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div style={{ borderRadius: 12, padding: '20px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ fontSize: 11, fontWeight: 500, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 14, fontFamily: SF }}>Smart Money</div>
        {hasSM ? (() => {
          const ratio = sm.ratio || 1;
          const longPct = sm.longPct || 50;
          const shortPct = sm.shortPct || 50;
          const signal = sm.signal || 'BALANCED';
          const netUsd = sm.netUsd || 0;
          const wallets = sm.wallets || [];
          const accent = signal === 'LONGS_DOMINANT' ? '#34D399' : signal === 'SHORTS_DOMINANT' ? '#F87171' : '#9CA3AF';
          const signalLabel = signal === 'LONGS_DOMINANT' ? 'Longs dominant ▲' : signal === 'SHORTS_DOMINANT' ? 'Shorts dominant ▼' : 'Balanced ◆';
          return (
            <>
              <div style={{ fontSize: 32, fontWeight: 700, fontFamily: MF, color: accent, letterSpacing: '-.02em', marginBottom: 6 }}>{ratio.toFixed(2)}</div>
              <div style={{ display: 'flex', height: 5, borderRadius: 3, overflow: 'hidden', background: 'rgba(248,113,113,0.12)', marginBottom: 6 }}>
                <div style={{ width: `${longPct}%`, background: 'rgba(52,211,153,0.6)' }} />
              </div>
              <div className="flex justify-between" style={{ marginBottom: 14 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#34D399', fontFamily: SF }}>L {longPct.toFixed(1)}%</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#F87171', fontFamily: SF }}>S {shortPct.toFixed(1)}%</span>
              </div>
              <div style={{ fontSize: 11, color: accent, fontFamily: SF, marginBottom: 10 }}>
                {signalLabel} — Net: {netUsd >= 0 ? '+' : ''}${(Math.abs(netUsd) / 1e6).toFixed(1)}M
              </div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', fontFamily: SF, marginBottom: 8 }}>
                Long: ${(sm.longUsd / 1e6).toFixed(1)}M ({sm.longCount} wallets) · Short: ${(sm.shortUsd / 1e6).toFixed(1)}M ({sm.shortCount} wallets)
              </div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', fontFamily: SF, marginBottom: 6 }}>Top Positions:</div>
              {wallets.slice(0, 5).map((w: any, i: number) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontFamily: MF, marginBottom: 4 }}>
                  <span style={{ color: w.direction === 'LONG' ? '#34D399' : '#F87171' }}>
                    {w.direction} ${(w.sizeUsd / 1e6).toFixed(1)}M {w.leverage}x
                  </span>
                  <span style={{ color: w.unrealizedPnl >= 0 ? '#34D399' : '#F87171' }}>
                    {w.unrealizedPnl >= 0 ? '+' : ''}${(w.unrealizedPnl / 1e6).toFixed(1)}M
                  </span>
                </div>
              ))}
            </>
          );
        })() : <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)', fontFamily: SF, padding: '24px 0' }}>Loading…</div>}
      </div>

      <div style={{ borderRadius: 12, padding: '20px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ fontSize: 11, fontWeight: 500, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 14, fontFamily: SF }}>vs Market</div>
        {hasDom ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[{ d: dom[0], I: TokenHYPE, h: '#4ADE80' }, { d: dom[1], I: TokenBTC, h: '#F59E0B' }, { d: dom[2], I: TokenETH, h: '#60A5FA' }].map(c => (
              <div key={c.d.symbol} style={{ borderRadius: 8, padding: '10px 12px', background: `${c.h}08`, border: `1px solid ${c.h}18` }}>
                <div className="flex items-center justify-between" style={{ marginBottom: 4 }}>
                  <div className="flex items-center gap-2">
                    <c.I style={{ width: 16, height: 16, borderRadius: 4 }} />
                    <span style={{ fontSize: 13, fontWeight: 600, color: c.h, fontFamily: SF }}>{c.d.symbol}</span>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 500, fontFamily: MF, color: 'rgba(255,255,255,0.5)' }}>{fp(c.d.price)}</span>
                </div>
                <div className="flex gap-4">
                  {(['24h', '7d', '30d'] as const).map(p => {
                    const v = p === '24h' ? c.d.change24h : p === '7d' ? c.d.change7d : c.d.change30d;
                    return (
                      <div key={p} style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.2)', fontFamily: SF }}>{p}</div>
                        <div style={{ fontSize: 12, fontWeight: 600, fontFamily: MF, color: v >= 0 ? '#34D399' : '#F87171' }}>{fmt(v)}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        ) : <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)', fontFamily: SF, padding: '24px 0' }}>Loading…</div>}
      </div>

      <div style={{ borderRadius: 12, padding: '20px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ fontSize: 11, fontWeight: 500, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 14, fontFamily: SF }}>Support / Resistance</div>
        {hasSR ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {data.srLevels.resistances.map((r: any, i: number) => (
              <div key={`r${i}`} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span style={{ width: 20, height: 20, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: '#F87171', background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.15)', fontFamily: SF }}>R{i + 1}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, fontFamily: MF, color: '#F87171' }}>${r.price.toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 48, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${r.strength}%`, background: '#F87171', borderRadius: 2 }} />
                  </div>
                  <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', fontFamily: SF, width: 28, textAlign: 'right' }}>{r.strength}%</span>
                </div>
              </div>
            ))}
            {data.srLevels.supports.map((s: any, i: number) => (
              <div key={`s${i}`} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span style={{ width: 20, height: 20, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: '#34D399', background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.15)', fontFamily: SF }}>S{i + 1}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, fontFamily: MF, color: '#34D399' }}>${s.price.toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 48, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${s.strength}%`, background: '#34D399', borderRadius: 2 }} />
                  </div>
                  <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', fontFamily: SF, width: 28, textAlign: 'right' }}>{s.strength}%</span>
                </div>
              </div>
            ))}
          </div>
        ) : <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)', fontFamily: SF, padding: '24px 0' }}>No levels</div>}
      </div>
    </div>
  );
});

/* ─── SIGNAL GAUGE ─── */

/* ─── ALL INDICATORS ─── */
const AllIndicators = memo(function AllIndicators({ ind, price, tf }: { ind: any; price: number; tf: string }) {
  const [open, setOpen] = useState(false);
  const rows = [
    { l: 'SMA 10', v: `$${ind.sma10.toFixed(2)}`, s: price > ind.sma10 ? 'Above' : 'Below', c: price > ind.sma10 ? '#34D399' : '#F87171' },
    { l: 'SMA 20', v: `$${ind.sma20.toFixed(2)}`, s: price > ind.sma20 ? 'Above' : 'Below', c: price > ind.sma20 ? '#34D399' : '#F87171' },
    { l: 'SMA 50', v: `$${ind.sma50.toFixed(2)}`, s: price > ind.sma50 ? 'Above' : 'Below', c: price > ind.sma50 ? '#34D399' : '#F87171' },
    { l: 'MACD', v: ind.macd.toFixed(4), s: `Sig ${ind.macdSignal.toFixed(3)}`, c: ind.macdHist > 0 ? '#34D399' : '#F87171' },
    { l: 'Stoch K', v: ind.stochK.toFixed(1), s: `D ${ind.stochD.toFixed(1)}`, c: ind.stochK > 80 ? '#F87171' : ind.stochK < 20 ? '#34D399' : '#9CA3AF' },
    { l: 'KDJ J', v: ind.kdjJ.toFixed(1), s: `K ${ind.kdjK.toFixed(1)}`, c: ind.kdjJ > 80 ? '#F87171' : ind.kdjJ < 20 ? '#34D399' : '#9CA3AF' },
    { l: 'CCI', v: ind.cci.toFixed(1), s: ind.cci > 100 ? 'OB' : ind.cci < -100 ? 'OS' : 'N', c: ind.cci > 100 ? '#F87171' : ind.cci < -100 ? '#34D399' : '#9CA3AF' },
    { l: 'ADX', v: ind.adx.toFixed(1), s: ind.adx > 25 ? 'Trend' : 'Range', c: ind.adx > 25 ? '#FBBF24' : '#6B7280' },
    { l: 'BB %B', v: ind.bbPercentB.toFixed(3), s: '', c: ind.bbPercentB > 1 ? '#F87171' : ind.bbPercentB < 0 ? '#34D399' : '#9CA3AF' },
    { l: 'Williams %R', v: ind.williamsR.toFixed(1), s: '', c: ind.williamsR < -80 ? '#34D399' : ind.williamsR > -20 ? '#F87171' : '#9CA3AF' },
    { l: 'StochRSI', v: ind.stochRsi.toFixed(3), s: '', c: ind.stochRsi > 0.8 ? '#F87171' : ind.stochRsi < 0.2 ? '#34D399' : '#9CA3AF' },
    { l: 'OBV', v: ind.obvTrend, s: '', c: ind.obvTrend === 'rising' ? '#34D399' : ind.obvTrend === 'falling' ? '#F87171' : '#6B7280' },
  ];
  return (
    <div style={{ borderRadius: 10, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', overflow: 'hidden' }}>
      <button onClick={() => setOpen(o => !o)} style={{ width: '100%', padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'none', border: 'none', cursor: 'pointer' }}>
        <span style={{ fontSize: 10, fontWeight: 500, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '.06em', fontFamily: SF }}>All Indicators · {tf}</span>
        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', fontFamily: SF }}>{open ? 'Hide' : 'Show'}</span>
      </button>
      {open && (
        <div style={{ padding: '0 16px 12px' }}>
          {rows.map((r, i) => (
            <div key={r.l} className="flex items-center justify-between" style={{ padding: '6px 0', borderBottom: i < rows.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontFamily: SF }}>{r.l}</span>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: 12, fontWeight: 600, fontFamily: MF, color: r.c }}>{r.v}</span>
                {r.s && <span style={{ fontSize: 9, marginLeft: 6, color: 'rgba(255,255,255,0.2)', fontFamily: SF }}>{r.s}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
});

/* ─── MAIN ─── */
export default function Home() {
  const { data, derivatives, loading, error, tf, fetchCount, refetch } = useMarketData('4h');
  const [now, setNow] = useState(Date.now());
  const [showLiq, setShowLiq] = useState(false);
  useEffect(() => { const i = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(i); }, []);

  if (loading) return (
    <div className="ambient-bg">
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
        <div className="spin" style={{ width: 28, height: 28, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.08)', borderTopColor: '#4ADE80' }} />
        <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.3)', fontFamily: SF }}>Loading…</p>
      </div>
    </div>
  );
  if (error && !data) return (
    <div className="ambient-bg">
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 }}>
        <div style={{ fontSize: 32 }}>⚠️</div>
        <div style={{ fontSize: 16, fontWeight: 600, color: '#F87171', fontFamily: SF }}>Connection Error</div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)', fontFamily: SF }}>{error}</div>
        <button onClick={() => refetch()} style={{ marginTop: 8, padding: '8px 20px', borderRadius: 8, border: '1px solid rgba(74,222,128,0.2)', background: 'rgba(74,222,128,0.08)', fontSize: 13, fontWeight: 600, color: '#4ADE80', cursor: 'pointer', fontFamily: SF }}>Retry</button>
      </div>
    </div>
  );
  if (!data) return null;

  const stale = isStale(data.lastUpdated);
  const ind = data.indicators;
  const tsu = Math.floor((now - data.lastUpdated) / 1000);

  return (
    <div className="ambient-bg">
      <TooltipOverlay />
      <header style={{ position: 'sticky', top: 0, zIndex: 50, background: 'rgba(8,12,10,0.85)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 20px', height: 48, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div className="flex items-center gap-3">
            <TokenHYPE style={{ width: 22, height: 22, borderRadius: 5 }} />
            <span style={{ fontSize: 13, fontWeight: 600, fontFamily: SF }}>HYPE</span>
            <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)', fontFamily: SF }}>Monitor</span>
            <span style={{ fontSize: 9, fontWeight: 500, padding: '2px 8px', borderRadius: 999, color: stale ? '#F87171' : '#4ADE80', border: `1px solid ${stale ? 'rgba(248,113,113,0.2)' : 'rgba(74,222,128,0.2)'}`, fontFamily: SF }}>
              {stale ? `Stale ${tsu}s` : '● Live'}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 16, fontWeight: 700, fontFamily: MF }}>${data.price.toFixed(2)}</div>
              <div style={{ fontSize: 11, fontWeight: 500, color: data.change24h >= 0 ? '#34D399' : '#F87171', fontFamily: SF }}>
                {data.change24h >= 0 ? '+' : ''}{data.change24h.toFixed(2)}% <span style={{ color: 'rgba(255,255,255,0.2)' }}>24h</span>
              </div>
            </div>
            <button onClick={() => refetch()} style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="rgba(255,255,255,0.4)" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: 1200, margin: '0 auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <SignalGauge data={data} />
        <KeyMetrics data={data} ind={ind} />
        <ChartSection data={data} tf={tf} show={showLiq} onToggle={() => setShowLiq(v => !v)} />
        <Panels data={data} derivatives={derivatives} />
        <div className="grid grid-cols-3 gap-3">
          {(['24h', '7d', '30d'] as const).map(p => {
            const v = p === '24h' ? data.change24h : p === '7d' ? data.change7d : data.change30d;
            return (
              <div key={p} style={{ borderRadius: 10, padding: '14px 18px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4, fontFamily: SF }}>{p}</div>
                <div style={{ fontSize: 16, fontWeight: 700, fontFamily: MF, color: v >= 0 ? '#34D399' : '#F87171' }}>{fmtPct(v)}</div>
              </div>
            );
          })}
        </div>
        <AllIndicators ind={ind} price={data.price} tf={data.timeframe.toUpperCase()} />
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.12)', display: 'flex', justifyContent: 'space-between', fontFamily: SF }}>
          <span>HL API · {fetchCount} fetches</span>
          <span>{tsu < 60 ? `${tsu}s ago` : `${Math.floor(tsu / 60)}m ago`}</span>
        </div>
      </main>
    </div>
  );
}
