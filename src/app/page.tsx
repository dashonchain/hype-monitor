'use client';

import { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { TokenHYPE, TokenBTC, TokenETH } from '@web3icons/react';
import { useMarketData } from '../hooks/useMarketData';
import TradingViewChart from '../components/chart/TradingViewChart';
import { fmtPct, isStale } from '../lib/format';
import type { Timeframe } from '../types';
import { TIMEFRAME_CONFIG } from '../types';

const TFS: Timeframe[] = ['1h', '4h', '1d'];
const MF = "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, monospace";
const SF = "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', Arial, sans-serif";

/* ═══════════════════════════════════════════
   TOOLTIP — Apple-style subtle
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
   APPLE-STYLE SIGNAL GAUGE — Hero section
   Only the most important signal, big & clear
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

const SignalGauge = memo(function SignalGauge({ data }: { data: NonNullable<ReturnType<typeof useMarketData>['data']> }) {
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
    <div className="glass-2" style={{ borderRadius: 24, padding: expanded ? '32px 36px 28px' : '32px 36px', background: bg, borderColor: borderC, opacity: stale ? 0.5 : 1, transition: 'all .3s' }}>
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-8">
        {/* Left: Signal identity */}
        <div className="flex items-center gap-6">
          <div className="glass-3" style={{ width: 64, height: 64, borderRadius: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <TokenHYPE style={{ width: 40, height: 40 }} />
          </div>
          <div>
            <div style={{ fontSize: 11, letterSpacing: '.12em', fontWeight: 500, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', marginBottom: 6, fontFamily: SF }}>
              Composite Signal · 17 Indicators · Hyperliquid
            </div>
            <div style={{ fontWeight: 700, fontSize: 36, letterSpacing: '-.03em', color: c, fontFamily: SF, lineHeight: 1.05 }}>{sig.display}</div>
            <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', marginTop: 4, fontFamily: SF }}>{sig.summary}</div>
          </div>
        </div>

        {/* Right: Score + counts */}
        <div className="flex items-center gap-6 w-full lg:w-auto">
          <div className="flex-1 lg:w-48">
            <div className="flex justify-between items-center mb-3">
              <span style={{ fontSize: 10, fontWeight: 600, color: '#F87171', letterSpacing: '.08em', fontFamily: SF }}>SELL</span>
              <span style={{ fontSize: 28, fontWeight: 800, fontFamily: MF, color: c, letterSpacing: '-.02em' }}>{sig.score}</span>
              <span style={{ fontSize: 10, fontWeight: 600, color: '#34D399', letterSpacing: '.08em', fontFamily: SF }}>BUY</span>
            </div>
            <div style={{ width: '100%', height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${sig.score}%`, background: c, borderRadius: 3, transition: 'width .7s ease' }} />
            </div>
          </div>
          <div className="flex gap-5">
            {[{ n: sig.buy, l: 'Buy', c: '#34D399' }, { n: sig.neutral, l: 'Neut', c: 'rgba(255,255,255,0.3)' }, { n: sig.sell, l: 'Sell', c: '#F87171' }].map(s => (
              <div key={s.l} className="text-center">
                <div style={{ fontSize: 18, fontWeight: 800, color: s.c, fontFamily: MF }}>{s.n}</div>
                <div style={{ fontSize: 8, fontWeight: 600, color: 'rgba(255,255,255,0.2)', letterSpacing: '.1em', textTransform: 'uppercase', fontFamily: SF }}>{s.l}</div>
              </div>
            ))}
          </div>
          <button onClick={() => setExpanded(e => !e)} className="glass" style={{ padding: '8px 16px', borderRadius: 8, fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.45)', cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: SF }}>
            {expanded ? 'Less' : 'Details'}
          </button>
        </div>
      </div>

      {/* Expanded breakdown — Apple-style grid */}
      {expanded && (
        <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', marginBottom: 12, fontFamily: SF }}>
            Signal Breakdown · {breakdown.length} Criteria
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2">
            {breakdown.map(cr => (
              <div key={cr.key} className="glass" style={{ borderRadius: 8, padding: '8px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 10, fontWeight: 500, color: 'rgba(255,255,255,0.5)', fontFamily: SF }}>{cr.label}</span>
                <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: cr.signal === 'buy' ? 'rgba(52,211,153,0.15)' : cr.signal === 'sell' ? 'rgba(248,113,113,0.15)' : 'rgba(255,255,255,0.06)', color: cr.signal === 'buy' ? '#34D399' : cr.signal === 'sell' ? '#F87171' : 'rgba(255,255,255,0.3)', fontFamily: SF }}>
                  {cr.signal === 'buy' ? '▲ BUY' : cr.signal === 'sell' ? '▼ SELL' : '— NEUT'}
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
   KEY METRICS — Apple-style: only the essentials
   Big numbers, clear hierarchy, no clutter
   ═══════════════════════════════════════════ */
const KeyMetrics = memo(function KeyMetrics({ data, ind }: { data: any; ind: any }) {
  const rsiZ = ind.rsi14 > 70 ? 'Overbought' : ind.rsi14 < 30 ? 'Oversold' : ind.rsi14 > 50 ? 'Bullish' : 'Bearish';
  const fundingBearish = data.funding8h > 0;

  const metrics = [
    { label: 'Price', value: `$${data.price.toFixed(2)}`, sub: `${data.change24h >= 0 ? '+' : ''}${data.change24h.toFixed(2)}%`, subColor: data.change24h >= 0 ? '#34D399' : '#F87171', highlight: true },
    { label: 'RSI 14', value: ind.rsi14.toFixed(1), sub: rsiZ, subColor: ind.rsi14 > 70 ? '#F87171' : ind.rsi14 < 30 ? '#34D399' : 'rgba(255,255,255,0.4)', highlight: ind.rsi14 > 70 || ind.rsi14 < 30 },
    { label: 'VWAP', value: `$${ind.vwap.toFixed(2)}`, sub: data.price > ind.vwap ? 'Above ↑' : 'Below ↓', subColor: data.price > ind.vwap ? '#34D399' : '#F87171', highlight: false },
    { label: 'Funding 8h', value: `${data.funding8h >= 0 ? '+' : ''}${data.funding8h.toFixed(4)}%`, sub: `Ann. ${data.fundingAnn.toFixed(1)}%`, subColor: fundingBearish ? '#F87171' : '#34D399', highlight: Math.abs(data.funding8h) > 0.005 },
    { label: 'ATR (14)', value: `$${ind.atr.toFixed(2)}`, sub: `Stop: $${ind.atrStop.toFixed(2)}`, subColor: '#FBBF24', highlight: false },
    { label: 'MFI', value: ind.mfi.toFixed(1), sub: ind.mfi > 80 ? 'OB' : ind.mfi < 20 ? 'OS' : 'Mid', subColor: ind.mfi > 80 ? '#F87171' : ind.mfi < 20 ? '#34D399' : 'rgba(255,255,255,0.4)', highlight: ind.mfi > 80 || ind.mfi < 20 },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      {metrics.map(m => (
        <div key={m.label} className="glass" style={{ borderRadius: 14, padding: '16px 18px', position: 'relative', overflow: 'hidden' }}>
          {m.highlight && (
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: m.subColor }} />
          )}
          <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.25)', marginBottom: 8, fontFamily: SF }}>
            {m.label}
          </div>
          <div style={{ fontSize: m.highlight ? 20 : 16, fontWeight: 700, fontFamily: MF, color: m.highlight ? '#fff' : 'rgba(255,255,255,0.85)', letterSpacing: '-.01em' }}>
            {m.value}
          </div>
          <div style={{ fontSize: 10, fontWeight: 600, color: m.subColor, marginTop: 3, fontFamily: SF }}>{m.sub}</div>
        </div>
      ))}
    </div>
  );
});

/* ═══════════════════════════════════════════
   SMART MONEY — Highlighted panel
   ═══════════════════════════════════════════ */
const SmartMoneyPanel = memo(function SmartMoneyPanel({ derivatives }: { derivatives: any }) {
  if (!derivatives) return null;
  const ls = derivatives.longShortRatio || {};
  const oi = derivatives.openInterest || {};
  const fund = derivatives.funding || {};

  const ratio = ls.ratio || 1;
  const longPct = ls.longPct ?? (ratio / (1 + ratio) * 100);
  const shortPct = ls.shortPct ?? (100 - longPct);
  const isLongBias = ratio > 1;
  const isNeutral = Math.abs(ratio - 1) < 0.01;
  const accentColor = isNeutral ? '#FBBF24' : isLongBias ? '#34D399' : '#F87171';

  const fmtUsd = (n: number) => {
    if (!n) return '—';
    if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
    if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
    return `$${(n / 1e3).toFixed(0)}K`;
  };

  const interpLabel = (s: string) => {
    switch (s) {
      case 'longs_dominant': return '🟢 Longs dominants';
      case 'slight_long_bias': return '🟢 Léger biais long';
      case 'shorts_dominant': return '🔴 Shorts dominants';
      case 'slight_short_bias': return '🔴 Léger biais short';
      default: return '⚪ Neutre';
    }
  };

  return (
    <div className="glass" style={{ borderRadius: 18, overflow: 'hidden' }}>
      <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center' }}>
        <h3 style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', fontFamily: SF }}>Smart Money</h3>
        <Info tip="L/S ratio from 24h order flow delta — Hyperliquid on-chain" />
      </div>
      <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* L/S Ratio — HERO number */}
        <div>
          <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
            <span style={{ fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,0.4)', fontFamily: SF }}>L/S Ratio</span>
            <span style={{ fontSize: 22, fontWeight: 800, fontFamily: MF, color: accentColor, letterSpacing: '-.02em' }}>
              {ratio.toFixed(2)}
            </span>
          </div>
          <div style={{ display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden', background: 'rgba(248,113,113,0.12)' }}>
            <div style={{ width: `${longPct}%`, background: isLongBias ? 'rgba(52,211,153,0.5)' : 'rgba(52,211,153,0.25)', transition: 'width .5s' }} />
          </div>
          <div className="flex items-center justify-between" style={{ marginTop: 5 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: '#34D399', fontFamily: SF }}>L {longPct.toFixed(1)}%</span>
            <span style={{ fontSize: 10, fontWeight: 700, color: '#F87171', fontFamily: SF }}>S {shortPct.toFixed(1)}%</span>
          </div>
        </div>

        {/* OI + Funding — compact */}
        <div className="grid grid-cols-2 gap-2">
          <div style={{ borderRadius: 10, padding: 12, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ fontSize: 8, fontWeight: 600, color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase', marginBottom: 3, fontFamily: SF }}>Open Interest</div>
            <div style={{ fontSize: 14, fontWeight: 700, fontFamily: MF, color: 'rgba(255,255,255,0.85)' }}>{fmtUsd(oi.oiUsd)}</div>
          </div>
          <div style={{ borderRadius: 10, padding: 12, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ fontSize: 8, fontWeight: 600, color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase', marginBottom: 3, fontFamily: SF }}>Funding</div>
            <div style={{ fontSize: 14, fontWeight: 700, fontFamily: MF, color: (fund.current1h || 0) >= 0 ? '#F87171' : '#34D399' }}>
              {(fund.current1h || 0).toFixed(4)}%
            </div>
          </div>
        </div>

        {/* 24h Order Flow — compact */}
        {(ls.buyVolume24h > 0 || ls.sellVolume24h > 0) && (
          <div style={{ borderRadius: 10, padding: 12, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ fontSize: 8, fontWeight: 600, color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase', marginBottom: 6, fontFamily: SF }}>24h Order Flow</div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', fontFamily: SF }}>Buy</div>
                <div style={{ fontSize: 13, fontWeight: 700, fontFamily: MF, color: '#34D399' }}>{fmtUsd(ls.buyVolume24h)}</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', fontFamily: SF }}>Delta</div>
                <div style={{ fontSize: 13, fontWeight: 700, fontFamily: MF, color: (ls.delta24h || 0) >= 0 ? '#34D399' : '#F87171' }}>
                  {(ls.delta24h || 0) >= 0 ? '+' : ''}{fmtUsd(ls.delta24h)}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', fontFamily: SF }}>Sell</div>
                <div style={{ fontSize: 13, fontWeight: 700, fontFamily: MF, color: '#F87171' }}>{fmtUsd(ls.sellVolume24h)}</div>
              </div>
            </div>
          </div>
        )}

        {/* Interpretation */}
        <div style={{ fontSize: 10, fontWeight: 600, color: accentColor, textAlign: 'center', padding: '4px 0', fontFamily: SF }}>
          {interpLabel(ls.interpretation || 'neutral')}
        </div>
      </div>
    </div>
  );
});

/* ═══════════════════════════════════════════
   SECONDARY INDICapsedATORS — Coll by default
   Apple-style: details available but not in your face
   ═══════════════════════════════════════════ */
const SecondaryIndicators = memo(function SecondaryIndicators({ ind, price, tf }: { ind: any; price: number; tf: string }) {
  const [open, setOpen] = useState(false);

  const rows = [
    { l: 'SMA 10', v: `$${ind.sma10.toFixed(2)}`, s: price > ind.sma10 ? 'Above' : 'Below', c: price > ind.sma10 ? '#34D399' : '#F87171' },
    { l: 'SMA 20', v: `$${ind.sma20.toFixed(2)}`, s: price > ind.sma20 ? 'Above' : 'Below', c: price > ind.sma20 ? '#34D399' : '#F87171' },
    { l: 'SMA 50', v: `$${ind.sma50.toFixed(2)}`, s: price > ind.sma50 ? 'Above' : 'Below', c: price > ind.sma50 ? '#34D399' : '#F87171' },
    { l: 'MACD', v: ind.macd.toFixed(4), s: `Sig ${ind.macdSignal.toFixed(3)}`, c: ind.macdHist > 0 ? '#34D399' : '#F87171' },
    { l: 'Stoch K', v: ind.stochK.toFixed(1), s: `D ${ind.stochD.toFixed(1)}`, c: ind.stochK > 80 ? '#F87171' : ind.stochK < 20 ? '#34D399' : 'rgba(255,255,255,0.5)' },
    { l: 'KDJ J', v: ind.kdjJ.toFixed(1), s: `K ${ind.kdjK.toFixed(1)}`, c: ind.kdjJ > 80 ? '#F87171' : ind.kdjJ < 20 ? '#34D399' : 'rgba(255,255,255,0.5)' },
    { l: 'CCI', v: ind.cci.toFixed(1), s: ind.cci > 100 ? 'OB' : ind.cci < -100 ? 'OS' : 'N', c: ind.cci > 100 ? '#F87171' : ind.cci < -100 ? '#34D399' : 'rgba(255,255,255,0.5)' },
    { l: 'ADX', v: ind.adx.toFixed(1), s: ind.adx > 25 ? 'Trend' : 'Range', c: ind.adx > 25 ? '#FBBF24' : 'rgba(255,255,255,0.3)' },
    { l: 'BB %B', v: ind.bbPercentB.toFixed(3), s: ind.bbPercentB > 1 ? 'Above ↑' : ind.bbPercentB < 0 ? 'Below ↓' : 'Mid', c: ind.bbPercentB > 1 ? '#F87171' : ind.bbPercentB < 0 ? '#34D399' : 'rgba(255,255,255,0.5)' },
    { l: 'Williams %R', v: ind.williamsR.toFixed(1), s: ind.williamsR < -80 ? 'OS' : ind.williamsR > -20 ? 'OB' : 'Mid', c: ind.williamsR < -80 ? '#34D399' : ind.williamsR > -20 ? '#F87171' : 'rgba(255,255,255,0.5)' },
    { l: 'StochRSI', v: ind.stochRsi.toFixed(3), s: ind.stochRsi > 0.8 ? 'OB' : ind.stochRsi < 0.2 ? 'OS' : 'Mid', c: ind.stochRsi > 0.8 ? '#F87171' : ind.stochRsi < 0.2 ? '#34D399' : 'rgba(255,255,255,0.5)' },
    { l: 'OBV', v: ind.obvTrend, s: '', c: ind.obvTrend === 'rising' ? '#34D399' : ind.obvTrend === 'falling' ? '#F87171' : 'rgba(255,255,255,0.4)' },
  ];

  return (
    <div className="glass" style={{ borderRadius: 18, overflow: 'hidden' }}>
      <button onClick={() => setOpen(o => !o)} style={{ width: '100%', padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'none', border: 'none', cursor: 'pointer' }}>
        <h3 style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', fontFamily: SF }}>
          All Indicators · {tf}
        </h3>
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', fontFamily: SF }}>{open ? 'Hide' : 'Show'}</span>
      </button>
      {open && (
        <div style={{ padding: '4px 20px 14px' }}>
          {rows.map((r, i) => (
            <div key={r.l} className="flex items-center justify-between" style={{ padding: '7px 0', borderBottom: i < rows.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
              <span style={{ fontSize: 11, fontWeight: 500, color: 'rgba(255,255,255,0.45)', fontFamily: SF }}>{r.l}</span>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: 12, fontWeight: 700, fontFamily: MF, color: r.c }}>{r.v}</span>
                {r.s && <span style={{ fontSize: 9, marginLeft: 6, color: 'rgba(255,255,255,0.2)', fontFamily: SF }}>{r.s}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
});

/* ═══════════════════════════════════════════
   DOMINANCE PANEL — Compact
   ═══════════════════════════════════════════ */
const DominancePanel = memo(function DominancePanel({ data }: { data: NonNullable<ReturnType<typeof useMarketData>['data']> }) {
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
        <h3 style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', fontFamily: SF }}>vs Market</h3>
        <Info tip="HYPE performance vs BTC and ETH" />
      </div>
      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {coins.map(c => (
          <div key={c.d.symbol} style={{ borderRadius: 10, padding: 12, background: `${c.hex}0a`, border: `1px solid ${c.hex}18` }}>
            <div className="flex items-center justify-between" style={{ marginBottom: 6 }}>
              <div className="flex items-center gap-2">
                <c.Icon style={{ width: 20, height: 20, borderRadius: 5 }} />
                <span style={{ fontSize: 12, fontWeight: 700, color: c.hex, fontFamily: SF }}>{c.d.symbol}</span>
              </div>
              <span style={{ fontSize: 11, fontWeight: 600, fontFamily: MF, color: 'rgba(255,255,255,0.5)' }}>{fp(c.d.price)}</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {(['24h', '7d', '30d'] as const).map(p => {
                const v = p === '24h' ? c.d.change24h : p === '7d' ? c.d.change7d : c.d.change30d;
                return (
                  <div key={p} className="text-center">
                    <div style={{ fontSize: 8, fontWeight: 600, color: 'rgba(255,255,255,0.2)', textTransform: 'uppercase', fontFamily: SF }}>{p}</div>
                    <div style={{ fontSize: 11, fontWeight: 700, fontFamily: MF, color: v >= 0 ? '#34D399' : '#F87171' }}>{fmt(v)}</div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
});

/* ═══════════════════════════════════════════
   MAIN PAGE — Apple-style layout
   ═══════════════════════════════════════════ */
export default function Home() {
  const { data, derivatives, loading, error, tf, tfLoading, fetchCount, changeTimeframe, refetch } = useMarketData('4h');
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(i);
  }, []);

  if (loading) {
    return (
      <div className="ambient-bg">
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
          <div className="spin" style={{ width: 32, height: 32, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.08)', borderTopColor: '#4ADE80' }} />
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)', fontFamily: SF }}>Loading market data…</p>
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="ambient-bg">
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 }}>
          <div style={{ fontSize: 28 }}>⚠️</div>
          <div style={{ fontWeight: 600, color: '#F87171', fontFamily: SF }}>Connection Error</div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)', fontFamily: SF }}>{error}</div>
          <button onClick={() => refetch()} className="glass-2" style={{ marginTop: 8, padding: '10px 24px', borderRadius: 8, fontSize: 13, fontWeight: 600, color: '#4ADE80', cursor: 'pointer', fontFamily: SF }}>Retry</button>
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

      {/* Header — Apple-style translucent nav */}
      <header className="glass-3" style={{ position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: 1440, margin: '0 auto', padding: '0 24px', height: 52, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div className="flex items-center gap-3">
            <TokenHYPE style={{ width: 26, height: 26, borderRadius: 6 }} />
            <div>
              <span style={{ fontSize: 13, fontWeight: 700, fontFamily: SF }}>HYPE</span>
              <span style={{ fontSize: 13, fontWeight: 400, color: 'rgba(255,255,255,0.3)', marginLeft: 6, fontFamily: SF }}>Monitor</span>
            </div>
            <span className="glass" style={{ fontSize: 9, fontWeight: 600, padding: '3px 10px', borderRadius: 999, color: stale ? '#F87171' : '#4ADE80', borderColor: stale ? 'rgba(248,113,113,0.2)' : 'rgba(74,222,128,0.2)', fontFamily: SF }}>
              {stale ? `Stale ${tsu}s` : '● Live'}
            </span>
          </div>
          <div className="flex items-center gap-4">
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 18, fontWeight: 700, fontFamily: MF, letterSpacing: '-.01em' }}>${data.price.toFixed(2)}</div>
              <div style={{ fontSize: 11, fontWeight: 600, color: data.change24h >= 0 ? '#34D399' : '#F87171', fontFamily: SF }}>
                {data.change24h >= 0 ? '+' : ''}{data.change24h.toFixed(2)}% <span style={{ color: 'rgba(255,255,255,0.2)' }}>24h</span>
              </div>
            </div>
            <button onClick={() => refetch()} className="glass" style={{ width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="rgba(255,255,255,0.5)" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: 1440, margin: '0 auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* HERO: Signal Gauge */}
        <SignalGauge data={data} />

        {/* KEY METRICS — Only the essentials */}
        <KeyMetrics data={data} ind={ind} />

        {/* Main grid: chart + sidebar */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* Chart */}
            <div className="glass-2" style={{ borderRadius: 18, overflow: 'hidden' }}>
              <TradingViewChart timeframe={tf} />
            </div>

            {/* Performance — compact */}
            <div className="grid grid-cols-3 gap-3">
              {(['24h', '7d', '30d'] as const).map(p => {
                const v = p === '24h' ? data.change24h : p === '7d' ? data.change7d : data.change30d;
                return (
                  <div key={p} className="glass" style={{ borderRadius: 14, padding: '14px 18px' }}>
                    <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.2)', marginBottom: 4, fontFamily: SF }}>{p}</div>
                    <div style={{ fontSize: 16, fontWeight: 700, fontFamily: MF, color: v >= 0 ? '#34D399' : '#F87171' }}>{fmtPct(v)}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Sidebar */}
          <aside style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Smart Money — highlighted */}
            <SmartMoneyPanel derivatives={derivatives} />

            {/* Secondary indicators — collapsed */}
            <SecondaryIndicators ind={ind} price={data.price} tf={data.timeframe.toUpperCase()} />

            {/* Dominance */}
            <DominancePanel data={data} />

            {/* S/R — compact */}
            {(data.srLevels.resistances.length > 0 || data.srLevels.supports.length > 0) && (
              <div className="glass" style={{ borderRadius: 18, overflow: 'hidden' }}>
                <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center' }}>
                  <h3 style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', fontFamily: SF }}>S / R</h3>
                  <Info key="sr-tip" tip="Support / Resistance levels" />
                </div>
                <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {data.srLevels.resistances.map((r, i) => (
                    <div key={`r${i}`} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span style={{ width: 20, height: 20, borderRadius: 5, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, fontWeight: 800, color: '#F87171', background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.15)', fontFamily: SF }}>R{i + 1}</span>
                        <span style={{ fontSize: 12, fontWeight: 700, fontFamily: MF, color: '#F87171' }}>${r.price.toFixed(2)}</span>
                      </div>
                      <span style={{ fontSize: 9, fontWeight: 600, color: 'rgba(255,255,255,0.2)', fontFamily: SF }}>{r.strength}%</span>
                    </div>
                  ))}
                  {data.srLevels.supports.map((s, i) => (
                    <div key={`s${i}`} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span style={{ width: 20, height: 20, borderRadius: 5, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, fontWeight: 800, color: '#34D399', background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.15)', fontFamily: SF }}>S{i + 1}</span>
                        <span style={{ fontSize: 12, fontWeight: 700, fontFamily: MF, color: '#34D399' }}>${s.price.toFixed(2)}</span>
                      </div>
                      <span style={{ fontSize: 9, fontWeight: 600, color: 'rgba(255,255,255,0.2)', fontFamily: SF }}>{s.strength}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Footer info — minimal */}
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.15)', padding: '0 4px', display: 'flex', justifyContent: 'space-between', fontFamily: SF }}>
              <span>HL API · {fetchCount} fetches</span>
              <span>{tsu < 60 ? `${tsu}s ago` : `${Math.floor(tsu / 60)}m ago`}</span>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
