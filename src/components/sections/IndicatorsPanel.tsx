'use client';

import type { MarketData } from '../../types';
import { InfoIcon } from '../ui/Tooltip';

interface Props {
  data: MarketData;
}

const INDICATOR_INFO: Record<string, string> = {
  'SMA 10': 'Simple Moving Average over 10 periods. Short-term trend direction',
  'SMA 20': 'Simple Moving Average over 20 periods. Medium-short trend direction',
  'SMA 50': 'Simple Moving Average over 50 periods. Medium-term trend direction',
  'RSI 14': 'Relative Strength Index (14p). >70 = overbought, <30 = oversold. Measures momentum',
  'MACD': 'Moving Average Convergence Divergence. Signal line crossover indicates trend changes',
  'Stoch K': 'Stochastic Oscillator %K (14p). >80 = overbought, <20 = oversold. Momentum indicator',
  'KDJ J': 'KDJ indicator J-line. Combines momentum and trend. >80 overbought, <20 oversold',
  'CCI': 'Commodity Channel Index (20p). >+100 overbought, <-100 oversold. Measures price extremes',
  'ADX': 'Average Directional Index (14p). >25 = strong trend, <25 = ranging/no trend',
  'BB %B': 'Bollinger Bands %B. >1 = above upper band, <0 = below lower band. Measures price position',
};

export function IndicatorsPanel({ data }: Props) {
  const ind = data.indicators;
  const rsiZone = ind.rsi14 > 70 ? 'Overbought' : ind.rsi14 < 30 ? 'Oversold' : ind.rsi14 > 50 ? 'Bullish zone' : 'Bearish zone';
  const rsiColor = ind.rsi14 > 70 ? 'text-[var(--down-color)]' : ind.rsi14 < 30 ? 'text-[var(--up-color)]' : ind.rsi14 > 50 ? 'text-[var(--up-color)]' : 'text-[var(--down-color)]';
  const isStale = (Date.now() - data.lastUpdated) > 120_000;

  const rows = [
    { label: 'SMA 10', value: `$${ind.sma10.toFixed(2)}`, color: data.price > ind.sma10 ? 'text-[var(--up-color)]' : 'text-[var(--down-color)]', sub: data.price > ind.sma10 ? 'Above' : 'Below' },
    { label: 'SMA 20', value: `$${ind.sma20.toFixed(2)}`, color: data.price > ind.sma20 ? 'text-[var(--up-color)]' : 'text-[var(--down-color)]', sub: data.price > ind.sma20 ? 'Above' : 'Below' },
    { label: 'SMA 50', value: `$${ind.sma50.toFixed(2)}`, color: data.price > ind.sma50 ? 'text-[var(--up-color)]' : 'text-[var(--down-color)]', sub: data.price > ind.sma50 ? 'Above' : 'Below' },
    { label: 'RSI 14', value: ind.rsi14.toFixed(1), color: rsiColor, sub: rsiZone },
    { label: 'MACD', value: ind.macd.toFixed(4), color: ind.macdHist > 0 ? 'text-[var(--up-color)]' : 'text-[var(--down-color)]', sub: `Signal: ${ind.macdSignal.toFixed(4)}` },
    { label: 'Stoch K', value: ind.stochK.toFixed(1), color: ind.stochK > 80 ? 'text-[var(--down-color)]' : ind.stochK < 20 ? 'text-[var(--up-color)]' : 'text-[var(--text-secondary)]', sub: `D: ${ind.stochD.toFixed(1)}` },
    { label: 'KDJ J', value: ind.kdjJ.toFixed(1), color: ind.kdjJ > 80 ? 'text-[var(--down-color)]' : ind.kdjJ < 20 ? 'text-[var(--up-color)]' : 'text-[var(--text-secondary)]', sub: `K: ${ind.kdjK.toFixed(1)}` },
    { label: 'CCI', value: ind.cci.toFixed(1), color: ind.cci > 100 ? 'text-[var(--down-color)]' : ind.cci < -100 ? 'text-[var(--up-color)]' : 'text-[var(--text-secondary)]', sub: ind.cci > 100 ? 'Overbought' : ind.cci < -100 ? 'Oversold' : 'Neutral' },
    { label: 'ADX', value: ind.adx.toFixed(1), color: ind.adx > 25 ? 'text-[var(--warning)]' : 'text-[var(--text-muted)]', sub: ind.adx > 25 ? 'Trending' : 'Ranging' },
    { label: 'BB %B', value: ind.bbPercentB.toFixed(3), color: ind.bbPercentB > 1 ? 'text-[var(--down-color)]' : ind.bbPercentB < 0 ? 'text-[var(--up-color)]' : 'text-[var(--text-secondary)]', sub: '' },
  ];

  return (
    <>
      {/* Indicators list */}
      <div className="bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-[var(--border-primary)]">
          <h3 className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-[0.12em]">
            Technical Indicators · {data.timeframe.toUpperCase()}
          </h3>
        </div>
        <div className="p-4 space-y-0">
          {rows.map((r, i) => (
            <div key={r.label} className={`flex justify-between items-center py-2.5 ${i < rows.length - 1 ? 'border-b border-[var(--border-primary)]/50' : ''}`}>
              <div className="flex items-center text-[11px] text-[var(--text-secondary)] font-medium">
                {r.label}
                <InfoIcon tip={INDICATOR_INFO[r.label] || ''} />
              </div>
              <div className="text-right">
                <span className={`text-[12px] font-mono font-bold ${r.color}`}>{r.value}</span>
                {r.sub && <span className="text-[9px] text-[var(--text-muted)] ml-2">{r.sub}</span>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* RSI Gauge */}
      <div className="bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-[0.12em]">
            RSI (14)
            <InfoIcon tip="Relative Strength Index: 0-100 scale. >70 overbought, <30 oversold" />
          </div>
          <span className={`text-lg font-black font-mono ${rsiColor}`}>{ind.rsi14.toFixed(1)}</span>
        </div>
        <div className="relative h-2.5 rounded-full overflow-hidden" style={{ background: 'linear-gradient(to right, #3FB950 0%, #3FB950 30%, #D29922 30%, #D29922 70%, #F85149 70%, #F85149 100%)' }}>
          <div className="absolute top-0 h-full w-1.5 bg-white rounded-full shadow-lg transition-all duration-500" style={{ left: `${Math.min(100, Math.max(0, ind.rsi14))}%` }} />
        </div>
        <div className="flex justify-between text-[8px] text-[var(--text-muted)] mt-1.5 font-semibold">
          <span>30 Oversold</span>
          <span>50</span>
          <span>70 Overbought</span>
        </div>
      </div>

      {/* Support / Resistance */}
      {(data.srLevels.resistances.length > 0 || data.srLevels.supports.length > 0) && (
        <div className="bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-[var(--border-primary)]">
            <div className="flex items-center text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-[0.12em]">
              Support / Resistance
              <InfoIcon tip="Key price levels where the asset has previously reversed or consolidated. R = resistance (above), S = support (below)" />
            </div>
          </div>
          <div className="p-4 space-y-3">
            {data.srLevels.resistances.map((r, i) => (
              <div key={`r${i}`} className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded bg-[var(--danger-bg)] border border-[var(--danger-border)] flex items-center justify-center text-[9px] font-bold text-[var(--danger)]">R{i + 1}</span>
                  <span className="text-[11px] font-mono font-bold text-[var(--danger)]">${r.price.toFixed(2)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-16 h-1.5 bg-[var(--bg-elevated)] rounded-full overflow-hidden">
                    <div className="h-full bg-[var(--danger)] rounded-full" style={{ width: `${r.strength}%` }} />
                  </div>
                  <span className="text-[9px] text-[var(--text-muted)] font-semibold w-7 text-right">{r.strength}%</span>
                </div>
              </div>
            ))}
            {data.srLevels.supports.map((s, i) => (
              <div key={`s${i}`} className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded bg-[var(--success-bg)] border border-[var(--success-border)] flex items-center justify-center text-[9px] font-bold text-[var(--success)]">S{i + 1}</span>
                  <span className="text-[11px] font-mono font-bold text-[var(--success)]">${s.price.toFixed(2)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-16 h-1.5 bg-[var(--bg-elevated)] rounded-full overflow-hidden">
                    <div className="h-full bg-[var(--success)] rounded-full" style={{ width: `${s.strength}%` }} />
                  </div>
                  <span className="text-[9px] text-[var(--text-muted)] font-semibold w-7 text-right">{s.strength}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
