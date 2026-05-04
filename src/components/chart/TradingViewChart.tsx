'use client';

import type { Timeframe } from '../../types';
import { TIMEFRAME_CONFIG } from '../../types';

interface Props {
  timeframe: Timeframe;
}

export default function TradingViewChart({ timeframe }: Props) {
  const cfg = TIMEFRAME_CONFIG[timeframe];
  const height = 520;

  const params = new URLSearchParams({
    frameElementId: 'tv_chart',
    symbol: 'KUCOIN:HYPEUSDT',
    interval: cfg.tvRes,
    timezone: 'Etc/UTC',
    theme: 'dark',
    style: '1',
    locale: 'en',
    toolbar_bg: '#0B0E14',
    enable_publishing: 'false',
    hide_side_toolbar: 'false',
    allow_symbol_change: 'false',
    studies: 'RSI@tv-basicstudies,MACD@tv-basicstudies',
    width: '100%',
    height: String(height),
  });

  const src = `https://www.tradingview.com/widgetembed/?${params.toString()}`;

  return (
    <div style={{ width: '100%', height }} className="bg-[var(--bg-primary)]">
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
      />
    </div>
  );
}
