     1|     1|'use client';
     2|     2|
     3|     3|import { useEffect, useState, useCallback } from 'react';
     4|     4|import PriceChart from '../components/PriceChart';
     5|     5|
     6|     6|type Indicator = { name: string; value: number; action: string; detail: string };
     7|     7|type Category = { title: string; items: Indicator[]; color: string };
     8|     8|type Decision = { action: string; buy_signals: number; sell_signals: number; neutral_signals: number; buy_ratio: number; sell_ratio: number; summary: string; action_display?: string; score_percent?: number };
     9|     9|type SRChannel = { hi: number; lo: number; strength: number };
    10|    10|type Event = { date: string; event: string; impact: string };
    11|    11|type HistoryPoint = { timestamp: number; price: number };
    12|    12|type RealtimeData = { price: number; price_change_24h: string; volume_24h: number; high_24h: number; low_24h: number; market_cap?: number };
    13|    13|type Derivatives = {
    14|    14|  open_interest: { current_oi: number; oi_change_1d: number; oi_change_4h: number; oi_percentile_7d: number; oi_mcap_ratio: number };
    15|    15|  funding_rate: { current_rate_pct: number; annualized_cost_pct: number; funding_percentile_7d: number; change_1d_pct: number };
    16|    16|  liquidations: { short_liq_points: Array<{price: number, liq_usd: number, distance_pct: number}>; long_liq_points: Array<{price: number, liq_usd: number, distance_pct: number}>; imbalance_ratio: number; interpretation: string };
    17|    17|};
    18|    18|
    19|    19|type Data = {
    20|    20|  price: number;
    21|    21|  price_change: { '24h': string; '7d': string; '30d': string };
    22|    22|  market_cap: number;
    23|    23|  market_cap_rank: number;
    24|    24|  total_volume: number;
    25|    25|  indicators: { trend: Indicator[]; momentum: Indicator[]; volatility: Indicator[]; volume: Indicator[] };
    26|    26|  support_resistance: { channels: SRChannel[]; current_price: number; in_channel: boolean };
    27|    27|  overall_decision: Decision;
    28|    28|  signal_score?: number;
    29|    29|  signal_emoji?: string;
    30|    30|  events: Event[];
    31|    31|  derivatives?: Derivatives;
    32|    32|  ema20History?: [number, number][];
    33|    33|  ema50History?: [number, number][];
    34|    34|  ema200History?: [number, number][];
    35|    35|  history?: { prices: [number, number][]; volumes: [number, number][] };
    36|    36|  timeframe?: string;
    37|    37|  last_updated: string;
    38|    38|  source: string;
    39|    39|  fetch_duration_ms?: number;
    40|    40|  errors?: string[];
    41|    41|};
    42|    42|
    43|    43|const actionColor: Record<string, string> = { buy: 'text-green-400', sell: 'text-red-400', neutral: 'text-yellow-400', strong_buy: 'text-emerald-400', strong_sell: 'text-rose-400' };
    44|    44|const actionBg: Record<string, string> = { buy: 'bg-green-900/30 border-green-700', sell: 'bg-red-900/30 border-red-700', neutral: 'bg-yellow-900/30 border-yellow-700' };
    45|    45|const impactColor: Record<string, string> = { low: 'border-blue-500', medium: 'border-yellow-500', high: 'border-red-500' };
    46|    46|const timeframes = ['1h', '4h', '1d', '1w'];
    47|    47|
    48|    48|function formatNumber(num: number): string {
    49|    49|  if (num >= 1e9) return `$${(num / 1e9).toFixed(2)}B`;
    50|    50|  if (num >= 1e6) return `$${(num / 1e6).toFixed(2)}M`;
    51|    51|  if (num >= 1e3) return `$${(num / 1e3).toFixed(1)}K`;
    52|    52|  return `$${num.toFixed(2)}`;
    53|    53|}
    54|    54|
    55|    55|function getTimeAgo(lastUpdated: string): { text: string; seconds: number; isStale: boolean } {
    56|    56|  const now = Date.now();
    57|    57|  const updated = new Date(lastUpdated).getTime();
    58|    58|  const diffSeconds = Math.floor((now - updated) / 1000);
    59|    59|  
    60|    60|  if (diffSeconds < 60) return { text: `${diffSeconds}s`, seconds: diffSeconds, isStale: false };
    61|    61|  if (diffSeconds < 3600) return { text: `${Math.floor(diffSeconds / 60)}min`, seconds: diffSeconds, isStale: diffSeconds > 180 };
    62|    62|  return { text: `${Math.floor(diffSeconds / 3600)}h`, seconds: diffSeconds, isStale: true };
    63|    63|}
    64|    64|
    65|    65|export default function Home() {
    66|    66|  const [data, setData] = useState<Data | null>(null);
    67|    67|  const [loading, setLoading] = useState(true);
    68|    68|  const [error, setError] = useState('');
    69|    69|  const [refreshing, setRefreshing] = useState(false);
    70|    70|  const [timeframe, setTimeframe] = useState('1d');
    71|    71|  const [lastFetchTime, setLastFetchTime] = useState(Date.now());
    72|    72|  const [fetchCount, setFetchCount] = useState(0);
    73|    73|
    74|    74|  const fetchData = useCallback(async (tf?: string) => {
    75|    75|    try {
    76|    76|      setRefreshing(true);
    77|    77|      const params = new URLSearchParams({ timeframe: tf || timeframe });
    78|    78|      const res = await fetch(`https://inform-water-audio-alberta.trycloudflare.com/api/live-data?${params}`, {
    79|    79|        signal: AbortSignal.timeout(10000)
    80|    80|      });
    81|    81|      
    82|    82|      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    83|    83|      
    84|    84|      const d = await res.json();
    85|    85|      if (d.error) throw new Error(d.error);
    86|    86|      
    87|    87|      setData(d);
    88|    88|      setLastFetchTime(Date.now());
    89|    89|      setFetchCount(prev => prev + 1);
    90|    90|      setError('');
    91|    91|    } catch (e: any) {
    92|    92|      const errMsg = e.name === 'AbortError' ? 'Timeout: TrueNorth CLI ne répond pas' : e.message || 'Erreur inconnue';
    93|    93|      setError(errMsg);
    94|    94|      console.error('Fetch error:', e);
    95|    95|    } finally {
    96|    96|      setLoading(false);
    97|    97|      setRefreshing(false);
    98|    98|    }
    99|    99|  }, [timeframe]);
   100|   100|
   101|   101|  useEffect(() => {
   102|   102|    fetchData();
   103|   103|    // Polling toutes les 60 secondes
   104|   104|    const interval = setInterval(() => fetchData(), 60000);
   105|   105|    return () => clearInterval(interval);
   106|   106|    // eslint-disable-next-line react-hooks/exhaustive-deps
   107|   107|  }, [timeframe, fetchData]);
   108|   108|
   109|   109|  const changeTimeframe = (tf: string) => {
   110|   110|    setTimeframe(tf);
   111|   111|    fetchData(tf);
   112|   112|  };
   113|   113|
   114|   114|  // Calcul de la fraîcheur
   115|   115|  const freshness = data?.last_updated ? getTimeAgo(data.last_updated) : null;
   116|   116|  const isDataStale = freshness?.isStale || false;
   117|   117|
   118|   118|  if (loading) return (
   119|   119|    <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col items-center justify-center gap-4">
   120|   120|      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-400"></div>
   121|   121|      <div>Loading HYPE Dashboard...</div>
   122|   122|    </div>
   123|   123|  );
   124|   124|
   125|   125|  if (error && !data) return (
   126|   126|    <div className="min-h-screen bg-gray-950 text-red-400 flex flex-col items-center justify-center gap-4 p-4">
   127|   127|      <div className="text-xl">⚠️ TrueNorth Connection Error</div>
   128|   128|      <div className="text-sm text-gray-400">{error}</div>
   129|   129|      <button onClick={() => fetchData()} className="px-4 py-2 bg-red-900/50 border border-red-700 rounded-lg hover:bg-red-800/50 transition">
   130|   130|        Retry
   131|   131|      </button>
   132|   132|    </div>
   133|   133|  );
   134|   134|
   135|   135|  if (!data) return null; // Sécurité TypeScript
   136|   136|
   137|   137|  const categories: Category[] = [
   138|   138|    { title: '📈 Trend', items: data?.indicators.trend || [], color: 'from-blue-900 to-blue-800' },
   139|   139|    { title: '⚡ Momentum', items: data?.indicators.momentum || [], color: 'from-purple-900 to-purple-800' },
   140|   140|    { title: '📉 Volatility', items: data?.indicators.volatility || [], color: 'from-orange-900 to-orange-800' },
   141|   141|    { title: '📊 Volume', items: data?.indicators.volume || [], color: 'from-teal-900 to-teal-800' },
   142|   142|  ];
   143|   143|
   144|   144|  return (
   145|   145|    <div className="min-h-screen bg-gray-950 text-gray-100 p-4 md:p-8">
   146|   146|      <header className="max-w-7xl mx-auto mb-8">
   147|   147|        {/* Indicateur de fraîcheur */}
   148|   148|        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4">
   149|   149|          <div>
   150|   150|            <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
   151|   151|              HYPE Monitor
   152|   152|            </h1>
   153|   153|            <p className="text-gray-400 text-sm mt-1">
   154|   154|              Hyperliquid Token • Powered by TrueNorth CLI
   155|   155|              {freshness && (
   156|   156|                <span className={`ml-2 px-2 py-1 rounded text-xs ${isDataStale ? 'bg-red-900/50 text-red-400' : 'bg-green-900/50 text-green-400'}`}>
   157|   157|                  {isDataStale ? '⚠️ Stale Data' : `🟢 Updated ${freshness.text}`}
   158|   158|                </span>
   159|   159|              )}
   160|   160|            </p>
   161|   161|          </div>
   162|   162|          <div className="mt-4 md:mt-0 text-right">
   163|   163|            <div className="text-2xl md:text-3xl font-mono font-semibold">${data?.price?.toFixed(3) || 'N/A'}</div>
   164|   164|            <div className="flex gap-3 text-sm mt-1">
   165|   165|              {data?.price_change && (['24h', '7d', '30d'] as const).map(period => (
   166|   166|                <span key={period} className={(data.price_change[period] || '').startsWith('-') ? 'text-red-400' : 'text-green-400'}>
   167|   167|                  {period}: {data.price_change[period] || 'N/A'}
   168|   168|                </span>
   169|   169|              ))}
   170|   170|            </div>
   171|   171|            {data?.derivatives && (
   172|   172|              <div className="text-xs text-gray-500 mt-1">
   173|   173|                OI: {formatNumber(data.derivatives.open_interest.current_oi)} • Funding: {(data.derivatives.funding_rate.current_rate_pct * 100).toFixed(3)}%
   174|   174|              </div>
   175|   175|            )}
   176|   176|          </div>
   177|   177|        </div>
   178|   178|
   179|   179|        {/* Timeframe Selector */}
   180|   180|        <div className="flex gap-2 mb-6">
   181|   181|          {timeframes.map(tf => (
   182|   182|            <button
   183|   183|              key={tf}
   184|   184|              onClick={() => changeTimeframe(tf)}
   185|   185|              className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${
   186|   186|                timeframe === tf
   187|   187|                  ? 'bg-cyan-600 text-white'
   188|   188|                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
   189|   189|              }`}
   190|   190|            >
   191|   191|              {tf}
   192|   192|            </button>
   193|   193|          ))}
   194|   194|        </div>
   195|   195|
   196|   196|        {/* Market Info */}
   197|   197|        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
   198|   198|          {[ 
   199|   199|            { label: 'Market Cap', value: formatNumber(data.market_cap) },
   200|   200|            { label: 'Rank', value: `#${data.market_cap_rank}` },
   201|   201|            { label: '24h Volume', value: formatNumber(data.derivatives?.open_interest.current_oi || data.total_volume) },
   202|   202|            { label: 'Last Update', value: freshness?.text || 'N/A' }
   203|   203|          ].map(card => (
   204|   204|            <div key={card.label} className="bg-gray-900/50 border border-gray-800 rounded-lg p-3">
   205|   205|              <div className="text-xs text-gray-500 uppercase">{card.label}</div>
   206|   206|              <div className="text-lg font-semibold mt-1">{card.value}</div>
   207|   207|            </div>
   208|   208|          ))}
   209|   209|        </div>
   210|   210|
   211|   211|        {/* Decision Banner */}
   212|   212|        <div className={`border rounded-xl p-5 mb-8 ${isDataStale ? 'opacity-50 grayscale' : ''} ${actionBg[data?.overall_decision?.action?.toLowerCase() || 'neutral']}`}>
   213|   213|          <div className="flex flex-col md:flex-row justify-between items-start md:items-center">
   214|   214|            <div className="flex-1">
   215|   215|              <div className="text-sm text-gray-400 mb-1">
   216|   216|                TRUENORTH DECISION ({data?.timeframe || '1d'})
   217|   217|                {data?.last_updated && (
   218|   218|                  <span className="ml-2 text-xs">({new Date(data.last_updated).toLocaleTimeString('fr-FR')})</span>
   219|   219|                )}
   220|   220|              </div>
   221|   221|              <div className={`text-4xl font-bold ${actionColor[data?.overall_decision?.action?.toLowerCase() || 'neutral']}`}>
   222|   222|                {data?.overall_decision?.action_display || (
   223|   223|                  data?.overall_decision?.action === 'Buy' ? '🟢 BUY' : 
   224|   224|                  data?.overall_decision?.action === 'Sell' ? '🔴 SELL' : '🟡 NEUTRAL'
   225|   225|                )}
   226|   226|              </div>
   227|   227|              
   228|   228|              {/* Signal Score Bar */}
   229|   229|              {data?.signal_score !== undefined && (
   230|   230|                <div className="mt-3 max-w-md">
   231|   231|                  <div className="flex justify-between text-xs text-gray-400 mb-1">
   232|   232|                    <span>Signal Score</span>
   233|   233|                    <span className="font-mono font-bold">{data.signal_score}%</span>
   234|   234|                  </div>
   235|   235|                  <div className="w-full bg-gray-800 rounded-full h-3">
   236|   236|                    <div 
   237|   237|                      className={`h-full rounded-full transition-all duration-500 ${
   238|   238|                        data.signal_score > 75 ? 'bg-green-500' :
   239|   239|                        data.signal_score > 60 ? 'bg-green-400' :
   240|   240|                        data.signal_score > 40 ? 'bg-yellow-400' :
   241|   241|                        data.signal_score > 25 ? 'bg-red-400' : 'bg-red-500'
   242|   242|                      }`}
   243|   243|                      style={{ width: `${data.signal_score}%` }}
   244|   244|                    />
   245|   245|                  </div>
   246|   246|                  <div className="flex justify-between text-xs text-gray-500 mt-1">
   247|   247|                    <span>🔴 Short</span>
   248|   248|                    <span>🟡 Neutral</span>
   249|   249|                    <span>🟢 Long</span>
   250|   250|                  </div>
   251|   251|                </div>
   252|   252|              )}
   253|   253|              
   254|   254|              <p className="text-gray-300 mt-2 max-w-2xl">{data?.overall_decision?.summary}</p>
   255|   255|              {isDataStale && (
   256|   256|                <div className="mt-2 text-red-400 text-sm">⚠️ Decision based on stale data (over 3 min)</div>
   257|   257|              )}
   258|   258|            </div>
   259|   259|            <div className="mt-4 md:mt-0 grid grid-cols-3 gap-4 text-center">
   260|   260|              <div>
   261|   261|                <div className="text-green-400 text-xl font-bold">{data?.overall_decision?.buy_signals || 0}</div>
   262|   262|                <div className="text-xs text-gray-400">Achat</div>
   263|   263|              </div>
   264|   264|              <div>
   265|   265|                <div className="text-yellow-400 text-xl font-bold">{data?.overall_decision?.neutral_signals || 0}</div>
   266|   266|                <div className="text-xs text-gray-400">Neutral</div>
   267|   267|              </div>
   268|   268|              <div>
   269|   269|                <div className="text-red-400 text-xl font-bold">{data?.overall_decision?.sell_signals || 0}</div>
   270|   270|                <div className="text-xs text-gray-400">Vente</div>
   271|   271|              </div>
   272|   272|            </div>
   273|   273|          </div>
   274|   274|        </div>
   275|   275|
   276|   276|        {/* Refresh Button */}
   277|   277|        <div className="flex justify-end mb-6">
   278|   278|          <button
   279|   279|            onClick={() => fetchData()}
   280|   280|            disabled={refreshing}
   281|   281|            className="flex items-center gap-2 px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg hover:bg-gray-700 transition disabled:opacity-50"
   282|   282|          >
   283|   283|            {refreshing ? (
   284|   284|              <>
   285|   285|                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-cyan-400"></div>
   286|   286|                Actualisation...
   287|   287|              </>
   288|   288|            ) : (
   289|   289|              <>🔄 Refresh</>
   290|   290|            )}
   291|   291|          </button>
   292|   292|        </div>
   293|   293|
   294|   294|        {/* Error display */}
   295|   295|        {error && data && (
   296|   296|          <div className="bg-yellow-900/20 border border-yellow-700 rounded-lg p-3 mb-6 text-sm text-yellow-400">
   297|   297|            ⚠️ Network error: {error} — Displaying last known data
   298|   298|          </div>
   299|   299|        )}
   300|   300|      </header>
   301|   301|
   302|   302|      <main className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
   303|   303|        {/* Indicators */}
   304|   304|        <section className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
   305|   305|          {categories.map(cat => (
   306|   306|            <div key={cat.title} className={`bg-gradient-to-br ${cat.color} rounded-xl border border-gray-800 overflow-hidden`}>
   307|   307|              <div className="p-4 border-b border-gray-800">
   308|   308|                <h2 className="font-bold text-lg">{cat.title}</h2>
   309|   309|              </div>
   310|   310|              <div className="divide-y divide-gray-800/50">
   311|   311|                {cat.items.map(ind => (
   312|   312|                  <div key={ind.name} className="p-4 flex justify-between items-center hover:bg-white/5 transition">
   313|   313|                    <div>
   314|   314|                      <div className="font-mono font-semibold">{ind.name}</div>
   315|   315|                      <div className="text-xs text-gray-400 mt-0.5">{ind.detail}</div>
   316|   316|                    </div>
   317|   317|                    <div className="text-right">
   318|   318|                      <div className="font-mono font-bold">{typeof ind.value === 'number' ? ind.value.toFixed(2) : ind.value}</div>
   319|   319|                      <div className={`text-xs font-semibold ${actionColor[ind.action]}`}>{ind.action.toUpperCase()}</div>
   320|   320|                    </div>
   321|   321|                  </div>
   322|   322|                ))}
   323|   323|              </div>
   324|   324|            </div>
   325|   325|          ))}
   326|   326|
   327|   327|          {/* Derivatives Section */}
   328|   328|          {data?.derivatives && (
   329|   329|            <div className="md:col-span-2 bg-gradient-to-br from-indigo-900 to-indigo-800 rounded-xl border border-gray-800 overflow-hidden">
   330|   330|              <div className="p-4 border-b border-gray-800">
   331|   331|                <h2 className="font-bold text-lg">📑 Derivatives & Liquidations</h2>
   332|   332|              </div>
   333|   333|              <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
   334|   334|                {/* Open Interest */}
   335|   335|                <div className="bg-gray-900/30 p-3 rounded-lg">
   336|   336|                  <div className="text-sm text-gray-400">Open Interest</div>
   337|   337|                  <div className="text-xl font-bold mt-1">{formatNumber(data.derivatives.open_interest.current_oi)}</div>
   338|   338|                  <div className="text-xs mt-1">
   339|   339|                    <span className={data.derivatives.open_interest.oi_change_1d >= 0 ? 'text-green-400' : 'text-red-400'}>
   340|   340|                      1d: {data.derivatives.open_interest.oi_change_1d >= 0 ? '+' : ''}{(data.derivatives.open_interest.oi_change_1d / 1e6).toFixed(1)}M
   341|   341|                    </span>
   342|   342|                    <span className="text-gray-500 ml-2">({data.derivatives.open_interest.oi_percentile_7d}th pct)</span>
   343|   343|                  </div>
   344|   344|                </div>
   345|   345|
   346|   346|                {/* Funding Rate */}
   347|   347|                <div className="bg-gray-900/30 p-3 rounded-lg">
   348|   348|                  <div className="text-sm text-gray-400">Funding Rate (1h)</div>
   349|   349|                  <div className="text-xl font-bold mt-1">{(data.derivatives.funding_rate.current_rate_pct * 100).toFixed(3)}%</div>
   350|   350|                  <div className="text-xs mt-1">
   351|   351|                    <span className="text-gray-400">Annualized cost: {data.derivatives.funding_rate.annualized_cost_pct.toFixed(2)}%</span>
   352|   352|                  </div>
   353|   353|                </div>
   354|   354|
   355|   355|                {/* Liquidation Imbalance */}
   356|   356|                <div className="bg-gray-900/30 p-3 rounded-lg">
   357|   357|                  <div className="text-sm text-gray-400">Liquidation Imbalance</div>
   358|   358|                  <div className="text-xl font-bold mt-1">
   359|   359|                    {data.derivatives.liquidations.imbalance_ratio > 0 ? '🟢 Longs' : '🔴 Shorts'} favorisés
   360|   360|                  </div>
   361|   361|                  <div className="text-xs mt-1">
   362|   362|                    <span className="text-gray-400">Ratio: {data.derivatives.liquidations.imbalance_ratio.toFixed(3)}</span>
   363|   363|                  </div>
   364|   364|                </div>
   365|   365|
   366|   366|                {/* Short Liquidation Points */}
   367|   367|                <div className="md:col-span-3 bg-gray-900/20 p-3 rounded-lg">
   368|   368|                  <div className="text-sm text-red-400 mb-2">Short Liquidation Levels (TOP 3)</div>
   369|   369|                  <div className="grid grid-cols-3 gap-2">
   370|   370|                    {data.derivatives.liquidations.short_liq_points?.map((pt, i) => (
   371|   371|                      <div key={i} className="bg-red-900/20 p-2 rounded border border-red-800">
   372|   372|                        <div className="font-mono">${pt.price.toFixed(2)}</div>
   373|   373|                        <div className="text-xs text-gray-400">{(pt.liq_usd / 1e6).toFixed(1)}M USD</div>
   374|   374|                        <div className="text-xs text-red-400">{pt.distance_pct.toFixed(1)}% du prix</div>
   375|   375|                      </div>
   376|   376|                    ))}
   377|   377|                  </div>
   378|   378|                </div>
   379|   379|
   380|   380|                {/* Long Liquidation Points */}
   381|   381|                <div className="md:col-span-3 bg-gray-900/20 p-3 rounded-lg">
   382|   382|                  <div className="text-sm text-green-400 mb-2">Long Liquidation Levels (TOP 3)</div>
   383|   383|                  <div className="grid grid-cols-3 gap-2">
   384|   384|                    {data.derivatives.liquidations.long_liq_points?.map((pt, i) => (
   385|   385|                      <div key={i} className="bg-green-900/20 p-2 rounded border border-green-800">
   386|   386|                        <div className="font-mono">${pt.price.toFixed(2)}</div>
   387|   387|                        <div className="text-xs text-gray-400">{(pt.liq_usd / 1e6).toFixed(1)}M USD</div>
   388|   388|                        <div className="text-xs text-green-400">{pt.distance_pct.toFixed(1)}% du prix</div>
   389|   389|                      </div>
   390|   390|                    ))}
   391|   391|                  </div>
   392|   392|                </div>
   393|   393|              </div>
   394|   394|            </div>
   395|   395|          )}
   396|   396|
   397|   397|          {/* Graphique des Prix & EMA */}
   398|   398|          {data?.history?.prices && data?.ema20History && (
   399|   399|            <PriceChart 
   400|   400|              prices={data.history.prices}
   401|   401|              ema20History={data.ema20History}
   402|   402|              ema50History={data.ema50History || []}
   403|   403|              ema200History={data.ema200History || []}
   404|   404|            />
   405|   405|          )}
   406|   406|
   407|   407|        </section>
   408|   408|
   409|   409|        {/* Sidebar: Support/Résistance + Events */}
   410|   410|        <aside className="space-y-6">
   411|   411|          {/* Support / Résistance */}
   412|   412|          <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-5">
   413|   413|            <h3 className="font-bold text-lg mb-4">🎯 Support & Resistance</h3>
   414|   414|            <div className="space-y-3">
   415|   415|              {data?.support_resistance?.channels?.slice(0, 4).map((ch, i) => {
   416|   416|                const isSupport = ch.hi < (data?.price || 0);
   417|   417|                return (
   418|   418|                  <div key={i} className={`p-3 rounded-lg border ${isSupport ? 'border-green-800 bg-green-900/20' : 'border-red-800 bg-red-900/20'}`}>
   419|   419|                    <div className="flex justify-between text-sm">
   420|   420|                      <span className={isSupport ? 'text-green-400' : 'text-red-400'}>{isSupport ? 'Support' : 'Résistance'}</span>
   421|   421|                      <span className="text-gray-400">Force: {ch.strength}%</span>
   422|   422|                    </div>
   423|   423|                    <div className="font-mono mt-1">{ch.lo.toFixed(3)} — {ch.hi.toFixed(3)}</div>
   424|   424|                    <div className="w-full bg-gray-800 h-1.5 rounded-full mt-2">
   425|   425|                      <div className={`h-full rounded-full ${isSupport ? 'bg-green-500' : 'bg-red-500'}`} style={{ width: `${ch.strength}%` }} />
   426|   426|                    </div>
   427|   427|                  </div>
   428|   428|                );
   429|   429|              })}
   430|   430|            </div>
   431|   431|          </div>
   432|   432|
   433|   433|          {/* Events */}
   434|   434|          {data?.events && data.events.length > 0 && (
   435|   435|            <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-5">
   436|   436|              <h3 className="font-bold text-lg mb-4">📅 Key Events</h3>
   437|   437|              <div className="space-y-3">
   438|   438|                {data.events.map((ev, i) => (
   439|   439|                  <div key={i} className={`p-3 rounded-lg border-l-4 ${impactColor[ev.impact] || 'border-gray-600'} bg-gray-800/30`}>
   440|   440|                    <div className="text-xs text-gray-400">{ev.date}</div>
   441|   441|                    <div className="text-sm mt-1">{ev.event}</div>
   442|   442|                  </div>
   443|   443|                ))}
   444|   444|              </div>
   445|   445|            </div>
   446|   446|          )}
   447|   447|
   448|   448|          {/* Source & Stats */}
   449|   449|          <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-5">
   450|   450|            <div className="text-xs text-gray-500 mb-2">Source: {data?.source}</div>
   451|   451|            {data?.fetch_duration_ms && (
   452|   452|              <div className="text-xs text-gray-500">Latency: {data.fetch_duration_ms}ms</div>
   453|   453|            )}
   454|   454|            {fetchCount > 0 && (
   455|   455|              <div className="text-xs text-gray-500">Fetches: {fetchCount}</div>
   456|   456|            )}
   457|   457|          </div>
   458|   458|        </aside>
   459|   459|      </main>
   460|   460|    </div>
   461|   461|  );
   462|   462|}
   463|   463|