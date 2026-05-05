'use client';

import { useEffect, useRef, useState } from 'react';
import type { Timeframe } from '../../types';
import { TIMEFRAME_CONFIG } from '../../types';

interface Props {
  timeframe: Timeframe;
  srLevels?: { resistances: { price: number; strength: number }[]; supports: { price: number; strength: number }[] };
  liqZones?: any[];
}

export default function TradingViewChart({ timeframe, srLevels, liqZones = [] }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<any>(null);
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  const cfg = TIMEFRAME_CONFIG[timeframe];

  // Load TradingView script
  useEffect(() => {
    if (document.getElementById('tv-charting-library')) {
      setScriptLoaded(true);
      return;
    }
    const script = document.createElement('script');
    script.id = 'tv-charting-library';
    script.src = 'https://s3.tradingview.com/tv.js';
    script.async = true;
    script.onload = () => setScriptLoaded(true);
    script.onerror = () => setHasError(true);
    document.head.appendChild(script);
    return () => {
      // Don't remove script on unmount — other components might use it
    };
  }, []);

  // Initialize widget
  useEffect(() => {
    if (!scriptLoaded || !containerRef.current) return;
    if (widgetRef.current) {
      try { widgetRef.current.remove(); } catch {}
      widgetRef.current = null;
    }

    const container = containerRef.current;
    container.innerHTML = '';

    try {
      widgetRef.current = new (window as any).TradingView.widget({
        container: container,
        symbol: 'KUCOIN:HYPEUSDT',
        interval: cfg.tvRes,
        timezone: 'Etc/UTC',
        theme: 'dark',
        style: '1',
        locale: 'en',
        toolbar_bg: '#0D1117',
        enable_publishing: false,
        hide_side_toolbar: false,
        allow_symbol_change: false,
        studies: ['RSI@tv-basicstudies', 'MACD@tv-basicstudies'],
        width: '100%',
        height: '520',
        overrides: {
          'paneProperties.background': '#0D1117',
          'paneProperties.vertGridProperties.color': 'rgba(255,255,255,0.04)',
          'paneProperties.horzGridProperties.color': 'rgba(255,255,255,0.04)',
        },
      });
    } catch (e) {
      console.error('TV widget init error:', e);
      setHasError(true);
    }
  }, [scriptLoaded, timeframe]);

  // Draw S/R lines and liquidation zones
  useEffect(() => {
    if (!widgetRef.current || !srLevels) return;

    widgetRef.current.onChartReady(() => {
      const chart = widgetRef.current.activeChart();
      chart.removeAllShapes();

      // ── RESISTANCE LINES (red) ──
      srLevels.resistances.forEach((r, i) => {
        chart.createMultipointShape(
          [{ price: r.price }],
          {
            shape: 'horizontal_line',
            lock: true,
            disableSelection: true,
            overrides: {
              linecolor: `rgba(239, 68, 68, ${r.strength / 100})`,
              linewidth: r.strength > 80 ? 2 : 1,
              linestyle: 0,
              showLabel: true,
              textcolor: '#ef4444',
              fontSize: 11,
              text: `R${i + 1} ${r.strength}% — $${r.price.toFixed(3)}`,
            },
          }
        );
      });

      // ── SUPPORT LINES (green) ──
      srLevels.supports.forEach((s, i) => {
        chart.createMultipointShape(
          [{ price: s.price }],
          {
            shape: 'horizontal_line',
            lock: true,
            disableSelection: true,
            overrides: {
              linecolor: `rgba(34, 197, 94, ${s.strength / 100})`,
              linewidth: s.strength > 80 ? 2 : 1,
              linestyle: 0,
              showLabel: true,
              textcolor: '#22c55e',
              fontSize: 11,
              text: `S${i + 1} ${s.strength}% — $${s.price.toFixed(3)}`,
            },
          }
        );
      });

      // ── LIQUIDATION ZONES (rectangles) ──
      if (liqZones.length > 0) {
        const lastBar = chart.exportData ? chart.exportData() : null;
        const lastTime = (lastBar && lastBar[lastBar.length - 1]?.time) || Date.now() / 1000;
        const futureTime = lastTime + 7 * 24 * 3600;

        liqZones.forEach((zone: any) => {
          const isShort = zone.side === 'short';
          const color = isShort ? '6, 182, 212' : '34, 197, 94';
          const usdM = (zone.usd / 1e6).toFixed(1);

          chart.createMultipointShape(
            [
              { time: lastTime, price: zone.low },
              { time: futureTime, price: zone.high },
            ],
            {
              shape: 'rectangle',
              lock: true,
              overrides: {
                backgroundColor: `rgba(${color}, 0.12)`,
                borderColor: `rgba(${color}, 0.5)`,
                borderWidth: 1,
                showLabel: true,
                textcolor: `rgba(${color}, 1)`,
                text: `${isShort ? 'Short' : 'Long'} Liq $${usdM}M`,
                fontSize: 10,
              },
            }
          );
        });
      }
    });
  }, [srLevels, liqZones]);

  const height = 520;

  if (hasError) {
    return (
      <div style={{ width: '100%', height }} className="bg-[var(--bg-primary)] flex flex-col items-center justify-center gap-3">
        <div className="text-4xl">📊</div>
        <p className="text-[var(--text-secondary)] text-sm font-medium">Chart unavailable</p>
        <p className="text-[var(--text-muted)] text-xs">TradingView widget could not load</p>
        <button
          onClick={() => { setHasError(false); setScriptLoaded(false); }}
          className="mt-2 px-4 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded-lg text-[var(--text-secondary)] text-xs font-medium hover:bg-[var(--bg-surface)] transition"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height, borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.06)' }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
    </div>
  );
}
