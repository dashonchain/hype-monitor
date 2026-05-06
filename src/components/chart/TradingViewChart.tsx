'use client';

import { useState } from 'react';
import type { Timeframe } from '../../types';
import { TIMEFRAME_CONFIG } from '../../types';

interface Props {
  timeframe: Timeframe;
}

export default function TradingViewChart({ timeframe }: Props) {
  const cfg = TIMEFRAME_CONFIG[timeframe];
  const height = 520;
  const [hasError, setHasError] = useState(false);

  const params = new URLSearchParams({
    frameElementId: 'tv_chart',
    symbol: 'KUCOIN:HYPEUSDT',
    interval: cfg.tvRes,
    timezone: 'Etc/UTC',
    theme: 'dark',
    style: '1',
    locale: 'en',
    toolbar_bg: '#0D1117',
    enable_publishing: 'false',
    hide_side_toolbar: 'false',
    allow_symbol_change: 'false',
    studies: 'RSI@tv-basicstudies,MACD@tv-basicstudies',
    width: '100%',
    height: String(height),
  });

  const src = `https://www.tradingview.com/widgetembed/?${params.toString()}`;

  if (hasError) {
    return (
      <div style={{ width: '100%', height }} className="bg-[var(--bg-primary)] flex flex-col items-center justify-center gap-3">
        <div className="text-4xl">📊</div>
        <p className="text-[var(--text-secondary)] text-sm font-medium">Chart unavailable</p>
        <p className="text-[var(--text-muted)] text-xs">TradingView widget could not load</p>
        <button
          onClick={() => setHasError(false)}
          className="mt-2 px-4 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded-lg text-[var(--text-secondary)] text-xs font-medium hover:bg-[var(--bg-surface)] transition"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height, borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.06)' }}>
      <iframe
        id="tv_chart"
        src={src}
        width="100%"
        height={height}
        frameBorder="0"
        allowTransparency
        scrolling="no"
        style={{ display: 'block', border: 'none' }}
        title="TradingView Chart"
        onError={() => setHasError(true)}
      />
    </div>
  );
}
