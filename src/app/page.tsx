'use client';

import { useState, useEffect } from 'react';

type Indicator = {
  name: string;
  value: number | string;
  action: string;
  details?: string;
  category?: string;
};

type HypeData = {
  result?: {
    technical_indicators?: Record<string, any>;
    support_resistance?: any;
    token_metadata?: any;
  };
};

const TIMEFRAMES = ['1h', '4h', '1d', '1w'];

// Helper to categorize indicators
function categorize(name: string): string {
  if (/rsi|stoch|cci|macd|momentum|kdj/i.test(name)) return 'Momentum';
  if (/sma|ema|adx|ichimoku|supertrend/i.test(name)) return 'Trend';
  if (/boll|atr|kC|donchian/i.test(name)) return 'Volatility';
  if (/volume|obv|cmf|vwap/i.test(name)) return 'Volume';
  return 'Other';
}

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
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`API ${res.status}: ${errText}`);
      }
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
    const interval = setInterval(fetchData, 300000); // 5 min
    return () => clearInterval(interval);
  }, [timeframe]);

  // Process indicators
  const indicators: Indicator[] = [];
  let buyCount = 0, sellCount = 0, neutralCount = 0;
  
  if (data?.result?.technical_indicators) {
    const ti = data.result.technical_indicators;
    Object.entries(ti).forEach(([key, val]: [string, any]) => {
      if (val.value !== undefined) {
        const action = val.state || val.zone || 'neutral';
        const name = key.replace(/_/g, ' ').toUpperCase();
        indicators.push({
          name,
          value: val.value,
          action,
          details: val.momentum ? `Momentum: ${val.momentum}` : undefined,
          category: categorize(name),
        });
        // Count signals
        if (action.includes('buy')) buyCount++;
        else if (action.includes('sell')) sellCount++;
        else neutralCount++;
      }
    });
  }

  // Decision logic
  const totalSignals = buyCount + sellCount + neutralCount;
  const decision = buyCount > sellCount ? 'BUY' : sellCount > buyCount ? 'SELL' : 'HOLD';
  const decisionColor = decision === 'BUY' ? 'text-green-400 bg-green-900/30 border-green-500' : 
                     decision === 'SELL' ? 'text-red-400 bg-red-900/30 border-red-500' : 
                     'text-yellow-400 bg-yellow-900/30 border-yellow-500';

  const price = data?.result?.token_metadata?.token_info?.price || 'N/A';
  const priceChange = data?.result?.token_metadata?.price_change?.calendar?.['24h'] || 'N/A';

  // Group indicators by category
  const categories = Array.from(new Set(indicators.map(i => i.category)));
  
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900">
      <div className="text-center">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-500 mx-auto mb-4"></div>
        <p className="text-gray-300">Loading HYPE Market Intelligence...</p>
      </div>
    </div>
  );

  if (error) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900">
      <div className="bg-red-900/20 border border-red-500/50 rounded-xl p-8 max-w-md">
        <h2 className="text-red-400 text-xl font-bold mb-2">⚠️ API Error</h2>
        <p className="text-red-300">{error}</p>
        <button onClick={fetchData} className="mt-4 px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-white">
          Retry
        </button>
      </div>
    </div>
  );

  return (
    <main className="min-h-screen bg-gray-900 text-white p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center font-bold text-lg">
                H
              </div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                HYPE Monitor
              </h1>
            </div>
            <div className="flex items-center gap-4 text-gray-400">
              <span className="text-2xl font-bold text-white">${typeof price === 'number' ? price.toFixed(2) : price}</span>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                typeof priceChange === 'string' && priceChange.includes('+') 
                  ? 'bg-green-500/20 text-green-400' 
                  : 'bg-red-500/20 text-red-400'
              }`}>
                {priceChange}
              </span>
            </div>
          </div>
          <div className="flex gap-2">
            {TIMEFRAMES.map(tf => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  timeframe === tf
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700 border border-gray-700'
                }`}
              >
                {tf}
              </button>
            ))}
          </div>
        </div>

        {/* Decision Banner */}
        <div className={`mb-8 p-6 rounded-xl border ${decisionColor} text-center`}>
          <h2 className="text-2xl font-bold mb-2">Decision: {decision}</h2>
          <p className="text-sm opacity-80">
            Based on {totalSignals} indicators: 
            <span className="text-green-400 font-medium"> {buyCount} Buy</span> | 
            <span className="text-red-400 font-medium"> {sellCount} Sell</span> | 
            <span className="text-yellow-400 font-medium"> {neutralCount} Neutral</span>
          </p>
        </div>

        {/* Category Sections */}
        {categories.map(category => (
          <div key={category} className="mb-8">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <span className="w-1 h-6 bg-blue-500 rounded-full"></span>
              {category} Indicators
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {indicators.filter(i => i.category === category).map(ind => (
                <div key={ind.name} className="bg-gray-800 rounded-xl p-5 border border-gray-700 hover:border-gray-600 transition-colors">
                  <div className="flex justify-between items-start mb-3">
                    <h3 className="font-medium text-gray-300">{ind.name}</h3>
                    <span className={`text-xs px-3 py-1 rounded-full border ${
                      ind.action.includes('buy') ? 'text-green-600 bg-green-50 border-green-200' :
                      ind.action.includes('sell') ? 'text-red-600 bg-red-50 border-red-200' :
                      'text-yellow-600 bg-yellow-50 border-yellow-200'
                    }`}>
                      {ind.action}
                    </span>
                  </div>
                  <p className="text-3xl font-bold mb-1">
                    {typeof ind.value === 'number' ? ind.value.toFixed(2) : ind.value}
                  </p>
                  {ind.details && (
                    <p className="text-sm text-gray-500">{ind.details}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Support & Resistance */}
        {data?.result?.support_resistance?.['support and resistance channel'] && (
          <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 mb-8">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <span className="w-1 h-6 bg-purple-500 rounded-full"></span>
              Support & Resistance Levels
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {data.result.support_resistance['support and resistance channel'].map((level: any, i: number) => (
                <div key={i} className="bg-gray-900/50 p-3 rounded-lg border border-gray-700">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-gray-500">Strength</span>
                    <div className="w-12 bg-gray-700 rounded-full h-1.5">
                      <div 
                        className="bg-blue-500 h-1.5 rounded-full" 
                        style={{ width: `${level.strength}%` }}
                      ></div>
                    </div>
                  </div>
                  <p className="text-sm font-semibold">${level.lo} - ${level.hi}</p>
                  <p className="text-xs text-gray-500 mt-1">{level.strength}% strength</p>
                </div>
              ))}
            </div>
          </div>
        )}

        <footer className="mt-8 text-center text-sm text-gray-600">
          Data powered by <a href="https://app.true-north.xyz/" className="text-blue-400 hover:text-blue-300">TrueNorth</a> • Auto-refreshes every 5 min • Built with Next.js
        </footer>
      </div>
    </main>
  );
}
