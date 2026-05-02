'use client';

import { useState, useEffect } from 'react';

type Indicator = {
  name: string;
  value: number | string;
  action: string;
  details?: string;
};

type HypeData = {
  result?: {
    technical_indicators?: Record<string, any>;
    support_resistance?: any;
    token_metadata?: any;
  };
};

const TIMEFRAMES = ['1h', '4h', '1d', '1w'];

export default function Home() {
  const [timeframe, setTimeframe] = useState('4h');
  const [data, setData] = useState<HypeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/hype?timeframe=${timeframe}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const json = await res.json();
      setData(json);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 300000); // Refresh every 5 min
    return () => clearInterval(interval);
  }, [timeframe]);

  const indicators: Indicator[] = [];
  if (data?.result?.technical_indicators) {
    const ti = data.result.technical_indicators;
    Object.entries(ti).forEach(([key, val]: [string, any]) => {
      if (val.value !== undefined) {
        indicators.push({
          name: key.replace(/_/g, ' ').toUpperCase(),
          value: val.value,
          action: val.state || val.zone || 'neutral',
          details: val.momentum ? `Momentum: ${val.momentum}` : undefined,
        });
      }
    });
  }

  const getActionColor = (action: string) => {
    if (action.includes('buy')) return 'text-green-600 bg-green-50';
    if (action.includes('sell')) return 'text-red-600 bg-red-50';
    return 'text-yellow-600 bg-yellow-50';
  };

  if (loading) return <div className="p-8 text-center">Loading HYPE data...</div>;
  if (error) return <div className="p-8 text-center text-red-600">Error: {error}</div>;

  const price = data?.result?.token_metadata?.token_info?.price || 'N/A';
  const priceChange = data?.result?.token_metadata?.price_change?.calendar?.['24h'] || 'N/A';

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">HYPE Monitor</h1>
            <p className="text-gray-600">
              Price: <span className="font-semibold">${price}</span> ({priceChange})
            </p>
          </div>
          <div className="flex gap-2">
            {TIMEFRAMES.map(tf => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                className={`px-4 py-2 rounded-lg ${
                  timeframe === tf
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-700 border border-gray-300'
                }`}
              >
                {tf}
              </button>
            ))}
          </div>
        </div>

        {/* Indicators Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {indicators.map(ind => (
            <div key={ind.name} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
              <div className="flex justify-between items-start">
                <h3 className="font-medium text-gray-900">{ind.name}</h3>
                <span className={`text-xs px-2 py-1 rounded-full ${getActionColor(ind.action)}`}>
                  {ind.action}
                </span>
              </div>
              <p className="text-2xl font-bold text-gray-900 mt-2">
                {typeof ind.value === 'number' ? ind.value.toFixed(2) : ind.value}
              </p>
              {ind.details && (
                <p className="text-sm text-gray-500 mt-1">{ind.details}</p>
              )}
            </div>
          ))}
        </div>

        {/* Support/Resistance */}
        {data?.result?.support_resistance?.['support and resistance channel'] && (
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h2 className="text-xl font-semibold mb-4">Support & Resistance</h2>
            <div className="grid grid-cols-2 gap-4">
              {data.result.support_resistance['support and resistance channel'].map((level: any, i: number) => (
                <div key={i} className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600">Strength: {level.strength}%</p>
                  <p className="font-semibold">${level.lo} - ${level.hi}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        <footer className="mt-8 text-center text-sm text-gray-500">
          Data powered by <a href="https://app.true-north.xyz/" className="text-blue-600">TrueNorth</a> | Auto-refreshes every 5 min
        </footer>
      </div>
    </main>
  );
}
