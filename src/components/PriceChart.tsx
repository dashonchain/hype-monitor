import { useEffect, useRef } from 'react';
import { createChart, IChartApi, LineSeries, Time, ColorType } from 'lightweight-charts';

interface PriceChartProps {
  prices: [number, number][]; // [timestamp_ms, price]
  ema20History: [number, number][];
  ema50History: [number, number][];
  ema200History: [number, number][];
  rsiHistory: [number, number][];
}

const PriceChart = ({ prices, ema20History, ema50History, ema200History, rsiHistory }: PriceChartProps) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const rsiChartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const rsiChartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    if (!chartContainerRef.current || !prices.length) return;

    // Clean previous charts
    if (chartRef.current) chartRef.current.remove();
    if (rsiChartRef.current) rsiChartRef.current.remove();

    // --- Main Price Chart ---
    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: 400,
      layout: {
        background: { type: ColorType.Solid, color: '#131722' },
        textColor: '#d1d4dc',
      },
      grid: {
        vertLines: { color: '#363c4e' },
        horzLines: { color: '#363c4e' },
      },
      crosshair: {
        mode: 1, // Normal
      },
    });

    chartRef.current = chart;

    // Convert data to TradingView format (time in seconds)
    const toChartData = (data: [number, number][]) =>
      data
        .filter(([ts, val]) => val !== null)
        .map(([timestamp, value]) => ({
          time: (timestamp / 1000) as Time,
          value: value as number,
        }));

    // Price series
    const priceSeries = chart.addSeries(LineSeries, {
      color: '#26a69a',
      lineWidth: 2,
      title: 'HYPE Price',
      lastValueVisible: true,
      priceLineVisible: true,
    });
    priceSeries.setData(toChartData(prices));

    // EMA 20
    if (ema20History.length) {
      const ema20Series = chart.addSeries(LineSeries, {
        color: '#e91e63',
        lineWidth: 1,
        title: 'EMA 20',
        lastValueVisible: true,
        priceLineVisible: false,
      });
      ema20Series.setData(toChartData(ema20History));
    }

    // EMA 50
    if (ema50History.length) {
      const ema50Series = chart.addSeries(LineSeries, {
        color: '#2196f3',
        lineWidth: 1,
        title: 'EMA 50',
        lastValueVisible: true,
        priceLineVisible: false,
      });
      ema50Series.setData(toChartData(ema50History));
    }

    // EMA 200
    if (ema200History.length) {
      const ema200Series = chart.addSeries(LineSeries, {
        color: '#ffeb3b',
        lineWidth: 1,
        title: 'EMA 200',
        lastValueVisible: true,
        priceLineVisible: false,
      });
      ema200Series.setData(toChartData(ema200History));
    }

    // --- RSI Chart (Separate) ---
    if (rsiChartContainerRef.current && rsiHistory.length) {
      const rsiChart = createChart(rsiChartContainerRef.current, {
        width: rsiChartContainerRef.current.clientWidth,
        height: 150,
        layout: {
          background: { type: ColorType.Solid, color: '#131722' },
          textColor: '#d1d4dc',
        },
        grid: {
          vertLines: { color: '#363c4e' },
          horzLines: { color: '#363c4e' },
        },
        crosshair: {
          mode: 1,
        },
      });

      rsiChartRef.current = rsiChart;

      // RSI series
      const rsiSeries = rsiChart.addSeries(LineSeries, {
        color: '#9c27b0',
        lineWidth: 2,
        title: 'RSI(14)',
        lastValueVisible: true,
        priceLineVisible: true,
      });
      rsiSeries.setData(toChartData(rsiHistory));

      // Add overbought/oversold lines
      const overboughtLine = rsiChart.addSeries(LineSeries, {
        color: '#ff5252',
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
      });
      overboughtLine.setData([
        { time: (rsiHistory[0][0] / 1000) as Time, value: 70 },
        { time: (rsiHistory[rsiHistory.length - 1][0] / 1000) as Time, value: 70 },
      ]);

      const oversoldLine = rsiChart.addSeries(LineSeries, {
        color: '#4caf50',
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
      });
      oversoldLine.setData([
        { time: (rsiHistory[0][0] / 1000) as Time, value: 30 },
        { time: (rsiHistory[rsiHistory.length - 1][0] / 1000) as Time, value: 30 },
      ]);

      // Sync time scales
      const logicalRange = chart.timeScale().getVisibleLogicalRange();
      if (logicalRange) {
        rsiChart.timeScale().setVisibleLogicalRange(logicalRange);
      }
    }

    // Handle resize
    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
        });
      }
      if (rsiChartContainerRef.current && rsiChartRef.current) {
        rsiChartRef.current.applyOptions({
          width: rsiChartContainerRef.current.clientWidth,
        });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
      if (rsiChartRef.current) {
        rsiChartRef.current.remove();
        rsiChartRef.current = null;
      }
    };
  }, [prices, ema20History, ema50History, ema200History, rsiHistory]);

  return (
    <div className="bg-gray-900/30 border border-gray-800/50 rounded-xl overflow-hidden">
      <div className="p-4 border-b border-gray-800/50">
        <h3 className="text-lg font-medium text-gray-100">📈 Price & Indicators</h3>
        <p className="text-xs text-gray-400 mt-1">EMA 20/50/200 overlays • RSI(14) • 1y history</p>
      </div>
      <div ref={chartContainerRef} className="w-full" style={{ height: '400px' }} />
      {rsiHistory.length > 0 && (
        <div className="border-t border-gray-800/50">
          <div className="p-2 border-b border-gray-800/50">
            <span className="text-xs text-gray-400">RSI(14) - Purple line • Red=70 (Overbought) • Green=30 (Oversold)</span>
          </div>
          <div ref={rsiChartContainerRef} className="w-full" style={{ height: '150px' }} />
        </div>
      )}
    </div>
  );
};

export default PriceChart;
