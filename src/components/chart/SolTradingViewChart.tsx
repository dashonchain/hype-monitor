'use client';

import { useState, useEffect, useRef } from 'react';
import type { Timeframe, SRLevel, LiqZone } from '../../types';
import { TIMEFRAME_CONFIG } from '../../types';

// Add type declaration for TradingView
declare global {
  interface Window {
    TradingView?: any;
  }
}

interface Props {
  timeframe: Timeframe;
  srLevels?: { supports: SRLevel[]; resistances: SRLevel[] };
  liqZones?: LiqZone[];
  smartMoneySignal?: string;
}

export default function SolTradingViewChart({ timeframe, srLevels, liqZones, smartMoneySignal }: Props) {
  const cfg = TIMEFRAME_CONFIG[timeframe];
  const height = 520;
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<any>(null);
  const [loading, setLoading] = useState(true);
  const [hasChartError, setHasChartError] = useState(false);

  // Draw S/R horizontal lines and liquidation zone rectangles
  const drawChartOverlays = (widget: any) => {
    try {
      const chart = widget.activeChart ? widget.activeChart() : widget.chart();
      if (!chart) { console.log('[CHART] No chart object'); return; }

      // Get visible time range
      let from, to;
      try {
        const range = chart.getVisibleRange();
        from = range?.from;
        to = range?.to;
      } catch(e) {
        // Fallback: use current time range
        const now = Math.floor(Date.now() / 1000);
        from = now - 30 * 86400; // 30 days back
        to = now + 86400; // 1 day forward
      }
      if (!from || !to) { console.log('[CHART] No time range'); return; }

      console.log('[CHART] Drawing overlays, srLevels:', srLevels?.resistances?.length, 'resistances,', srLevels?.supports?.length, 'supports');
      
      // Clear existing shapes first
      try { chart.removeAllShapes(); } catch(e) {}

      // Draw S/R levels as horizontal lines
      if (srLevels) {
        srLevels.resistances?.forEach((r: SRLevel, i: number) => {
          try {
            chart.createMultipointShape(
              [{ price: r.price, time: from }, { price: r.price, time: to }],
              {
                shape: 'horizontal_line',
                lock: true,
                disableSelection: true,
                overrides: {
                  linecolor: 'rgba(239, 68, 68, 0.85)',
                  linewidth: 2,
                  linestyle: 2,
                  showLabel: true,
                  text: `R${i + 1} — ${r.strength}%`,
                  textcolor: '#ef4444',
                  fontsize: 11,
                },
              }
            );
          } catch(e) { console.warn('[CHART] Failed to draw resistance', i, e); }
        });

        srLevels.supports?.forEach((s: SRLevel, i: number) => {
          try {
            chart.createMultipointShape(
              [{ price: s.price, time: from }, { price: s.price, time: to }],
              {
                shape: 'horizontal_line',
                lock: true,
                disableSelection: true,
                overrides: {
                  linecolor: 'rgba(34, 197, 94, 0.85)',
                  linewidth: 2,
                  linestyle: 2,
                  showLabel: true,
                  text: `S${i + 1} — ${s.strength}%`,
                  textcolor: '#22c55e',
                  fontsize: 11,
                },
              }
            );
          } catch(e) { console.warn('[CHART] Failed to draw support', i, e); }
        });
      }

      // Draw liquidation zones as rectangles
      if (liqZones) {
        liqZones.forEach((z: LiqZone) => {
          try {
            const isLong = z.side === 'long';
            chart.createMultipointShape(
              [{ time: from, price: z.priceHigh }, { time: to, price: z.priceLow }],
              {
                shape: 'rectangle',
                lock: true,
                disableSelection: true,
                overrides: {
                  backgroundColor: isLong ? 'rgba(34, 197, 94, 0.08)' : 'rgba(239, 68, 68, 0.08)',
                  borderColor: isLong ? 'rgba(34, 197, 94, 0.35)' : 'rgba(239, 68, 68, 0.35)',
                  borderWidth: 1,
                  showLabel: true,
                  text: `${isLong ? 'Long' : 'Short'} Liq $${(z.valueUsd / 1e6).toFixed(1)}M`,
                  textcolor: isLong ? '#22c55e' : '#ef4444',
                  fontsize: 10,
                },
              }
            );
          } catch(e) { console.warn('[CHART] Failed to draw liq zone', e); }
        });
      }
      
      console.log('[CHART] Overlays drawn ✅');
    } catch (e) {
      console.warn('[CHART] drawChartOverlays failed:', e);
    }
  };

  // Initialize TradingView widget
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const loadTradingViewScript = () => {
      return new Promise<void>((resolve, reject) => {
        if (window.TradingView) {
          resolve();
          return;
        }
        const script = document.createElement('script');
        script.src = 'https://s3.tradingview.com/tv.js';
        script.async = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('Failed to load TradingView script'));
        document.head.appendChild(script);
      });
    };

    const initWidget = async () => {
      try {
        await loadTradingViewScript();
        if (!window.TradingView) throw new Error('TradingView not available');

        const container = chartContainerRef.current;
        if (!container) return;

        // Clean up previous widget instance
        if (widgetRef.current) {
          widgetRef.current.remove();
          widgetRef.current = null;
        }

        const widget = new window.TradingView.widget({
          container_id: container.id,
          symbol: 'BINANCE:SOLUSDT',
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
          height: String(height),
          onChartReady: () => {
            widgetRef.current = widget;
            drawChartOverlays(widget);
            setLoading(false);
          },
        });
        
        // Fallback: if onChartReady doesn't fire within 5s, hide loading anyway
        setTimeout(() => {
          setLoading(false);
          widgetRef.current = widget;
          try { drawChartOverlays(widget); } catch(e) {}
        }, 5000);
      } catch (err) {
        console.error('Error initializing TradingView widget:', err);
        setHasChartError(true);
        setLoading(false);
      }
    };

    initWidget();

    return () => {
      if (widgetRef.current) {
        widgetRef.current.remove();
        widgetRef.current = null;
      }
    };
  }, [timeframe, cfg.tvRes]);

  // Redraw overlays when overlay data props change (if widget already ready)
  useEffect(() => {
    if (widgetRef.current) {
      drawChartOverlays(widgetRef.current);
    }
  }, [srLevels, liqZones]);

  // Render signal badges based on smart money signal
  const renderSmartMoneyBadges = () => {
    if (!smartMoneySignal) return null;

    let badgeText = '';
    let badgeClass = '';

    if (smartMoneySignal === 'LONGS_DOMINANT') {
      badgeText = 'Crowded Longs';
      badgeClass = 'bg-red-500/20 text-red-400 border-red-500/30';
    } else if (smartMoneySignal === 'SHORTS_DOMINANT') {
      badgeText = 'Squeeze Warning';
      badgeClass = 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
    }

    if (!badgeText) return null;
    return (
      <div className="absolute top-3 right-3 z-10">
        <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${badgeClass}`}>
          {badgeText}
        </span>
      </div>
    );
  };

  // Error state
  if (hasChartError) {
    return (
      <div style={{ width: '100%', height }} className="bg-[var(--bg-primary)] flex flex-col items-center justify-center gap-3 relative">
        {renderSmartMoneyBadges()}
        <div className="text-4xl">📊</div>
        <p className="text-[var(--text-secondary)] text-sm font-medium">Chart unavailable</p>
        <p className="text-[var(--text-muted)] text-xs">TradingView widget could not load</p>
        <button
          onClick={() => {
            setHasChartError(false);
            setLoading(true);
          }}
          className="mt-2 px-4 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded-lg text-[var(--text-secondary)] text-xs font-medium hover:bg-[var(--bg-surface)] transition"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height, borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.06)' }} className="relative">
      {renderSmartMoneyBadges()}
      <div
        id="sol_tv_chart_container"
        ref={chartContainerRef}
        style={{ width: '100%', height: '100%' }}
      />
      {loading && (
        <div className="absolute inset-0 bg-[var(--bg-primary)]/80 flex items-center justify-center">
          <p className="text-[var(--text-secondary)] text-sm">Loading chart and market data...</p>
        </div>
      )}
    </div>
  );
}
