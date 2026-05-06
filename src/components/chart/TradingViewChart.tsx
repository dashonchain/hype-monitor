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

export default function TradingViewChart({ timeframe, srLevels, liqZones, smartMoneySignal }: Props) {
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
      if (!chart) return;

      const visibleRange = chart.getVisibleRange();
      if (!visibleRange || !visibleRange.from || !visibleRange.to) return;

      // Draw S/R levels as horizontal lines with labels using overrides
      if (srLevels) {
        // Resistances (red)
        srLevels.resistances?.forEach((r: SRLevel, i: number) => {
          chart.createMultipointShape(
            [
              { price: r.price, time: visibleRange.from },
              { price: r.price, time: visibleRange.to },
            ],
            {
              shape: 'horizontal_line',
              lock: true,
              overrides: {
                linecolor: '#FF6B6B',
                linewidth: 2,
                linestyle: 2, // Dashed
                showLabel: true,
                text: `R${i + 1} (${r.price.toFixed(2)})`,
                textcolor: '#FF6B6B',
                fontsize: 12,
              },
            }
          );
        });

        // Supports (green)
        srLevels.supports?.forEach((s: SRLevel, i: number) => {
          chart.createMultipointShape(
            [
              { price: s.price, time: visibleRange.from },
              { price: s.price, time: visibleRange.to },
            ],
            {
              shape: 'horizontal_line',
              lock: true,
              overrides: {
                linecolor: '#51CF66',
                linewidth: 2,
                linestyle: 2, // Dashed
                showLabel: true,
                text: `S${i + 1} (${s.price.toFixed(2)})`,
                textcolor: '#51CF66',
                fontsize: 12,
              },
            }
          );
        });
      }

      // Draw liquidation zones as rectangles
      if (liqZones) {
        liqZones.forEach((z: LiqZone) => {
          const isLong = z.side === 'long';
          const fillColor = isLong ? 'rgba(81, 207, 102, 0.15)' : 'rgba(255, 107, 107, 0.15)';
          const borderColor = isLong ? '#51CF66' : '#FF6B6B';
          const label = isLong ? 'Long Liq' : 'Short Liq';

          chart.createMultipointShape(
            [
              { price: z.priceHigh, time: visibleRange.from },
              { price: z.priceLow, time: visibleRange.to },
            ],
            {
              shape: 'rectangle',
              lock: true,
              overrides: {
                color: fillColor,
                borderColor: borderColor,
                borderWidth: 1,
                showLabel: true,
                text: `${label} (${z.priceLow.toFixed(2)}-${z.priceHigh.toFixed(2)})`,
                textcolor: borderColor,
                fontsize: 10,
              },
            }
          );
        });
      }
    } catch (e) {
      console.warn('Failed to draw overlays, chart may not be ready:', e);
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
          height: String(height),
          onChartReady: () => {
            widgetRef.current = widget;
            setTimeout(() => drawChartOverlays(widget), 300);
            setLoading(false);
          },
        });
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
        id="tv_chart_container"
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
