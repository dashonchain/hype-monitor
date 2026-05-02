import { useEffect, useRef } from 'react';
import { createChart, IChartApi, LineSeries, Time, ColorType } from 'lightweight-charts';

interface PriceChartProps {
  prices: [number, number][]; // [timestamp_ms, price]
  ema20History: [number, number][];
  ema50History: [number, number][];
  ema200History: [number, number][];
}

const PriceChart = ({ prices, ema20History, ema50History, ema200History }: PriceChartProps) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    if (!chartContainerRef.current || !prices.length) return;

    // Nettoyer le graphique précédent
    if (chartRef.current) {
      chartRef.current.remove();
    }

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

    // Convertir les données en format TradingView (temps en secondes)
    const toChartData = (data: [number, number][]) => 
      data
        .filter(([ts, val]) => val !== null)
        .map(([timestamp, value]) => ({
          time: (timestamp / 1000) as Time,
          value: value as number,
        }));

    // Série de prix (candlestick ou ligne)
    const priceSeries = chart.addSeries(LineSeries, {
      color: '#26a69a',
      lineWidth: 2,
      title: 'Prix HYPE',
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

    // Gestion du redimensionnement
    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
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
    };
  }, [prices, ema20History, ema50History, ema200History]);

  return (
    <div className="bg-gray-900 p-4 rounded-lg shadow-lg">
      <h3 className="text-lg font-semibold text-white mb-2">📈 Graphique des Prix & EMA</h3>
      <div ref={chartContainerRef} style={{ width: '100%', height: '400px' }} />
    </div>
  );};

export default PriceChart;