'use client';

import { useState, useEffect, useMemo, memo } from 'react';
import { TokenHYPE, TokenBTC, TokenETH } from '@web3icons/react';
import { useMarketData } from '../hooks/useMarketData';
import TradingViewChart from '../components/chart/TradingViewChart';
import { fmtPct, isStale } from '../lib/format';
import type { Timeframe } from '../types';

const MF = "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, monospace";
const SF = "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', Arial, sans-serif";

/* ═══════════════════════════════════════════
   TOOLTIP
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
    const h = () => {
      if (tooltipState.show) setPos({ x: tooltipState.x, y: tooltipState.y, show: true, text: tooltipState.text });
      else setPos(p => ({ ...p, show: false }));
    };
    window.addEventListener('mousemove', h);
    return () => window.removeEventListener('mousemove', h);
  }, []);
  if (!pos.show) return null;
  return (
    <div className="tooltip-bubble" style={{ position: 'fixed', left: pos.x, top: pos.y - 16, transform: 'translate(-50%, -100%)', zIndex: 9999 }}>
      {pos.text}
    </div>
  );
}

/* ═══════════════════════════════════════════
   SIGNAL GAUGE — Hero
   ═══════════════════════════════════════════ */
const CRITERIA = [
  { key: 'sma10', label: 'Price > SMA 10' }, { key: 'sma20', label: 'Price > SMA 20' },
  { key: 'sma50', label: 'Price > SMA 50' }, { key: 'smaCross', label: 'SMA 10 > 20' },
  { key: 'smaCross2', label: 'SMA 20 > 50' }, { key: 'rsi', label: 'RSI 14' },
  { key: 'macd', label: 'MACD Hist' }, { key: 'stoch', label: 'Stochastic' },
  { key: 'kdj', label: 'KDJ J' }, { key: 'cci', label: 'CCI' },
  { key: 'bb', label: 'BB %B' }, { key: 'funding', label: 'Funding' },
  { key: 'vwap', label: 'VWAP' }, { key: 'williamsR', label: 'Williams %R' },
  { key: 'mfi', label: 'MFI' }, { key: 'stochRsi', label: 'StochRSI' },
  { key: 'obv', label: 'OBV Trend' },
] as const;

function computeCriteriaBreakdown(ind: any, price: number, funding: number) {
  const r: { key: string; label: string; signal: 'buy' | 'sell' | 'neutral' }[] = [];
  r.push({ key: 'sma10', label: 'Price > SMA 10', signal: price > ind.sma10 ? 'buy' : 'sell' });
  r.push({ key: 'sma20', label: 'Price > SMA 20', signal: price > ind.sma20 ? 'buy' : 'sell' });
  r.push({ key: 'sma50', label: 'Price > SMA 50', signal: price > ind.sma50 ? 'buy' : 'sell' });
  r.push({ key: 'smaCross', label: 'SMA 10 > 20', signal: ind.sma10 > ind.sma20 ? 'buy' : 'sell' });
  r.push({ key: 'smaCross2', label: 'SMA 20 > 50', signal: ind.sma20 > ind.sma50 ? 'buy' : 'sell' });
  r.push({ key: 'rsi', label: 'RSI 14', signal: ind.rsi14 < 30 ? 'buy' : ind.rsi14 > 70 ? 'sell' : ind.rsi14 > 50 ? 'buy' : 'sell' });
  r.push({ key: 'macd', label: 'MACD Hist', signal: ind.macdHist > 0 ? 'buy' : 'sell' });
  r.push({ key: 'stoch', label: 'Stochastic', signal: ind.stochK < 20 ? 'buy' : ind.stochK > 80 ? 'sell' : 'neutral' });
  r.push({ key: 'kdj', label: 'KDJ J', signal: ind.kdjJ < 20 ? 'buy' : ind.kdjJ > 80 ? 'sell' : 'neutral' });
  r.push({ key: 'cci', label: 'CCI', signal: ind.cci < -100 ? 'buy' : ind.cci > 100 ? 'sell' : 'neutral' });
  r.push({ key: 'bb', label: 'BB %B', signal: ind.bbPercentB < 0 ? 'buy' : ind.bbPercentB > 1 ? 'sell' : 'neutral' });
  r.push({ key: 'funding', label: 'Funding', signal: funding < 0 ? 'buy' : funding > 0.01 ? 'neutral' : 'buy' });
  r.push({ key: 'vwap', label: 'VWAP', signal: price > ind.vwap ? 'buy' : 'sell' });
  r.push({ key: 'williamsR', label: 'Williams %R', signal: ind.williamsR < -80 ? 'buy' : ind.williamsR > -20 ? 'sell' : 'neutral' });
  r.push({ key: 'mfi', label: 'MFI', signal: ind.mfi < 20 ? 'buy' : ind.mfi > 80 ? 'sell' : ind.mfi > 50 ? 'buy' : 'sell' });
  r.push({ key: 'stochRsi', label: 'StochRSI', signal: ind.stochRsi < 0.2 ? 'buy' : ind.stochRsi > 0.8 ? 'sell' : 'neutral' });
  r.push({ key: 'obv', label: 'OBV Trend', signal: ind.obvTrend === 'rising' ? 'buy' : ind.obvTrend === 'falling' ? 'sell' : 'neutral' });
  return r;
}

const SignalGauge = memo(function SignalGauge({ data }: { data: any }) {
  const [expanded, setExpanded] = useState(false);
  const sig = data.signal;
  const bull = sig.action === 'strong_buy' || sig.action === 'buy';
  const bear = sig.action === 'strong_sell' || sig.action === 'sell';
  const stale = (Date.now() - data.lastUpdated) > 120_000;
  const c = bull ? '#34D399' : bear ? '#F87171' : 'rgba(255,255,255,0.35)';
  const bg = bull ? 'rgba(52,211,153,0.06)' : bear ? 'rgba(248,113,113,0.06)' : 'rgba(255,255,255,0.03)';
  const borderC = bull ? 'rgba(52,211,153,0.15)' : bear ? 'rgba(248,113,113,0.15)' : 'rgba(255,255,255,0.06)';
  const breakdown = useMemo(() => computeCriteriaBreakdown(data.indicators, data.price, data.funding8h), [data]);

  return (
    <div className="glass-2" style={{ borderRadius: 20, padding: expanded ? '28px 32px 24px' : '28px 32px', background: bg, borderColor: borderC, opacity: stale ? 0.5 : 1, transition: 'all .3s' }}>
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
        <div className="flex items-center gap-5">
          <div className="glass-3" style={{ width: 56, height: 56, borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <TokenHYPE style={{ width: 36, height: 36 }} />
          </div>
          <div>
            <div style={{ fontSize: 10, letterSpacing: '.1em', fontWeight: 500, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', marginBottom: 4, fontFamily: SF }}>
              Composite Signal · 17 Indicators
            </div>
            <div style={{ fontWeight: 700, fontSize: 32, letterSpacing: '-.03em', color: c, fontFamily: SF, lineHeight: 1.05 }}>{sig.display}</div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', marginTop: 2, fontFamily: SF }}>{sig.summary}</div>
          </div>
        </div>
        <div className="flex items-center gap-5 w-full lg:w-auto">
          <div className="flex-1 lg:w-44">
            <div className="flex justify-between items-center mb-2">
              <span style={{ fontSize: 9, fontWeight: 600, color: '#F87171', letterSpacing: '.08em', fontFamily: SF }}>SELL</span>
              <span style={{ fontSize: 24, fontWeight: 800, fontFamily: MF, color: c }}>{sig.score}</span>
              <span style={{ fontSize: 9, fontWeight: 600, color: '#34D399', letterSpacing: '.08em', fontFamily: SF }}>BUY</span>
            </div>
            <div style={{ width: '100%', height: 5, borderRadius: 3, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${sig.score}%`, background: c, borderRadius: 3, transition: 'width .7s ease' }} />
            </div>
          </div>
          <div className="flex gap-4">
            {[{ n: sig.buy, l: 'Buy', c: '#34D399' }, { n: sig.neutral, l: 'Neut', c: 'rgba(255,255,255,0.25)' }, { n: sig.sell, l: 'Sell', c: '#F87171' }].map(s => (
              <div key={s.l} className="text-center">
                <div style={{ fontSize: 16, fontWeight: 800, color: s.c, fontFamily: MF }}>{s.n}</div>
                <div style={{ fontSize: 7, fontWeight: 600, color: 'rgba(255,255,255,0.15)', letterSpacing: '.1em', textTransform: 'uppercase', fontFamily: SF }}>{s.l}</div>
              </div>
            ))}
          </div>
          <button onClick={() => setExpanded(e => !e)} className="glass" style={{ padding: '6px 14px', borderRadius: 8, fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,0.4)', cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: SF }}>
            {expanded ? 'Less' : 'Details'}
          </button>
        </div>
      </div>
      {expanded && (
        <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.25)', marginBottom: 10, fontFamily: SF }}>
            Breakdown · {breakdown.length} Criteria
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2">
            {breakdown.map(cr => (
              <div key={cr.key} className="glass" style={{ borderRadius: 8, padding: '7px 9px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 9, fontWeight: 500, color: 'rgba(255,255,255,0.45)', fontFamily: SF }}>{cr.label}</span>
                <span style={{ fontSize: 8, fontWeight: 700, padding: '1px 6px', borderRadius: 3, background: cr.signal === 'buy' ? 'rgba(52,211,153,0.15)' : cr.signal === 'sell' ? 'rgba(248,113,113,0.15)' : 'rgba(255,255,255,0.06)', color: cr.signal === 'buy' ? '#34D399' : cr.signal === 'sell' ? '#F87171' : 'rgba(255,255,255,0.25)', fontFamily: SF }}>
                  {cr.signal === 'buy' ? '▲' : cr.signal === 'sell' ? '▼' : '—'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
});

/* ═══════════════════════════════════════════
   KEY METRICS
   ═══════════════════════════════════════════ */
const KeyMetrics = memo(function KeyMetrics({ data, ind }: { data: any; ind: any }) {
  const metrics = [
    { label: 'RSI 14', value: ind.rsi14.toFixed(1), sub: ind.rsi14 > 70 ? 'Overbought' : ind.rsi14 < 30 ? 'Oversold' : ind.rsi14 > 50 ? 'Bullish' : 'Bearish', subColor: ind.rsi14 > 70 ? '#F87171' : ind.rsi14 < 30 ? '#34D399' : 'rgba(255,255,255,0.35)', alert: ind.rsi14 > 70 || ind.rsi14 < 30 },
    { label: 'VWAP', value: `$${ind.vwap.toFixed(2)}`, sub: data.price > ind.vwap ? 'Above ↑' : 'Below ↓', subColor: data.price > ind.vwap ? '#34D399' : '#F87171', alert: false },
    { label: 'Funding 8h', value: `${data.funding8h >= 0 ? '+' : ''}${data.funding8h.toFixed(4)}%`, sub: `Ann. ${data.fundingAnn.toFixed(1)}%`, subColor: data.funding8h > 0 ? '#F87171' : '#34D399', alert: Math.abs(data.funding8h) > 0.005 },
    { label: 'ATR (14)', value: `$${ind.atr.toFixed(2)}`, sub: `Stop: $${ind.atrStop.toFixed(2)}`, subColor: '#FBBF24', alert: false },
    { label: 'MFI', value: ind.mfi.toFixed(1), sub: ind.mfi > 80 ? 'OB' : ind.mfi < 20 ? 'OS' : 'Mid', subColor: ind.mfi > 80 ? '#F87171' : ind.mfi < 20 ? '#34D399' : 'rgba(255,255,255,0.35)', alert: ind.mfi > 80 || ind.mfi < 20 },
    { label: 'L/S Ratio', value: (derivatives_ratio(data) || 1).toFixed(2), sub: lsLabel(data), subColor: lsColor(data), alert: false },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      {metrics.map(m => (
        <div key={m.label} className="glass" style={{ borderRadius: 12, padding: '14px 16px', position: 'relative', overflow: 'hidden' }}>
          {m.alert && <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: m.subColor }} />}
          <div style={{ fontSize: 8, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.2)', marginBottom: 6, fontFamily: SF }}>{m.label}</div>
          <div style={{ fontSize: 18, fontWeight: 700, fontFamily: MF, color: '#fff', letterSpacing: '-.01em' }}>{m.value}</div>
          <div style={{ fontSize: 9, fontWeight: 600, color: m.subColor, marginTop: 2, fontFamily: SF }}>{m.sub}</div>
        </div>
      ))}
    </div>
  );
});

function derivatives_ratio(data: any) { return data.derivatives?.longShortRatio?.ratio; }
function lsLabel(data: any) { const r = derivatives_ratio(data) || 1; return r > 1 ? 'Longs dominant' : r < 1 ? 'Shorts dominant' : 'Neutral'; }
function lsColor(data: any) { const r = derivatives_ratio(data) || 1; return r > 1.02 ? '#34D399' : r < 0.98 ? '#F87171' : 'rgba(255,255,255,0.35)'; }

/* ═══════════════════════════════════════════
   CHART + LIQUIDATION LEVELS
   ═══════════════════════════════════════════ */
const ChartSection = memo(function ChartSection({ data, tf, showLevels, onToggleLevels }: { data: any; tf: string; showLevels: boolean; onToggleLevels: () => void }) {
  const hasLiqs = data.liqZones.length > 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Chart */}
      <div className="glass-2" style={{ borderRadius: 16, overflow: 'hidden' }}>
        <TradingViewChart timeframe={tf as Timeframe} />
      </div>

      {/* Show Levels button */}
      {hasLiqs && (
        <button
          onClick={onToggleLevels}
          className="glass"
          style={{ alignSelf: 'flex-start', padding: '6px 14px', borderRadius: 8, fontSize: 10, fontWeight: 600, color: showLevels ? '#4ADE80' : 'rgba(255,255,255,0.35)', cursor: 'pointer', fontFamily: SF, border: showLevels ? '1px solid rgba(74,222,128,0.2)' : undefined, transition: 'all .2s' }}
        >
          {showLevels ? 'Hide Levels' : 'Show Levels'}
        </button>
      )}

      {/* Liquidation levels display */}
      {showLevels && hasLiqs && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {data.liqZones.filter((z: any) => z.side === 'long').map((z: any, i: number) => {
            const dist = ((data.price - z.priceHigh) / data.price * 100);
            return (
              <div key={`ll-${i}`} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', borderRadius: 10, background: 'rgba(52,211,153,0.05)', border: '1px solid rgba(52,211,153,0.12)' }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#34D399', flexShrink: 0 }} />
                <span style={{ fontSize: 10, fontWeight: 600, color: '#34D399', fontFamily: SF, width: 60 }}>Long Liq</span>
                <span style={{ fontSize: 11, fontWeight: 700, fontFamily: MF, color: '#34D399' }}>${z.priceLow.toFixed(2)} – ${z.priceHigh.toFixed(2)}</span>
                <span style={{ fontSize: 9, fontWeight: 600, color: 'rgba(255,255,255,0.25)', flex: 1, textAlign: 'right', fontFamily: SF }}>-{dist.toFixed(1)}%</span>
                <span style={{ fontSize: 9, fontWeight: 600, color: 'rgba(255,255,255,0.2)', fontFamily: SF }}>${(z.valueUsd / 1e6).toFixed(1)}M</span>
              </div>
            );
          })}
          {data.liqZones.filter((z: any) => z.side === 'short').map((z: any, i: number) => {
            const dist = ((z.priceLow - data.price) / data.price * 100);
            return (
              <div key={`sl-${i}`} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', borderRadius: 10, background: 'rgba(248,113,113,0.05)', border: '1px solid rgba(248,113,113,0.12)' }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#F87171', flexShrink: 0 }} />
                <span style={{ fontSize: 10, fontWeight: 600, color: '#F87171', fontFamily: SF, width: 60 }}>Short Liq</span>
                <span style={{ fontSize: 11, fontWeight: 700, fontFamily: MF, color: '#F87171' }}>${z.priceLow.toFixed(2)} – ${z.priceHigh.toFixed(2)}</span>
                <span style={{ fontSize: 9, fontWeight: 600, color: 'rgba(255,255,255,0.25)', flex: 1, textAlign: 'right', fontFamily: SF }}>+{dist.toFixed(1)}%</span>
                <span style={{ fontSize: 9, fontWeight: 600, color: 'rgba(255,255,255,0.2)', fontFamily: SF }}>${(z.valueUsd / 1e6).toFixed(1)}M</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
});

/* ═══════════════════════════════════════════
   BELOW-CHART PANELS — 3 columns
   ═══════════════════════════════════════════ */
const BelowChartPanels = memo(function BelowChartPanels({ data, ind }: { data: any; ind: any }) {
  const dom = data.dominance;
  const hasDom = dom && dom.length >= 3;
  const hasSR = data.srLevels.resistances.length > 0 || data.srLevels.supports.length > 0;
  const hasSmartMoney = data.derivatives?.longShortRatio?.ratio;
  const fmt = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`;
  const fp = (n: number) => n >= 1000 ? `$${(n / 1000).toFixed(1)}k` : `$${n.toFixed(2)}`;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* Smart Money */}
      <div className="glass" style={{ borderRadius: 14, padding: '16px' }}>
        <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.2)', marginBottom: 12, fontFamily: SF }}>Smart Money</div>
        {hasSmartMoney ? (() => {
          const ls = data.derivatives.longShortRatio;
          const ratio = ls.ratio || 1;
          const longPct = ls.longPct ?? (ratio / (1 + ratio) * 100);
          const shortPct = ls.shortPct ?? (100 - longPct);
          const isLong = ratio > 1;
          const accent = Math.abs(ratio - 1) < 0.01 ? '#FBBF24' : isLong ? '#34D399' : '#F87171';
          const oi = data.derivatives.openInterest;
          const fund = data.derivatives.funding;
          return (
            <>
              <div style={{ fontSize: 24, fontWeight: 800, fontFamily: MF, color: accent, letterSpacing: '-.02em', marginBottom: 4 }}>{ratio.toFixed(2)}</div>
              <div style={{ display: 'flex', height: 4, borderRadius: 2, overflow: 'hidden', background: 'rgba(248,113,113,0.1)', marginBottom: 4 }}>
                <div style={{ width: `${longPct}%`, background: isLong ? 'rgba(52,211,153,0.5)' : 'rgba(52,211,153,0.2)' }} />
              </div>
              <div className="flex justify-between" style={{ marginBottom: 10 }}>
                <span style={{ fontSize: 9, fontWeight: 700, color: '#34D399', fontFamily: SF }}>L {longPct.toFixed(1)}%</span>
                <span style={{ fontSize: 9, fontWeight: 700, color: '#F87171', fontFamily: SF }}>S {shortPct.toFixed(1)}%</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div style={{ borderRadius: 8, padding: 8, background: 'rgba(255,255,255,0.03)' }}>
                  <div style={{ fontSize: 7, fontWeight: 600, color: 'rgba(255,255,255,0.2)', textTransform: 'uppercase', fontFamily: SF }}>OI</div>
                  <div style={{ fontSize: 11, fontWeight: 700, fontFamily: MF, color: 'rgba(255,255,255,0.8)' }}>${(oi.oiUsd / 1e6).toFixed(1)}M</div>
                </div>
                <div style={{ borderRadius: 8, padding: 8, background: 'rgba(255,255,255,0.03)' }}>
                  <div style={{ fontSize: 7, fontWeight: 600, color: 'rgba(255,255,255,0.2)', textTransform: 'uppercase', fontFamily: SF }}>Funding</div>
                  <div style={{ fontSize: 11, fontWeight: 700, fontFamily: MF, color: (fund.current1h || 0) >= 0 ? '#F87171' : '#34D399' }}>{(fund.current1h || 0).toFixed(4)}%</div>
                </div>
              </div>
              <div style={{ fontSize: 8, fontWeight: 600, color: 'rgba(255,255,255,0.2)', marginTop: 6, fontFamily: SF }}>
                Delta: <span style={{ color: (ls.delta24h || 0) >= 0 ? '#34D399' : '#F87171' }}>{(ls.delta24h || 0) >= 0 ? '+' : ''}${(Math.abs(ls.delta24h || 0) / 1e6).toFixed(1)}M</span>
              </div>
            </>
          );
        })() : (
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)', fontFamily: SF }}>Loading…</div>
        )}
      </div>

      {/* vs Market */}
      <div className="glass" style={{ borderRadius: 14, padding: '16px' }}>
        <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.2)', marginBottom: 12, fontFamily: SF }}>vs Market</div>
        {hasDom ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              { d: dom[0], Icon: TokenHYPE, hex: '#4ADE80' },
              { d: dom[1], Icon: TokenBTC, hex: '#F59E0B' },
              { d: dom[2], Icon: TokenETH, hex: '#60A5FA' },
            ].map(c => (
              <div key={c.d.symbol} style={{ borderRadius: 8, padding: 8, background: `${c.hex}08`, border: `1px solid ${c.hex}15` }}>
                <div className="flex items-center justify-between" style={{ marginBottom: 4 }}>
                  <div className="flex items-center gap-1.5">
                    <c.Icon style={{ width: 14, height: 14, borderRadius: 3 }} />
                    <span style={{ fontSize: 10, fontWeight: 700, color: c.hex, fontFamily: SF }}>{c.d.symbol}</span>
                  </div>
                  <span style={{ fontSize: 9, fontWeight: 600, fontFamily: MF, color: 'rgba(255,255,255,0.4)' }}>{fp(c.d.price)}</span>
                </div>
                <div className="flex gap-3">
                  {(['24h', '7d', '30d'] as const).map(p => {
                    const v = p === '24h' ? c.d.change24h : p === '7d' ? c.d.change7d : c.d.change30d;
                    return (
                      <div key={p} style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 7, fontWeight: 600, color: 'rgba(255,255,255,0.12)', fontFamily: SF }}>{p}</div>
                        <div style={{ fontSize: 9, fontWeight: 700, fontFamily: MF, color: v >= 0 ? '#34D399' : '#F87171' }}>{fmt(v)}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)', fontFamily: SF }}>Loading…</div>
        )}
      </div>

      {/* S/R */}
      <div className="glass" style={{ borderRadius: 14, padding: '16px' }}>
        <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.2)', marginBottom: 12, fontFamily: SF }}>S / R</div>
        {hasSR ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {data.srLevels.resistances.map((r: any, i: number) => (
              <div key={`r${i}`} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span style={{ width: 16, height: 16, borderRadius: 3, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 7, fontWeight: 800, color: '#F87171', background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.12)', fontFamily: SF }}>R{i + 1}</span>
                  <span style={{ fontSize: 10, fontWeight: 700, fontFamily: MF, color: '#F87171' }}>${r.price.toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <div style={{ width: 32, height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.05)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${r.strength}%`, background: '#F87171', borderRadius: 2 }} />
                  </div>
                  <span style={{ fontSize: 8, fontWeight: 600, color: 'rgba(255,255,255,0.15)', fontFamily: SF, width: 20, textAlign: 'right' }}>{r.strength}%</span>
                </div>
              </div>
            ))}
            {data.srLevels.supports.map((s: any, i: number) => (
              <div key={`s${i}`} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span style={{ width: 16, height: 16, borderRadius: 3, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 7, fontWeight: 800, color: '#34D399', background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.12)', fontFamily: SF }}>S{i + 1}</span>
                  <span style={{ fontSize: 10, fontWeight: 700, fontFamily: MF, color: '#34D399' }}>${s.price.toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <div style={{ width: 32, height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.05)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${s.strength}%`, background: '#34D399', borderRadius: 2 }} />
                  </div>
                  <span style={{ fontSize: 8, fontWeight: 600, color: 'rgba(255,255,255,0.15)', fontFamily: SF, width: 20, textAlign: 'right' }}>{s.strength}%</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)', fontFamily: SF }}>No levels found</div>
        )}
      </div>
    </div>
  );
});

/* ═══════════════════════════════════════════
   SECONDARY INDICATORS — Collapsed
   ═══════════════════════════════════════════ */
const SecondaryIndicators = memo(function SecondaryIndicators({ ind, price, tf }: { ind: any; price: number; tf: string }) {
  const [open, setOpen] = useState(false);
  const rows = [
    { l: 'SMA 10', v: `$${ind.sma10.toFixed(2)}`, s: price > ind.sma10 ? 'Above' : 'Below', c: price > ind.sma10 ? '#34D399' : '#F87171' },
    { l: 'SMA 20', v: `$${ind.sma20.toFixed(2)}`, s: price > ind.sma20 ? 'Above' : 'Below', c: price > ind.sma20 ? '#34D399' : '#F87171' },
    { l: 'SMA 50', v: `$${ind.sma50.toFixed(2)}`, s: price > ind.sma50 ? 'Above' : 'Below', c: price > ind.sma50 ? '#34D399' : '#F87171' },
    { l: 'MACD', v: ind.macd.toFixed(4), s: `Sig ${ind.macdSignal.toFixed(3)}`, c: ind.macdHist > 0 ? '#34D399' : '#F87171' },
    { l: 'Stoch K', v: ind.stochK.toFixed(1), s: `D ${ind.stochD.toFixed(1)}`, c: ind.stochK > 80 ? '#F87171' : ind.stochK < 20 ? '#34D399' : 'rgba(255,255,255,0.4)' },
    { l: 'KDJ J', v: ind.kdjJ.toFixed(1), s: `K ${ind.kdjK.toFixed(1)}`, c: ind.kdjJ > 80 ? '#F87171' : ind.kdjJ < 20 ? '#34D399' : 'rgba(255,255,255,0.4)' },
    { l: 'CCI', v: ind.cci.toFixed(1), s: ind.cci > 100 ? 'OB' : ind.cci < -100 ? 'OS' : 'N', c: ind.cci > 100 ? '#F87171' : ind.cci < -100 ? '#34D399' : 'rgba(255,255,255,0.4)' },
    { l: 'ADX', v: ind.adx.toFixed(1), s: ind.adx > 25 ? 'Trend' : 'Range', c: ind.adx > 25 ? '#FBBF24' : 'rgba(255,255,255,0.25)' },
    { l: 'BB %B', v: ind.bbPercentB.toFixed(3), s: '', c: ind.bbPercentB > 1 ? '#F87171' : ind.bbPercentB < 0 ? '#34D399' : 'rgba(255,255,255,0.4)' },
    { l: 'Williams %R', v: ind.williamsR.toFixed(1), s: '', c: ind.williamsR < -80 ? '#34D399' : ind.williamsR > -20 ? '#F87171' : 'rgba(255,255,255,0.4)' },
    { l: 'StochRSI', v: ind.stochRsi.toFixed(3), s: '', c: ind.stochRsi > 0.8 ? '#F87171' : ind.stochRsi < 0.2 ? '#34D399' : 'rgba(255,255,255,0.4)' },
    { l: 'OBV', v: ind.obvTrend, s: '', c: ind.obvTrend === 'rising' ? '#34D399' : ind.obvTrend === 'falling' ? '#F87171' : 'rgba(255,255,255,0.3)' },
  ];

  return (
    <div className="glass" style={{ borderRadius: 12, overflow: 'hidden' }}>
      <button onClick={() => setOpen(o => !o)} style={{ width: '100%', padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'none', border: 'none', cursor: 'pointer' }}>
        <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.25)', fontFamily: SF }}>All Indicators · {tf}</span>
        <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.2)', fontFamily: SF }}>{open ? 'Hide' : 'Show'}</span>
      </button>
      {open && (
        <div style={{ padding: '0 14px 10px' }}>
          {rows.map((r, i) => (
            <div key={r.l} className="flex items-center justify-between" style={{ padding: '5px 0', borderBottom: i < rows.length - 1 ? '1px solid rgba(255,255,255,0.03)' : 'none' }}>
              <span style={{ fontSize: 9, fontWeight: 500, color: 'rgba(255,255,255,0.35)', fontFamily: SF }}>{r.l}</span>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: 10, fontWeight: 700, fontFamily: MF, color: r.c }}>{r.v}</span>
                {r.s && <span style={{ fontSize: 8, marginLeft: 4, color: 'rgba(255,255,255,0.15)', fontFamily: SF }}>{r.s}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
});

/* ═══════════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════════ */
export default function Home() {
  const { data, derivatives, loading, error, tf, fetchCount, refetch } = useMarketData('4h');
  const [now, setNow] = useState(Date.now());
  const [showLiqLevels, setShowLiqLevels] = useState(false);

  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(i);
  }, []);

  if (loading) {
    return (
      <div className="ambient-bg">
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
          <div className="spin" style={{ width: 28, height: 28, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.06)', borderTopColor: '#4ADE80' }} />
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.25)', fontFamily: SF }}>Loading…</p>
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="ambient-bg">
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 }}>
          <div style={{ fontSize: 24 }}>⚠️</div>
          <div style={{ fontWeight: 600, color: '#F87171', fontFamily: SF }}>Connection Error</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', fontFamily: SF }}>{error}</div>
          <button onClick={() => refetch()} className="glass-2" style={{ marginTop: 8, padding: '8px 20px', borderRadius: 8, fontSize: 12, fontWeight: 600, color: '#4ADE80', cursor: 'pointer', fontFamily: SF }}>Retry</button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const stale = isStale(data.lastUpdated);
  const ind = data.indicators;
  const tsu = Math.floor((now - data.lastUpdated) / 1000);

  return (
    <div className="ambient-bg">
      <TooltipOverlay />

      <header className="glass-3" style={{ position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 20px', height: 48, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div className="flex items-center gap-2.5">
            <TokenHYPE style={{ width: 22, height: 22, borderRadius: 5 }} />
            <span style={{ fontSize: 12, fontWeight: 700, fontFamily: SF }}>HYPE</span>
            <span style={{ fontSize: 12, fontWeight: 400, color: 'rgba(255,255,255,0.25)', fontFamily: SF }}>Monitor</span>
            <span className="glass" style={{ fontSize: 8, fontWeight: 600, padding: '2px 8px', borderRadius: 999, color: stale ? '#F87171' : '#4ADE80', borderColor: stale ? 'rgba(248,113,113,0.15)' : 'rgba(74,222,128,0.15)', fontFamily: SF }}>
              {stale ? `Stale ${tsu}s` : '● Live'}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 16, fontWeight: 700, fontFamily: MF }}>${data.price.toFixed(2)}</div>
              <div style={{ fontSize: 10, fontWeight: 600, color: data.change24h >= 0 ? '#34D399' : '#F87171', fontFamily: SF }}>
                {data.change24h >= 0 ? '+' : ''}{data.change24h.toFixed(2)}% <span style={{ color: 'rgba(255,255,255,0.15)' }}>24h</span>
              </div>
            </div>
            <button onClick={() => refetch()} className="glass" style={{ width: 28, height: 28, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="rgba(255,255,255,0.4)" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: 1200, margin: '0 auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* 1. Signal Gauge */}
        <SignalGauge data={data} />

        {/* 2. Key Metrics */}
        <KeyMetrics data={data} ind={ind} />

        {/* 3. Chart + Liquidation Levels */}
        <ChartSection data={data} tf={tf} showLevels={showLiqLevels} onToggleLevels={() => setShowLiqLevels(v => !v)} />

        {/* 4. Below-chart panels: Smart Money + vs Market + S/R */}
        <BelowChartPanels data={data} ind={ind} />

        {/* 5. Performance */}
        <div className="grid grid-cols-3 gap-3">
          {(['24h', '7d', '30d'] as const).map(p => {
            const v = p === '24h' ? data.change24h : p === '7d' ? data.change7d : data.change30d;
            return (
              <div key={p} className="glass" style={{ borderRadius: 12, padding: '12px 16px' }}>
                <div style={{ fontSize: 8, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.15)', marginBottom: 3, fontFamily: SF }}>{p}</div>
                <div style={{ fontSize: 14, fontWeight: 700, fontFamily: MF, color: v >= 0 ? '#34D399' : '#F87171' }}>{fmtPct(v)}</div>
              </div>
            );
          })}
        </div>

        {/* 6. Secondary Indicators */}
        <SecondaryIndicators ind={ind} price={data.price} tf={data.timeframe.toUpperCase()} />

        {/* Footer */}
        <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.1)', padding: '0 2px', display: 'flex', justifyContent: 'space-between', fontFamily: SF }}>
          <span>HL API · {fetchCount} fetches</span>
          <span>{tsu < 60 ? `${tsu}s ago` : `${Math.floor(tsu / 60)}m ago`}</span>
        </div>
      </main>
    </div>
  );
}
