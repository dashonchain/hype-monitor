'use client';

import { useEffect, useRef } from 'react';
import {
  createChart, ColorType, CandlestickSeries, LineSeries,
  type IChartApi, type Time, type CandlestickData,
} from 'lightweight-charts';

interface PriceChartProps {
  prices: [number, number][];
  ema20History: [number, number][];
  ema50History: [number, number][];
  ema200History: [number, number][];
  rsiHistory: [number, number][];
}

function buildCandles(prices: [number, number][], barCount = 200): CandlestickData<Time>[] {
  if (prices.length < 2) return [];
  const step = Math.max(1, Math.floor(prices.length / barCount));
  const sampled = prices.filter((_, i) => i % step === 0);
  const candles: CandlestickData<Time>[] = [];
  for (let i = 1; i < sampled.length; i++) {
    const open = sampled[i - 1][1];
    const close = sampled[i][1];
    const high = Math.max(open, close) * 1.001;
    const low = Math.min(open, close) * 0.999;
    candles.push({
      time: (sampled[i][0] / 1000) as Time,
      open: +open.toFixed(4),
      high: +high.toFixed(4),
      low: +low.toFixed(4),
      close: +close.toFixed(4),
    });
  }
  return candles;
}

const toLine = (data: [number, number][]) =>
  data.filter(([, v]) => v != null && !isNaN(v) && v !== 0)
    .map(([ts, val]) => ({ time: (ts / 1000) as Time, value: +val.toFixed(4) }));

const LW = 1 as any; // lightweight-charts LineWidth type workaround
const LW2 = 2 as any;

export default function PriceChart({ prices, ema20History, ema50History, ema200History, rsiHistory }: PriceChartProps) {
  const priceRef = useRef<HTMLDivElement>(null);
  const rsiRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const rsiChartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    if (!priceRef.current || !prices.length) return;
    chartRef.current?.remove();
    rsiChartRef.current?.remove();
    chartRef.current = null;
    rsiChartRef.current = null;

    const chart = createChart(priceRef.current, {
      layout: { background: { type: ColorType.Solid, color: '#0a0c11' }, textColor: '#6b7280', fontSize: 11 },
      grid: { vertLines: { color: '#1a1d25' }, horzLines: { color: '#1a1d25' } },
      crosshair: { mode: 1, vertLine: { color: '#374151', width: 1, style: 2 }, horzLine: { color: '#374151', width: 1, style: 2 } },
      rightPriceScale: { borderColor: '#1f2937', scaleMargins: { top: 0.08, bottom: 0.25 } },
      timeScale: { borderColor: '#1f2937', timeVisible: true, secondsVisible: false },
    });
    chartRef.current = chart;
    chart.applyOptions({ width: priceRef.current.clientWidth });

    // Candlesticks
    const candles = buildCandles(prices);
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#22c55e', downColor: '#ef4444',
      borderUpColor: '#22c55e', borderDownColor: '#ef4444',
      wickUpColor: '#22c55e88', wickDownColor: '#ef444488',
    });
    candleSeries.setData(candles);

    // EMA lines
    const emas: [string, string, [number, number][]][] = [
      ['#f472b6', 'EMA 20', ema20History],
      ['#60a5fa', 'EMA 50', ema50History],
      ['#facc15', 'EMA 200', ema200History],
    ];
    for (const [color, title, data] of emas) {
      if (data.length > 2) {
        const s = chart.addSeries(LineSeries, { color, lineWidth: LW, title, lastValueVisible: false, priceLineVisible: false, crosshairMarkerVisible: false });
        s.setData(toLine(data));
      }
    }
    chart.timeScale().fitContent();

    // RSI
    const validRsi = toLine(rsiHistory);
    if (rsiRef.current && validRsi.length > 0) {
      const rsiChart = createChart(rsiRef.current, {
        layout: { background: { type: ColorType.Solid, color: '#0a0c11' }, textColor: '#6b7280', fontSize: 11 },
        grid: { vertLines: { color: '#1a1d25' }, horzLines: { color: '#1a1d25' } },
        crosshair: { mode: 1 },
        rightPriceScale: { borderColor: '#1f2937', scaleMargins: { top: 0.1, bottom: 0.1 } },
        timeScale: { borderColor: '#1f2937', timeVisible: true, secondsVisible: false },
      });
      rsiChartRef.current = rsiChart;
      rsiChart.applyOptions({ width: priceRef.current.clientWidth });

      const rsiLine = rsiChart.addSeries(LineSeries, { color: '#a78bfa', lineWidth: LW2, title: 'RSI', lastValueVisible: false, priceLineVisible: false });
      rsiLine.setData(validRsi);

      const ob = rsiChart.addSeries(LineSeries, { color: '#ef444466', lineWidth: LW, lastValueVisible: false, priceLineVisible: false });
      ob.setData([{ time: validRsi[0].time, value: 70 }, { time: validRsi[validRsi.length - 1].time, value: 70 }]);

      const os = rsiChart.addSeries(LineSeries, { color: '#22c55e66', lineWidth: LW, lastValueVisible: false, priceLineVisible: false });
      os.setData([{ time: validRsi[0].time, value: 30 }, { time: validRsi[validRsi.length - 1].time, value: 30 }]);

      const mid = rsiChart.addSeries(LineSeries, { color: '#ffffff15', lineWidth: LW, lastValueVisible: false, priceLineVisible: false });
      mid.setData([{ time: validRsi[0].time, value: 50 }, { time: validRsi[validRsi.length - 1].time, value: 50 }]);

      const rng = chart.timeScale().getVisibleLogicalRange();
      if (rng) rsiChart.timeScale().setVisibleLogicalRange(rng);
    }

    // Sync crosshair
    const syncHandler = (param: any) => {
      if (param.time && rsiChartRef.current) {
        rsiChartRef.current.setCrosshairPosition(param.time as number, (param.point?.y ?? 0) as any, undefined as any);
      }
    };
    chart.subscribeCrosshairMove(syncHandler);

    const onResize = () => {
      if (priceRef.current && chartRef.current) chartRef.current.applyOptions({ width: priceRef.current.clientWidth });
      if (rsiRef.current && rsiChartRef.current) rsiChartRef.current.applyOptions({ width: rsiRef.current.clientWidth });
    };
    window.addEventListener('resize', onResize);

    return () => {
      window.removeEventListener('resize', onResize);
      chart.unsubscribeCrosshairMove(syncHandler);
      chartRef.current?.remove();
      rsiChartRef.current?.remove();
      chartRef.current = null;
      rsiChartRef.current = null;
    };
  }, [prices, ema20History, ema50History, ema200History, rsiHistory]);

  return (
    <div className="bg-zinc-900/60 border border-zinc-800/50 rounded-xl overflow-hidden">
      <div className="px-4 py-2 border-b border-zinc-800/40 flex items-center justify-between">
        <h3 className="text-xs font-semibold text-zinc-300">Price Chart</h3>
        <div className="flex gap-3 text-[9px]">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-emerald-500 inline-block" /> Bullish</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-red-500 inline-block" /> Bearish</span>
          <span className="flex items-center gap-1"><span className="w-2 h-0.5 bg-pink-400 inline-block rounded" /> EMA 20</span>
          <span className="flex items-center gap-1"><span className="w-2 h-0.5 bg-blue-400 inline-block rounded" /> EMA 50</span>
          <span className="flex items-center gap-1"><span className="w-2 h-0.5 bg-yellow-400 inline-block rounded" /> EMA 200</span>
        </div>
      </div>
      <div ref={priceRef} style={{ height: 400 }} />
      {rsiHistory.length > 0 && (
        <div className="border-t border-zinc-800/40">
          <div className="px-4 py-1 flex items-center justify-between">
            <span className="text-[9px] text-zinc-600">RSI (14)</span>
            <div className="flex gap-3 text-[9px]">
              <span className="flex items-center gap-1"><span className="w-2 h-0.5 bg-red-500/60 inline-block rounded" /> 70 Overbought</span>
              <span className="flex items-center gap-1"><span className="w-2 h-0.5 bg-green-500/60 inline-block rounded" /> 30 Oversold</span>
              <span className="flex items-center gap-1"><span className="w-2 h-0.5 bg-purple-400 inline-block rounded" /> RSI</span>
            </div>
          </div>
          <div ref={rsiRef} style={{ height: 110 }} />
        </div>
      )}
    </div>
  );
}
