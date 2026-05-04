'use client';

import type { MarketData } from '../../types';
import { fmt, fmtPct } from '../../lib/format';

interface Props {
  data: MarketData;
}

export function MetricsRow({ data }: Props) {
  const ind = data.indicators;
  const rsiZone = ind.rsi14 > 70 ? 'Overbought' : ind.rsi14 < 30 ? 'Oversold' : ind.rsi14 > 50 ? 'Bullish' : 'Bearish';
  const rsiColor = ind.rsi14 > 70 ? 'text-red-400' : ind.rsi14 < 30 ? 'text-emerald-400' : ind.rsi14 > 50 ? 'text-emerald-400/70' : 'text-red-400/70';

  const metrics = [
    { label: 'MCap', value: data.marketCap > 0 ? fmt(data.marketCap) : '—', sub: '' },
    { label: 'Vol 24h', value: fmt(data.volume24h), sub: '' },
    { label: 'High 24h', value: `$${data.high24h.toFixed(2)}`, sub: '' },
    { label: 'Low 24h', value: `$${data.low24h.toFixed(2)}`, sub: '' },
    { label: 'OI', value: fmt(data.oiUsd), sub: `${fmt(data.oiTokens)} HYPE`, color: '' },
    { label: 'Funding 8h', value: `${data.funding8h >= 0 ? '+' : ''}${data.funding8h.toFixed(4)}%`, sub: `Ann. ${data.fundingAnn.toFixed(1)}%`, color: data.funding8h > 0 ? 'text-emerald-400' : 'text-red-400' },
    { label: 'RSI 14', value: ind.rsi14.toFixed(1), sub: rsiZone, color: rsiColor },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
      {metrics.map(m => (
        <div key={m.label} className="bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-xl px-3 py-3">
          <div className="text-[9px] text-[var(--text-muted)] uppercase tracking-wider font-semibold">{m.label}</div>
          <div className={`text-sm font-bold font-mono mt-1 ${m.color}`}>{m.value}</div>
          {m.sub && <div className="text-[9px] text-[var(--text-muted)] mt-0.5">{m.sub}</div>}
        </div>
      ))}
    </div>
  );
}

export function DerivativesRow({ data }: Props) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
      <div className="bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-xl px-3 py-3">
        <div className="text-[9px] text-[var(--text-muted)] uppercase tracking-wider font-semibold">Long Liq</div>
        <div className="text-sm font-bold font-mono mt-1 text-emerald-400">
          {data.liqZones[0] ? fmt(data.liqZones[0].valueUsd) : '—'}
        </div>
        <div className="text-[9px] text-[var(--text-muted)] mt-0.5">
          {data.liqZones[0] ? `$${data.liqZones[0].priceLow.toFixed(2)}–$${data.liqZones[0].priceHigh.toFixed(2)}` : ''}
        </div>
      </div>
      <div className="bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-xl px-3 py-3">
        <div className="text-[9px] text-[var(--text-muted)] uppercase tracking-wider font-semibold">Short Liq</div>
        <div className="text-sm font-bold font-mono mt-1 text-cyan-400">
          {data.liqZones[1] ? fmt(data.liqZones[1].valueUsd) : '—'}
        </div>
        <div className="text-[9px] text-[var(--text-muted)] mt-0.5">
          {data.liqZones[1] ? `$${data.liqZones[1].priceLow.toFixed(2)}–$${data.liqZones[1].priceHigh.toFixed(2)}` : ''}
        </div>
      </div>
      <div className="bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-xl px-3 py-3">
        <div className="text-[9px] text-[var(--text-muted)] uppercase tracking-wider font-semibold">SMA 10</div>
        <div className="text-sm font-bold font-mono mt-1 text-pink-300">${data.indicators.sma10.toFixed(2)}</div>
        <div className={`text-[9px] mt-0.5 ${data.price > data.indicators.sma10 ? 'text-emerald-500/60' : 'text-red-500/60'}`}>
          {data.price > data.indicators.sma10 ? '▲ Above' : '▼ Below'}
        </div>
      </div>
      <div className="bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-xl px-3 py-3">
        <div className="text-[9px] text-[var(--text-muted)] uppercase tracking-wider font-semibold">SMA 50</div>
        <div className="text-sm font-bold font-mono mt-1 text-blue-400">${data.indicators.sma50.toFixed(2)}</div>
        <div className={`text-[9px] mt-0.5 ${data.price > data.indicators.sma50 ? 'text-emerald-500/60' : 'text-red-500/60'}`}>
          {data.price > data.indicators.sma50 ? '▲ Above' : '▼ Below'}
        </div>
      </div>
    </div>
  );
}

export function IndicatorsPanel({ data }: Props) {
  const ind = data.indicators;
  const isStale = (Date.now() - data.lastUpdated) > 120_000;
  const rsiZone = ind.rsi14 > 70 ? 'Overbought' : ind.rsi14 < 30 ? 'Oversold' : ind.rsi14 > 50 ? 'Bullish' : 'Bearish';
  const rsiColor = ind.rsi14 > 70 ? 'text-red-400' : ind.rsi14 < 30 ? 'text-emerald-400' : ind.rsi14 > 50 ? 'text-emerald-400/70' : 'text-red-400/70';
  const stale = isStale;

  const rows = [
    { label: 'SMA 10', value: `$${ind.sma10.toFixed(2)}`, color: data.price > ind.sma10 ? 'text-emerald-400' : 'text-red-400', sub: data.price > ind.sma10 ? 'Above' : 'Below' },
    { label: 'SMA 20', value: `$${ind.sma20.toFixed(2)}`, color: data.price > ind.sma20 ? 'text-emerald-400' : 'text-red-400', sub: data.price > ind.sma20 ? 'Above' : 'Below' },
    { label: 'SMA 50', value: `$${ind.sma50.toFixed(2)}`, color: data.price > ind.sma50 ? 'text-emerald-400' : 'text-red-400', sub: data.price > ind.sma50 ? 'Above' : 'Below' },
    { label: 'RSI 14', value: ind.rsi14.toFixed(1), color: rsiColor, sub: rsiZone },
    { label: 'MACD', value: ind.macd.toFixed(4), color: ind.macdHist > 0 ? 'text-emerald-400' : 'text-red-400', sub: `Sig ${ind.macdSignal.toFixed(4)}` },
    { label: 'Stoch K', value: ind.stochK.toFixed(1), color: ind.stochK > 80 ? 'text-red-400' : ind.stochK < 20 ? 'text-emerald-400' : 'text-zinc-400', sub: `D ${ind.stochD.toFixed(1)}` },
    { label: 'KDJ J', value: ind.kdjJ.toFixed(1), color: ind.kdjJ > 80 ? 'text-red-400' : ind.kdjJ < 20 ? 'text-emerald-400' : 'text-zinc-400', sub: `K ${ind.kdjK.toFixed(1)}` },
    { label: 'CCI', value: ind.cci.toFixed(1), color: ind.cci > 100 ? 'text-red-400' : ind.cci < -100 ? 'text-emerald-400' : 'text-zinc-400', sub: ind.cci > 100 ? 'Overbought' : ind.cci < -100 ? 'Oversold' : 'Neut' },
    { label: 'ADX', value: ind.adx.toFixed(1), color: ind.adx > 25 ? 'text-amber-400' : 'text-zinc-500', sub: ind.adx > 25 ? 'Trending' : 'Ranging' },
    { label: 'BB %B', value: ind.bbPercentB.toFixed(3), color: ind.bbPercentB > 1 ? 'text-red-400' : ind.bbPercentB < 0 ? 'text-emerald-400' : 'text-zinc-400', sub: '' },
  ];

  return (
    <>
      <div className="bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-[var(--border-primary)]">
          <h3 className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-[0.12em]">
            Indicators · {data.timeframe.toUpperCase()}
          </h3>
        </div>
        <div className="p-4 space-y-2.5">
          {rows.map(r => (
            <div key={r.label} className="flex justify-between items-center py-1 border-b border-[var(--border-primary)]/50 last:border-0">
              <span className="text-[10px] text-[var(--text-muted)] font-medium">{r.label}</span>
              <div className="text-right">
                <span className={`text-[11px] font-mono font-bold ${r.color}`}>{r.value}</span>
                {r.sub && <span className="text-[8px] text-[var(--text-muted)] ml-2">{r.sub}</span>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* RSI Gauge */}
      <div className="bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-2xl p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-[0.12em]">RSI 14</h3>
          <span className={`text-base font-black font-mono ${rsiColor}`}>{ind.rsi14.toFixed(1)}</span>
        </div>
        <div className="relative h-2 rounded-full overflow-hidden" style={{ background: 'linear-gradient(to right, #22c55e 0%, #22c55e 30%, #eab308 30%, #eab308 70%, #ef4444 70%, #ef4444 100%)' }}>
          <div className="absolute top-0 h-full w-1 bg-white rounded-full shadow-lg shadow-white/30 transition-all duration-500" style={{ left: `${Math.min(100, Math.max(0, ind.rsi14))}%` }} />
        </div>
        <div className="flex justify-between text-[8px] text-[var(--text-muted)] mt-1.5">
          <span>Oversold</span><span>Neutral</span><span>Overbought</span>
        </div>
      </div>

      {/* S/R */}
      {(data.srLevels.resistances.length > 0 || data.srLevels.supports.length > 0) && (
        <div className="bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-[var(--border-primary)]">
            <h3 className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-[0.12em]">Support / Resistance</h3>
          </div>
          <div className="p-4 space-y-2">
            {data.srLevels.resistances.map((r, i) => (
              <div key={`r${i}`} className="flex justify-between items-center">
                <span className="text-[10px] text-red-400/70 font-medium">R{i + 1}</span>
                <span className="text-[11px] font-mono font-bold text-red-400">${r.price.toFixed(2)}</span>
                <span className="text-[9px] text-[var(--text-muted)]">{r.strength}%</span>
              </div>
            ))}
            {data.srLevels.supports.map((s, i) => (
              <div key={`s${i}`} className="flex justify-between items-center">
                <span className="text-[10px] text-emerald-400/70 font-medium">S{i + 1}</span>
                <span className="text-[11px] font-mono font-bold text-emerald-400">${s.price.toFixed(2)}</span>
                <span className="text-[9px] text-[var(--text-muted)]">{s.strength}%</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
