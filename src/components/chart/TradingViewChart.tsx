'use client';

import { useState, useEffect, useRef } from 'react';
import type { Timeframe } from '../../types';
import { TIMEFRAME_CONFIG } from '../../types';

// Add type declaration for TradingView
declare global {
  interface Window {
    TradingView?: any;
  }
}

interface HypeData {
  srLevels?: {
    R1?: number;
    S1?: number;
    S2?: number;
    S3?: number;
  };
  liqZones?: {
    long?: { min: number; max: number };
    short?: { min: number; max: number };
  };
  smartMoneyRatio?: number;
}

interface Props {
  timeframe: Timeframe;
}

export default function TradingViewChart({ timeframe }: Props) {
  const cfg = TIMEFRAME_CONFIG[timeframe];
  const height = 520;
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<any>(null);
  const [hypeData, setHypeData] = useState<HypeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [hasChartError, setHasChartError] = useState(false);

  // Fetch S/R levels, liquidation zones, and smart money ratio from API
  useEffect(() => {
    const fetchHypeData = async () => {
      try {
        const res = await fetch('/api/hype');
        if (!res.ok) throw new Error('Failed to fetch hype data');
        const data = await res.json();
        // Transform API response to component format
        const transformed: HypeData = {
          smartMoneyRatio: data.smartMoney?.ratio,
          srLevels: {
            R1: data.srLevels?.resistances?.[0]?.price,
            S1: data.srLevels?.supports?.[0]?.price,
            S2: data.srLevels?.supports?.[1]?.price,
            S3: data.srLevels?.supports?.[2]?.price,
          },
          liqZones: {
            long: data.liqZones?.filter((z: any) => z.side === 'long').map((z: any) => ({ min: z.low, max: z.high }))[0],
            short: data.liqZones?.filter((z: any) => z.side === 'short').map((z: any) => ({ min: z.low, max: z.high }))[0],
          }
        };
        setHypeData(transformed);
      } catch (err) {
        console.error('Error fetching hype data:', err);
        setError(true);
      } finally {
        setLoading(false);
      }
    };
    fetchHypeData();
  }, []);

  // Initialize TradingView widget and draw overlays when ready
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
            drawChartOverlays(widget);
          },
        });
      } catch (err) {
        console.error('Error initializing TradingView widget:', err);
        setHasChartError(true);
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

  // Draw S/R horizontal lines and liquidation zone rectangles
  const drawChartOverlays = (widget: any) => {
    if (!hypeData) return;
    const chart = widget.chart();
    if (!chart) return;

    const visibleRange = chart.getVisibleRange();

    // Draw S/R levels as horizontal lines with labels
    if (hypeData.srLevels) {
      const srEntries = [
        { key: 'R1', price: hypeData.srLevels.R1, color: '#FF6B6B', label: 'Resistance' },
        { key: 'S1', price: hypeData.srLevels.S1, color: '#51CF66', label: 'Support' },
        { key: 'S2', price: hypeData.srLevels.S2, color: '#51CF66', label: 'Support' },
        { key: 'S3', price: hypeData.srLevels.S3, color: '#51CF66', label: 'Support' },
      ];

      srEntries.forEach(({ key, price, color, label }) => {
        if (price === undefined) return;
        chart.createMultipointShape(
          [
            { price, time: visibleRange.from },
            { price, time: visibleRange.to },
          ],
          {
            shape: 'horizontal_line',
            lock: true,
            color,
            linewidth: 2,
            linestyle: 2, // Dashed line
            text: `${key} (${price.toFixed(2)}) - ${label}`,
            textcolor: color,
            fontsize: 12,
            override: {
              showLabel: true,
            },
          }
        );
      });
    }

    // Draw liquidation zones as rectangles
    if (hypeData.liqZones) {
      // Long liquidation zone (green)
      if (hypeData.liqZones.long) {
        const { min, max } = hypeData.liqZones.long;
        chart.createMultipointShape(
          [
            { price: max, time: visibleRange.from }, // Top-left corner
            { price: min, time: visibleRange.to },   // Bottom-right corner
          ],
          {
            shape: 'rectangle',
            lock: true,
            color: 'rgba(81, 207, 102, 0.15)', // Semi-transparent green fill
            borderColor: '#51CF66',
            borderWidth: 1,
            text: `Long Liq Zone (${min.toFixed(2)}-${max.toFixed(2)})`,
            textcolor: '#51CF66',
            fontsize: 10,
          }
        );
      }

      // Short liquidation zone (red)
      if (hypeData.liqZones.short) {
        const { min, max } = hypeData.liqZones.short;
        chart.createMultipointShape(
          [
            { price: max, time: visibleRange.from },
            { price: min, time: visibleRange.to },
          ],
          {
            shape: 'rectangle',
            lock: true,
            color: 'rgba(255, 107, 107, 0.15)', // Semi-transparent red fill
            borderColor: '#FF6B6B',
            borderWidth: 1,
            text: `Short Liq Zone (${min.toFixed(2)}-${max.toFixed(2)})`,
            textcolor: '#FF6B6B',
            fontsize: 10,
          }
        );
      }
    }
  };

  // Render Crowded Longs/Squeeze badges based on smart money ratio
  const renderSmartMoneyBadges = () => {
    if (!hypeData?.smartMoneyRatio) return null;
    const ratio = hypeData.smartMoneyRatio;
    let badgeText = '';
    let badgeClass = '';

    if (ratio > 1.5) {
      badgeText = 'Crowded Longs';
      badgeClass = 'bg-red-500/20 text-red-400 border-red-500/30';
    } else if (ratio < 0.7) {
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
  if (hasChartError || error) {
    return (
      <div style={{ width: '100%', height }} className="bg-[var(--bg-primary)] flex flex-col items-center justify-center gap-3 relative">
        {renderSmartMoneyBadges()}
        <div className="text-4xl">📊</div>
        <p className="text-[var(--text-secondary)] text-sm font-medium">Chart unavailable</p>
        <p className="text-[var(--text-muted)] text-xs">
          {error ? 'Failed to load market data' : 'TradingView widget could not load'}
        </p>
        <button
          onClick={() => {
            setHasChartError(false);
            setError(false);
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
