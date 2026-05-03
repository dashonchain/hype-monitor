import { useEffect, useRef } from 'react';
import { createChart, ColorType, LineSeries, type IChartApi, type Time } from 'lightweight-charts';

interface PriceChartProps {
  prices: [number, number][];
  ema20History: [number, number][];
  ema50History: [number, number][];
  ema200History: [number, number][];
  rsiHistory: [number, number][];
}

const toChartData = (data: [number, number][]) =>
  data
    .filter(([, val]) => val !== null && val !== undefined && !isNaN(val))
    .map(([ts, val]) => ({ time: (ts / 1000) as Time, value: val }));

const PriceChart = ({ prices, ema20History, ema50History, ema200History, rsiHistory }: PriceChartProps) => {
  const priceRef = useRef<HTMLDivElement>(null);
  const rsiRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const rsiChartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    if (!priceRef.current || !prices.length) return;

    // Cleanup
    chartRef.current?.remove();
    rsiChartRef.current?.remove();
    chartRef.current = null;
    rsiChartRef.current = null;

    // ─── Price Chart ───
    const priceChart = createChart(priceRef.current, {
      layout: { background: { type: ColorType.Solid, color: '#0d1220' }, textColor: '#9598a1' },
      grid: { vertLines: { color: '#1e2433' }, horzLines: { color: '#1e2433' } },
      crosshair: { mode: 1 },
      rightPriceScale: { borderColor: '#1e2433' },
      timeScale: { borderColor: '#1e2433', timeVisible: true, secondsVisible: false },
    });
    chartRef.current = priceChart;

    const w = priceRef.current.clientWidth;
    priceChart.applyOptions({ width: w });

    // Price line
    const priceSeries = priceChart.addSeries(LineSeries, {
      color: '#06b6d4', lineWidth: 2, title: 'HYPE',
      lastValueVisible: true, priceLineVisible: true, priceLineWidth: 1,
    });
    priceSeries.setData(toChartData(prices));

    // EMA 20
    if (ema20History.length > 20) {
      const s = priceChart.addSeries(LineSeries, { color: '#f472b6', lineWidth: 1, title: 'EMA 20', lastValueVisible: true, priceLineVisible: false });
      s.setData(toChartData(ema20History));
    }
    // EMA 50
    if (ema50History.length > 50) {
      const s = priceChart.addSeries(LineSeries, { color: '#60a5fa', lineWidth: 1, title: 'EMA 50', lastValueVisible: true, priceLineVisible: false });
      s.setData(toChartData(ema50History));
    }
    // EMA 200
    if (ema200History.length > 200) {
      const s = priceChart.addSeries(LineSeries, { color: '#facc15', lineWidth: 1, title: 'EMA 200', lastValueVisible: true, priceLineVisible: false });
      s.setData(toChartData(ema200History));
    }

    priceChart.timeScale().fitContent();

    // ─── RSI Chart ───
    const validRsi = rsiHistory.filter(([, v]) => v !== null && v !== undefined && !isNaN(v));
    if (rsiRef.current && validRsi.length > 0) {
      const rsiChart = createChart(rsiRef.current, {
        layout: { background: { type: ColorType.Solid, color: '#0d1220' }, textColor: '#9598a1' },
        grid: { vertLines: { color: '#1e2433' }, horzLines: { color: '#1e2433' } },
        crosshair: { mode: 1 },
        rightPriceScale: { borderColor: '#1e2433', scaleMargins: { top: 0.1, bottom: 0.1 } },
        timeScale: { borderColor: '#1e2433', timeVisible: true, secondsVisible: false },
      });
      rsiChartRef.current = rsiChart;
      rsiChart.applyOptions({ width: w });

      // RSI line
      const rsiSeries = rsiChart.addSeries(LineSeries, { color: '#a78bfa', lineWidth: 2, title: 'RSI(14)', lastValueVisible: true, priceLineVisible: true });
      rsiSeries.setData(toChartData(validRsi));

      // Overbought 70
      const ob = rsiChart.addSeries(LineSeries, { color: '#ef4444', lineWidth: 1 });
      ob.setData([
        { time: (validRsi[0][0] / 1000) as Time, value: 70 },
        { time: (validRsi[validRsi.length - 1][0] / 1000) as Time, value: 70 },
      ]);

      // Oversold 30
      const os = rsiChart.addSeries(LineSeries, { color: '#22c55e', lineWidth: 1 });
      os.setData([
        { time: (validRsi[0][0] / 1000) as Time, value: 30 },
        { time: (validRsi[validRsi.length - 1][0] / 1000) as Time, value: 30 },
      ]);

      const rng = priceChart.timeScale().getVisibleLogicalRange();
      if (rng) rsiChart.timeScale().setVisibleLogicalRange(rng);
    }

    // ─── Resize ───
    const onResize = () => {
      if (priceRef.current && chartRef.current) chartRef.current.applyOptions({ width: priceRef.current.clientWidth });
      if (rsiRef.current && rsiChartRef.current) rsiChartRef.current.applyOptions({ width: rsiRef.current.clientWidth });
    };
    window.addEventListener('resize', onResize);

    return () => {
      window.removeEventListener('resize', onResize);
      chartRef.current?.remove();
      rsiChartRef.current?.remove();
      chartRef.current = null;
      rsiChartRef.current = null;
    };
  }, [prices, ema20History, ema50History, ema200History, rsiHistory]);

  return (
    <div className="bg-slate-900/50 border border-slate-800/40 rounded-xl overflow-hidden">
      <div className="px-4 py-2.5 border-b border-slate-800/40 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Price & Indicators</h3>
          <p className="text-[10px] text-gray-500 mt-0.5">EMA 20/50/200 overlays • RSI(14) • 1Y history</p>
        </div>
        <div className="flex gap-3 text-[10px]">
          <span className="flex items-center gap-1"><span className="w-2 h-0.5 bg-cyan-400 inline-block rounded" /> Price</span>
          <span className="flex items-center gap-1"><span className="w-2 h-0.5 bg-pink-400 inline-block rounded" /> EMA 20</span>
          <span className="flex items-center gap-1"><span className="w-2 h-0.5 bg-blue-400 inline-block rounded" /> EMA 50</span>
          <span className="flex items-center gap-1"><span className="w-2 h-0.5 bg-yellow-400 inline-block rounded" /> EMA 200</span>
        </div>
      </div>
      <div ref={priceRef} style={{ height: 380 }} />

      {rsiHistory.length > 0 && (
        <div className="border-t border-slate-800/40">
          <div className="px-4 py-1.5 border-b border-slate-800/30 flex items-center justify-between">
            <span className="text-[10px] text-gray-500">RSI(14) — Purple</span>
            <div className="flex gap-3 text-[10px]">
              <span className="flex items-center gap-1"><span className="w-2 h-0.5 bg-red-500 inline-block rounded" /> 70 Overbought</span>
              <span className="flex items-center gap-1"><span className="w-2 h-0.5 bg-green-500 inline-block rounded" /> 30 Oversold</span>
            </div>
          </div>
          <div ref={rsiRef} style={{ height: 120 }} />
        </div>
      )}
    </div>
  );
};

export default PriceChart;
