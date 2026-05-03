'use client';

import { useEffect, useRef } from 'react';
import {
  createChart, ColorType, CandlestickSeries, LineSeries, HistogramSeries,
  type IChartApi, type Time, type CandlestickData,
} from 'lightweight-charts';

interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface Props {
  candles: Candle[];
  sma10History: [number, number][];
  sma20History: [number, number][];
  sma50History: [number, number][];
  rsiHistory: [number, number][];
}

const LW = 1 as any;
const LW2 = 2 as any;

const toLine = (data: [number, number][]) =>
  data.filter(([, v]) => v != null && !isNaN(v) && v !== 0)
    .map(([ts, val]) => ({ time: (ts / 1000) as Time, value: +val }));

export default function PriceChart({ candles, sma10History, sma20History, sma50History, rsiHistory }: Props) {
  const priceRef = useRef<HTMLDivElement>(null);
  const rsiRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const rsiChartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    if (!priceRef.current || !candles.length) return;

    // Cleanup previous
    chartRef.current?.remove();
    rsiChartRef.current?.remove();
    chartRef.current = null;
    rsiChartRef.current = null;

    // ─── Price Chart ───
    const chart = createChart(priceRef.current, {
      layout: { background: { type: ColorType.Solid, color: '#0a0c11' }, textColor: '#6b7280', fontSize: 11 },
      grid: { vertLines: { color: '#1a1d25' }, horzLines: { color: '#1a1d25' } },
      crosshair: { mode: 1, vertLine: { color: '#374151', width: 1, style: 2 }, horzLine: { color: '#374151', width: 1, style: 2 } },
      rightPriceScale: { borderColor: '#1f2937', scaleMargins: { top: 0.05, bottom: 0.25 } },
      timeScale: { borderColor: '#1f2937', timeVisible: true, secondsVisible: false },
    });
    chartRef.current = chart;
    chart.applyOptions({ width: priceRef.current.clientWidth });

    // Candlesticks
    const candleData: CandlestickData<Time>[] = candles.map(c => ({
      time: (c.time / 1000) as Time,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#22c55e', downColor: '#ef4444',
      borderUpColor: '#22c55e', borderDownColor: '#ef4444',
      wickUpColor: '#22c55e88', wickDownColor: '#ef444488',
    });
    candleSeries.setData(candleData);

    // Volume histogram
    const volSeries = chart.addSeries(HistogramSeries, {
      color: '#26a69a',
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume',
    });
    chart.priceScale('volume').applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });
    volSeries.setData(candles.map(c => ({
      time: (c.time / 1000) as Time,
      value: c.volume,
      color: c.close >= c.open ? '#22c55e44' : '#ef444444',
    })));

    // SMA lines
    const smas: [string, string, [number, number][]][] = [
      ['#f9a8d4', 'SMA 10', sma10History],
      ['#f472b6', 'SMA 20', sma20History],
      ['#60a5fa', 'SMA 50', sma50History],
    ];
    for (const [color, title, data] of smas) {
      if (data.length > 2) {
        const s = chart.addSeries(LineSeries, { color, lineWidth: LW, title, lastValueVisible: false, priceLineVisible: false, crosshairMarkerVisible: false });
        s.setData(toLine(data));
      }
    }
    chart.timeScale().fitContent();

    // ─── RSI Chart ───
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

      // Overbought 70
      rsiChart.addSeries(LineSeries, { color: '#ef444444', lineWidth: LW, lastValueVisible: false, priceLineVisible: false })
        .setData([{ time: validRsi[0].time, value: 70 }, { time: validRsi[validRsi.length - 1].time, value: 70 }]);
      // Oversold 30
      rsiChart.addSeries(LineSeries, { color: '#22c55e44', lineWidth: LW, lastValueVisible: false, priceLineVisible: false })
        .setData([{ time: validRsi[0].time, value: 30 }, { time: validRsi[validRsi.length - 1].time, value: 30 }]);
      // Midline 50
      rsiChart.addSeries(LineSeries, { color: '#ffffff10', lineWidth: LW, lastValueVisible: false, priceLineVisible: false })
        .setData([{ time: validRsi[0].time, value: 50 }, { time: validRsi[validRsi.length - 1].time, value: 50 }]);

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
  }, [candles, sma10History, sma20History, sma50History, rsiHistory]);

  return (
    <div className="bg-zinc-900/60 border border-zinc-800/50 rounded-xl overflow-hidden">
      <div className="px-4 py-2 border-b border-zinc-800/40 flex items-center justify-between">
        <h3 className="text-xs font-semibold text-zinc-300">HYPE/USDT · Candlestick Chart</h3>
        <div className="flex gap-3 text-[9px]">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-emerald-500 inline-block" /> Bullish</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-red-500 inline-block" /> Bearish</span>
          <span className="flex items-center gap-1"><span className="w-2 h-0.5 bg-pink-300 inline-block rounded" /> SMA 10</span>
          <span className="flex items-center gap-1"><span className="w-2 h-0.5 bg-pink-400 inline-block rounded" /> SMA 20</span>
          <span className="flex items-center gap-1"><span className="w-2 h-0.5 bg-blue-400 inline-block rounded" /> SMA 50</span>
        </div>
      </div>
      <div ref={priceRef} style={{ height: 380 }} />
      {rsiHistory.length > 0 && (
        <div className="border-t border-zinc-800/40">
          <div className="px-4 py-1 flex items-center justify-between">
            <span className="text-[9px] text-zinc-600">RSI (14)</span>
            <div className="flex gap-3 text-[9px]">
              <span className="flex items-center gap-1"><span className="w-2 h-0.5 bg-red-500/50 inline-block rounded" /> 70 Overbought</span>
              <span className="flex items-center gap-1"><span className="w-2 h-0.5 bg-green-500/50 inline-block rounded" /> 30 Oversold</span>
              <span className="flex items-center gap-1"><span className="w-2 h-0.5 bg-purple-400 inline-block rounded" /> RSI</span>
            </div>
          </div>
          <div ref={rsiRef} style={{ height: 100 }} />
        </div>
      )}
    </div>
  );
}
