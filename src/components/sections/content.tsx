'use client';

import type { MarketData } from '../../types';
import { fmt, fmtPct } from '../../lib/format';
import { InfoIcon } from '../ui/Tooltip';

interface Props {
  data: MarketData;
}

export function MetricsRow({ data }: Props) {
  const ind = data.indicators;
  const rsiZone = ind.rsi14 > 70 ? 'Overbought' : ind.rsi14 < 30 ? 'Oversold' : ind.rsi14 > 50 ? 'Bullish' : 'Bearish';
  const rsiColor = ind.rsi14 > 70 ? 'text-[var(--down-color)]' : ind.rsi14 < 30 ? 'text-[var(--up-color)]' : ind.rsi14 > 50 ? 'text-[var(--up-color)]' : 'text-[var(--down-color)]';

  const metrics = [
    {
      label: 'Market Cap',
      value: data.marketCap > 0 ? fmt(data.marketCap) : '—',
      sub: '',
      tip: 'Total market value of all HYPE tokens in circulation',
    },
    {
      label: 'Volume 24h',
      value: fmt(data.volume24h),
      sub: '',
      tip: 'Total trading volume across all exchanges in the last 24 hours',
    },
    {
      label: 'High 24h',
      value: `$${data.high24h.toFixed(2)}`,
      sub: '',
      tip: 'Highest price reached in the last 24 hours',
    },
    {
      label: 'Low 24h',
      value: `$${data.low24h.toFixed(2)}`,
      sub: '',
      tip: 'Lowest price reached in the last 24 hours',
    },
    {
      label: 'Open Interest',
      value: fmt(data.oiUsd),
      sub: `${fmt(data.oiTokens)} HYPE`,
      tip: 'Total value of all open perpetual futures contracts',
    },
    {
      label: 'Funding 8h',
      value: `${data.funding8h >= 0 ? '+' : ''}${data.funding8h.toFixed(4)}%`,
      sub: `Ann. ${data.fundingAnn.toFixed(1)}%`,
      color: data.funding8h > 0 ? 'text-[var(--up-color)]' : 'text-[var(--down-color)]',
      tip: 'Funding rate paid every 8h between longs and shorts. Positive = longs pay shorts',
    },
    {
      label: 'RSI 14',
      value: ind.rsi14.toFixed(1),
      sub: rsiZone,
      color: rsiColor,
      tip: 'Relative Strength Index (14 periods). >70 = overbought, <30 = oversold',
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
      {metrics.map(m => (
        <div key={m.label} className="bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-xl px-3 py-3">
          <div className="flex items-center text-[9px] text-[var(--text-muted)] uppercase tracking-wider font-semibold">
            {m.label}
            <InfoIcon tip={m.tip} />
          </div>
          <div className={`text-sm font-bold font-mono mt-1 ${m.color || ''}`}>{m.value}</div>
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
        <div className="flex items-center text-[9px] text-[var(--text-muted)] uppercase tracking-wider font-semibold">
          Long Liquidations
          <InfoIcon tip="Estimated value of long positions that would be liquidated at this price zone" />
        </div>
        <div className="text-sm font-bold font-mono mt-1 text-[var(--up-color)]">
          {data.liqZones[0] ? fmt(data.liqZones[0].valueUsd) : '—'}
        </div>
        <div className="text-[9px] text-[var(--text-muted)] mt-0.5">
          {data.liqZones[0] ? `$${data.liqZones[0].priceLow.toFixed(2)}–$${data.liqZones[0].priceHigh.toFixed(2)}` : ''}
        </div>
      </div>
      <div className="bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-xl px-3 py-3">
        <div className="flex items-center text-[9px] text-[var(--text-muted)] uppercase tracking-wider font-semibold">
          Short Liquidations
          <InfoIcon tip="Estimated value of short positions that would be liquidated at this price zone" />
        </div>
        <div className="text-sm font-bold font-mono mt-1 text-[var(--accent-cyan)]">
          {data.liqZones[1] ? fmt(data.liqZones[1].valueUsd) : '—'}
        </div>
        <div className="text-[9px] text-[var(--text-muted)] mt-0.5">
          {data.liqZones[1] ? `$${data.liqZones[1].priceLow.toFixed(2)}–$${data.liqZones[1].priceHigh.toFixed(2)}` : ''}
        </div>
      </div>
      <div className="bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-xl px-3 py-3">
        <div className="flex items-center text-[9px] text-[var(--text-muted)] uppercase tracking-wider font-semibold">
          SMA 10
          <InfoIcon tip="Simple Moving Average over 10 periods. Short-term trend indicator" />
        </div>
        <div className="text-sm font-bold font-mono mt-1 text-[#f9a8d4]">${data.indicators.sma10.toFixed(2)}</div>
        <div className={`text-[9px] mt-0.5 font-semibold ${data.price > data.indicators.sma10 ? 'text-[var(--up-color)]' : 'text-[var(--down-color)]'}`}>
          {data.price > data.indicators.sma10 ? '▲ Price Above' : '▼ Price Below'}
        </div>
      </div>
      <div className="bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-xl px-3 py-3">
        <div className="flex items-center text-[9px] text-[var(--text-muted)] uppercase tracking-wider font-semibold">
          SMA 50
          <InfoIcon tip="Simple Moving Average over 50 periods. Medium-term trend indicator" />
        </div>
        <div className="text-sm font-bold font-mono mt-1 text-[#60a5fa]">${data.indicators.sma50.toFixed(2)}</div>
        <div className={`text-[9px] mt-0.5 font-semibold ${data.price > data.indicators.sma50 ? 'text-[var(--up-color)]' : 'text-[var(--down-color)]'}`}>
          {data.price > data.indicators.sma50 ? '▲ Price Above' : '▼ Price Below'}
        </div>
      </div>
    </div>
  );
}
