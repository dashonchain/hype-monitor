'use client';

import { useEffect, useState } from 'react';

type Indicator = { name: string; value: number; action: string; detail: string };
type Category = { title: string; items: Indicator[]; color: string };
type Decision = { action: string; buy_signals: number; sell_signals: number; neutral_signals: number; buy_ratio: number; sell_ratio: number; summary: string };
type SRChannel = { hi: number; lo: number; strength: number };
type Event = { date: string; event: string; impact: string };

type Data = {
  price: number;
  price_change: { '24h': string; '7d': string; '30d': string };
  market_cap: number;
  market_cap_rank: number;
  total_volume: number;
  indicators: { trend: Indicator[]; momentum: Indicator[]; volatility: Indicator[]; volume: Indicator[] };
  support_resistance: { channels: SRChannel[]; current_price: number; in_channel: boolean };
  overall_decision: Decision;
  events: Event[];
  last_updated: string;
  source: string;
};

const actionColor: Record<string, string> = { buy: 'text-green-400', sell: 'text-red-400', neutral: 'text-yellow-400', strong_buy: 'text-emerald-400', strong_sell: 'text-rose-400' };
const actionBg: Record<string, string> = { buy: 'bg-green-900/30 border-green-700', sell: 'bg-red-900/30 border-red-700', neutral: 'bg-yellow-900/30 border-yellow-700' };
const impactColor: Record<string, string> = { low: 'border-blue-500', medium: 'border-yellow-500', high: 'border-red-500' };

function formatNumber(num: number): string {
  if (num >= 1e9) return `$${(num / 1e9).toFixed(2)}B`;
  if (num >= 1e6) return `$${(num / 1e6).toFixed(2)}M`;
  return `$${num.toFixed(2)}`;
}

export default function Home() {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async () => {
    try {
      setRefreshing(true);
      const res = await fetch('/api/hype');
      const d = await res.json();
      if (d.error) throw new Error(d.error);
      setData(d);
      setError('');
    } catch (e: any) {
      setError(e.message || 'Erreur inconnue');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
    // Auto-refresh toutes les 5 minutes
    const interval = setInterval(fetchData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  if (loading) return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col items-center justify-center gap-4">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-400"></div>
      <div>Chargement du dashboard HYPE...</div>
    </div>
  );

  if (error || !data) return (
    <div className="min-h-screen bg-gray-950 text-red-400 flex flex-col items-center justify-center gap-4 p-4">
      <div className="text-xl">Erreur: {error || 'Données indisponibles'}</div>
      <button 
        onClick={fetchData}
        className="px-4 py-2 bg-red-900/50 border border-red-700 rounded-lg hover:bg-red-800/50 transition"
      >
        Réessayer
      </button>
    </div>
  );

  const categories: Category[] = [
    { title: '📈 Tendance', items: data.indicators.trend, color: 'from-blue-900 to-blue-800' },
    { title: '⚡ Momentum', items: data.indicators.momentum, color: 'from-purple-900 to-purple-800' },
    { title: '📉 Volatilité', items: data.indicators.volatility, color: 'from-orange-900 to-orange-800' },
    { title: '📊 Volume', items: data.indicators.volume, color: 'from-teal-900 to-teal-800' },
  ];

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-4 md:p-8">
      <header className="max-w-7xl mx-auto mb-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
              HYPE Monitor
            </h1>
            <p className="text-gray-400 text-sm mt-1">Hyperliquid Token • Powered by TrueNorth AI</p>
          </div>
          <div className="mt-4 md:mt-0 text-right">
            <div className="text-3xl font-mono font-bold">${data.price.toFixed(3)}</div>
            <div className="flex gap-3 text-sm mt-1">
              {(['24h', '7d', '30d'] as const).map(period => (
                <span key={period} className={data.price_change[period].startsWith('-') ? 'text-red-400' : 'text-green-400'}>
                  {period}: {data.price_change[period]}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Market Info */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {[ 
            { label: 'Market Cap', value: formatNumber(data.market_cap) },
            { label: 'Rang', value: `#${data.market_cap_rank}` },
            { label: 'Volume 24h', value: formatNumber(data.total_volume) },
            { label: 'Dernière MAJ', value: new Date(data.last_updated).toLocaleTimeString('fr-FR') }
          ].map(card => (
            <div key={card.label} className="bg-gray-900/50 border border-gray-800 rounded-lg p-3">
              <div className="text-xs text-gray-500 uppercase">{card.label}</div>
              <div className="text-lg font-semibold mt-1">{card.value}</div>
            </div>
          ))}
        </div>

        {/* Decision Banner */}
        <div className={`border rounded-xl p-5 mb-8 ${actionBg[data.overall_decision.action.toLowerCase()]}`}>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center">
            <div>
              <div className="text-sm text-gray-400 mb-1">DÉCISION TRUENORTH</div>
              <div className={`text-4xl font-bold ${actionColor[data.overall_decision.action.toLowerCase()]}`}>
                {data.overall_decision.action === 'Buy' ? '🟢 ACHAT' : data.overall_decision.action === 'Sell' ? '🔴 VENTE' : '🟡 NEUTRE'}
              </div>
              <p className="text-gray-300 mt-2 max-w-2xl">{data.overall_decision.summary}</p>
            </div>
            <div className="mt-4 md:mt-0 grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-green-400 text-xl font-bold">{data.overall_decision.buy_signals}</div>
                <div className="text-xs text-gray-400">Achat</div>
              </div>
              <div>
                <div className="text-yellow-400 text-xl font-bold">{data.overall_decision.neutral_signals}</div>
                <div className="text-xs text-gray-400">Neutre</div>
              </div>
              <div>
                <div className="text-red-400 text-xl font-bold">{data.overall_decision.sell_signals}</div>
                <div className="text-xs text-gray-400">Vente</div>
              </div>
            </div>
          </div>
        </div>

        {/* Refresh Button */}
        <div className="flex justify-end mb-6">
          <button
            onClick={fetchData}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg hover:bg-gray-700 transition disabled:opacity-50"
          >
            {refreshing ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-cyan-400"></div>
                Actualisation...
              </>
            ) : (
              <>
                🔄 Actualiser
              </>
            )}
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Indicators */}
        <section className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
          {categories.map(cat => (
            <div key={cat.title} className={`bg-gradient-to-br ${cat.color} rounded-xl border border-gray-800 overflow-hidden`}>
              <div className="p-4 border-b border-gray-800">
                <h2 className="font-bold text-lg">{cat.title}</h2>
              </div>
              <div className="divide-y divide-gray-800/50">
                {cat.items.map(ind => (
                  <div key={ind.name} className="p-4 flex justify-between items-center hover:bg-white/5 transition">
                    <div>
                      <div className="font-mono font-semibold">{ind.name}</div>
                      <div className="text-xs text-gray-400 mt-0.5">{ind.detail}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono font-bold">{typeof ind.value === 'number' ? ind.value.toFixed(2) : ind.value}</div>
                      <div className={`text-xs font-semibold ${actionColor[ind.action]}`}>{ind.action.toUpperCase()}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </section>

        {/* Sidebar: Support/Résistance + Events */}
        <aside className="space-y-6">
          {/* Support / Résistance */}
          <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-5">
            <h3 className="font-bold text-lg mb-4">🎯 Support & Résistance</h3>
            <div className="space-y-3">
              {data.support_resistance.channels.slice(0, 4).map((ch, i) => {
                const isSupport = ch.hi < data.price;
                return (
                  <div key={i} className={`p-3 rounded-lg border ${isSupport ? 'border-green-800 bg-green-900/20' : 'border-red-800 bg-red-900/20'}`}>
                    <div className="flex justify-between text-sm">
                      <span className={isSupport ? 'text-green-400' : 'text-red-400'}>{isSupport ? 'Support' : 'Résistance'}</span>
                      <span className="text-gray-400">Force: {ch.strength}%</span>
                    </div>
                    <div className="font-mono mt-1">{ch.lo.toFixed(3)} — {ch.hi.toFixed(3)}</div>
                    <div className="w-full bg-gray-800 h-1.5 rounded-full mt-2">
                      <div className={`h-full rounded-full ${isSupport ? 'bg-green-500' : 'bg-red-500'}`} style={{ width: `${ch.strength}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Events */}
          <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-5">
            <h3 className="font-bold text-lg mb-4">📅 Événements Clés</h3>
            <div className="space-y-3">
              {data.events.map((ev, i) => (
                <div key={i} className={`p-3 rounded-lg border-l-4 ${impactColor[ev.impact] || 'border-gray-600'} bg-gray-800/30`}>
                  <div className="text-xs text-gray-400">{ev.date}</div>
                  <div className="text-sm mt-1">{ev.event}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Source */}
          <div className="text-center text-xs text-gray-600">
            Source: {data.source} • {data.last_updated}
          </div>
        </aside>
      </main>
    </div>
  );
}