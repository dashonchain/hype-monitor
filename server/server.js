const express = require('express');
const { exec } = require('child_process');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3001;
const CACHE_FILE = path.join(__dirname, 'cache.json');
const COINGECKO_CACHE_FILE = path.join(__dirname, 'cache-coingecko.json');

app.use(cors());
app.use(express.json());

// Fonction pour exécuter une commande CLI
function execCommand(cmd) {
  return new Promise((resolve, reject) => {
    exec(cmd, { timeout: 15000 }, (error, stdout, stderr) => {
      if (error) {
        console.warn(`Command failed: ${cmd}`, stderr);
        return reject(error);
      }
      try {
        // Nettoyer la sortie (enlever les lignes de logs avant le JSON)
        const jsonStart = stdout.indexOf('{');
        const jsonEnd = stdout.lastIndexOf('}') + 1;
        if (jsonStart === -1) throw new Error('No JSON found in output');
        const jsonStr = stdout.substring(jsonStart, jsonEnd);
        const data = JSON.parse(jsonStr);
        resolve(data);
      } catch (e) {
        reject(new Error(`Parse error: ${e.message}`));
      }
    });
  });
}

// Transformer les données CLI vers le format attendu par l'UI
function transformTechnicalData(tnData) {
  const result = tnData.result;
  const metadata = result.token_metadata?.data || {};
  const indicators = result.technical_indicators || {};
  
  // Extraire les indicateurs par catégorie
  const categories = {
    trend: [
      { name: 'SMA(10)', value: indicators.sma10?.value || 0, action: indicators.sma10?.state === 'price_above' ? 'buy' : 'sell', detail: `Pente: ${indicators.sma10?.slope || 'N/A'}` },
      { name: 'SMA(20)', value: indicators.sma20?.value || 0, action: indicators.sma20?.state === 'price_above' ? 'buy' : 'sell', detail: `Pente: ${indicators.sma20?.slope || 'N/A'}` },
      { name: 'SMA(50)', value: indicators.sma50?.value || 0, action: indicators.sma50?.state === 'price_above' ? 'buy' : 'sell', detail: `Pente: ${indicators.sma50?.slope || 'N/A'}` },
      { name: 'ADX(14)', value: indicators.adx14?.adx || 0, action: indicators.adx14?.trend_direction === 'bull' ? 'buy' : 'sell', detail: `Force: ${indicators.adx14?.trend_strength || 'N/A'}` },
      { name: 'VWAP', value: result.support_resistance?.vwap?.cumulative?.value || 0, action: result.support_resistance?.vwap?.cumulative?.state === 'price_above' ? 'buy' : 'sell', detail: `Source: ${result.support_resistance?.vwap?.tf_source || 'N/A'}` }
    ],
    momentum: [
      { name: 'RSI(14)', value: indicators.rsi14?.value || 0, action: indicators.rsi14?.state || 'neutral', detail: `Momentum: ${indicators.rsi14?.momentum || 'N/A'}` },
      { name: 'Stochastic(14,3,3)', value: indicators.stoch_k_14_3_3?.k || 0, action: indicators.stoch_k_14_3_3?.zone === 'overbought' ? 'sell' : indicators.stoch_k_14_3_3?.zone === 'oversold' ? 'buy' : 'neutral', detail: `Direction: ${indicators.stoch_k_14_3_3?.direction || 'N/A'}` },
      { name: 'KDJ(14,3,3)', value: indicators.kdj_14_3_3?.j || 0, action: indicators.kdj_14_3_3?.direction === 'bull' ? 'buy' : 'sell', detail: `K: ${indicators.kdj_14_3_3?.k || 0}` },
      { name: 'CCI(20)', value: indicators.cci20?.value || 0, action: indicators.cci20?.state === 'overbought' ? 'sell' : indicators.cci20?.state === 'oversold' ? 'buy' : 'neutral', detail: indicators.cci20?.state || 'N/A' },
      { name: 'MACD(12,26,9)', value: indicators.macd_12_26_9?.hist || 0, action: indicators.macd_12_26_9?.state === 'bull' ? 'buy' : 'sell', detail: `DIF: ${indicators.macd_12_26_9?.dif || 0}` }
    ],
    volatility: [
      { name: 'Bollinger(20,2)', value: indicators.boll_20_2?.pb || 0, action: indicators.boll_20_2?.near === 'near_upper' ? 'sell' : indicators.boll_20_2?.near === 'near_lower' ? 'buy' : 'neutral', detail: `Mid: ${indicators.boll_20_2?.mid || 0}` },
      { name: 'ATR(14)', value: indicators.atr14?.value || 0, action: indicators.atr14?.state === 'low' ? 'buy' : 'sell', detail: `Pct: ${indicators.atr14?.atr_pct || 0}` },
      { name: 'Bollinger Bandwidth', value: indicators.boll_20_2?.bandwidth || 0, action: 'neutral', detail: 'Bandes relatives' }
    ],
    volume: [
      { name: 'Volume 1d', value: indicators.volume?.value || 0, action: indicators.volume?.state === 'low' ? 'sell' : 'buy', detail: `vs MA20: ${((indicators.volume?.vs_ma20 || 0) * 100).toFixed(1)}%` },
      { name: 'Volume MA20', value: indicators.volume?.ma20 || 0, action: 'neutral', detail: 'Moyenne mobile' }
    ]
  };

  // Construire la décision basée sur indicator_table
  const indicatorTable = metadata.indicator_table || [];
  const buySignals = indicatorTable.filter(i => i.action === 'buy' || i.action === 'strong_buy').length;
  const sellSignals = indicatorTable.filter(i => i.action === 'sell' || i.action === 'strong_sell').length;
  const neutralSignals = indicatorTable.filter(i => i.action === 'neutral').length;
  const overall = metadata.overall_dashboard || {};

  // Calculer le Signal Score (0-100%) selon les standards pro
  const totalSignals = buySignals + sellSignals + neutralSignals;
  const score = totalSignals > 0 ? Math.round(((buySignals * 1.5 + neutralSignals * 0.5) / (totalSignals * 1.5)) * 100) : 50;
  
  // Déterminer l'action principale avec émojis (codes couleur universels)
  let actionMain = overall.overall_action || 'Neutral';
  let actionEmoji = '⚪'; // Gris = Neutral
  if (actionMain.includes('strong_buy') || score > 75) actionEmoji = '🟢'; // Vert = Strong Buy
  else if (actionMain.includes('buy') || score > 60) actionEmoji = '🟢'; // Vert = Buy
  else if (actionMain.includes('strong_sell') || score < 25) actionEmoji = '🔴'; // Rouge = Strong Sell
  else if (actionMain.includes('sell') || score < 40) actionEmoji = '🔴'; // Rouge = Sell
  else actionEmoji = '🟡'; // Jaune = Neutral

  return {
    price: metadata.price || 0,
    price_change: metadata.price_change || {},
    market_cap: metadata.market_cap || 0,
    market_cap_rank: metadata.market_cap_rank || 0,
    total_volume: metadata.total_volume || 0,
    indicators: categories,
    support_resistance: result.support_resistance || {},
    
    // Nouveau : Signal Score et action améliorée
    signal_score: score,
    signal_emoji: actionEmoji,
    overall_decision: {
      action: actionMain,
      action_display: `${actionEmoji} ${actionMain.toUpperCase()}`,
      buy_signals: buySignals,
      sell_signals: sellSignals,
      neutral_signals: neutralSignals,
      buy_ratio: overall.buy_ratio || 0,
      sell_ratio: overall.sell_ratio || 0,
      score_percent: score,
      summary: `${actionEmoji} Score: ${score}% | ${buySignals} achats, ${sellSignals} ventes. Source: TrueNorth CLI.`
    },
    events: [], // Les événements seront ajoutés séparément
    timeframe: metadata.timeframe || '1d',
    last_updated: metadata.timestamp || new Date().toISOString(),
    source: 'TrueNorth CLI'
  };
}

function transformDerivativesData(tnData) {
  const deriv = tnData.result?.derivative_data?.HYPE || {};
  const oi = deriv['Aggregated open interest'] || {};
  const funding = deriv['1h Aggregated OI weighted funding rate'] || {};
  const liquidation = deriv['Binance/Bybit/OKX aggreated liquidation map'] || {};

  return {
    open_interest: {
      current_oi: oi.current_open_interest || 0,
      oi_change_1d: oi.rolling_changes?.oi_change_1d_abs || 0,
      oi_change_4h: oi.rolling_changes?.oi_change_4h_abs || 0,
      oi_percentile_7d: oi.percentile_analysis?.current_oi_percentile_7d || 0,
      oi_mcap_ratio: oi.oi_mcap_ratio_analysis?.oi_mcap_ratio_pct || 0
    },
    funding_rate: {
      current_rate_pct: funding.current_funding_rate_in_percentage || 0,
      annualized_cost_pct: funding.annualized_funding_cost_est_in_percentage || 0,
      funding_percentile_7d: funding.current_funding_percentile_7d || 0,
      change_1d_pct: funding.funding_changes_in_percentage?.funding_change_1d_abs || 0
    },
    liquidations: {
      short_liq_points: liquidation.max_short_liquidation_point || [],
      long_liq_points: liquidation.max_long_liquidation_point || [],
      imbalance_ratio: liquidation.imbalance?.imbalance_ratio || 0,
      interpretation: liquidation.imbalance?.interpretation || 'N/A'
    }
  };
}

// Fetch 1-year daily price+volume history from CoinGecko (cached for 1 hour)
async function fetchCoinGeckoHistory() {
  console.log('fetchCoinGeckoHistory called');
  // Check valid cache first (1 hour expiry)
  try {
    if (fs.existsSync(COINGECKO_CACHE_FILE)) {
      const cache = JSON.parse(fs.readFileSync(COINGECKO_CACHE_FILE, 'utf8'));
      const cacheAge = Date.now() - cache.timestamp;
      if (cacheAge < 3600000) { // 1 hour in milliseconds
        console.log('Returning cached CoinGecko history data');
        return cache.data;
      }
    }
  } catch (e) {
    console.warn('CoinGecko cache read error:', e.message);
  }

  // Fetch fresh data from CoinGecko API
  const apiUrl = 'https://api.coingecko.com/api/v3/coins/hyperliquid/market_chart?vs_currency=usd&days=365&interval=daily';
  const cmd = `curl -s "${apiUrl}"`;
  
  try {
    const output = await new Promise((resolve, reject) => {
      exec(cmd, { timeout: 15000 }, (error, stdout, stderr) => {
        if (error) {
          console.error('CoinGecko API request failed:', stderr || error.message);
          return reject(error);
        }
        resolve(stdout);
      });
    });

    const marketChart = JSON.parse(output);
    const historyData = {
      prices: marketChart.prices || [],
      volumes: marketChart.total_volumes || []
    };

    // Update cache with timestamp
    const cacheContent = {
      timestamp: Date.now(),
      data: historyData
    };
    fs.writeFileSync(COINGECKO_CACHE_FILE, JSON.stringify(cacheContent, null, 2));
    console.log('Fetched fresh CoinGecko history data');
    return historyData;
  } catch (e) {
    console.error('Failed to fetch CoinGecko history:', e.message);
    // Fallback to stale cache if available
    try {
      if (fs.existsSync(COINGECKO_CACHE_FILE)) {
        const staleCache = JSON.parse(fs.readFileSync(COINGECKO_CACHE_FILE, 'utf8'));
        console.warn('Using stale CoinGecko cache due to fetch error');
        return staleCache.data;
      }
    } catch (cacheError) {
      console.error('Failed to read stale CoinGecko cache:', cacheError.message);
    }
    return { prices: [], volumes: [] }; // Last resort empty data
  }
}

// Calculer l'EMA (Exponential Moving Average)
function calculateEMA(prices, period) {
  if (!prices || prices.length < period) return [];
  const emaValues = new Array(prices.length).fill(null);
  // SMA initiale sur les 'period' premières périodes
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += prices[i][1]; // prices est un tableau de [timestamp, prix]
  }
  let ema = sum / period;
  emaValues[period - 1] = ema;
  const multiplier = 2 / (period + 1);
  // Calcul de l'EMA pour les périodes restantes
  for (let i = period; i < prices.length; i++) {
    ema = (prices[i][1] - ema) * multiplier + ema;
    emaValues[i] = ema;
  }
  // Retourner un tableau de [timestamp, ema] pour correspondre au format prices
  return prices.map((price, index) => [price[0], emaValues[index]]);
}

// Calculer le RSI (Relative Strength Index)
function calculateRSI(prices, period = 14) {
  if (!prices || prices.length < period + 1) return [];
  const rsiValues = new Array(prices.length).fill(null);
  let gains = 0, losses = 0;
  
  // Calculate initial average gain/loss
  for (let i = 1; i <= period; i++) {
    const change = prices[i][1] - prices[i-1][1];
    if (change > 0) gains += change;
    else losses -= change;
  }
  
  let avgGain = gains / period;
  let avgLoss = losses / period;
  
  rsiValues[period] = avgLoss === 0 ? 100 : 100 - (100 / (1 + avgGain / avgLoss));
  
  // Calculate RSI for remaining periods
  for (let i = period + 1; i < prices.length; i++) {
    const change = prices[i][1] - prices[i-1][1];
    let currentGain = change > 0 ? change : 0;
    let currentLoss = change < 0 ? -change : 0;
    
    avgGain = (avgGain * (period - 1) + currentGain) / period;
    avgLoss = (avgLoss * (period - 1) + currentLoss) / period;
    
    rsiValues[i] = avgLoss === 0 ? 100 : 100 - (100 / (1 + avgGain / avgLoss));
  }
  
  return prices.map((price, index) => [price[0], rsiValues[index]]);
}

// Détecter la divergence RSI
function detectRSIDivergence(prices, rsiValues) {
  if (!prices || !rsiValues || prices.length < 20) return { hasDivergence: false, type: null, description: null };
  
  // Chercher les sommets et creux de prix sur les 20 derniers points
  const recentPrices = prices.slice(-20);
  const recentRSI = rsiValues.slice(-20);
  
  // Trouver les hauts et bas de prix
  let priceHighIndex = 0, priceLowIndex = 0;
  for (let i = 1; i < recentPrices.length; i++) {
    if (recentPrices[i][1] > recentPrices[priceHighIndex][1]) priceHighIndex = i;
    if (recentPrices[i][1] < recentPrices[priceLowIndex][1]) priceLowIndex = i;
  }
  
  // Trouver les hauts et bas de RSI
  let rsiHighIndex = 0, rsiLowIndex = 0;
  for (let i = 1; i < recentRSI.length; i++) {
    if (recentRSI[i][1] > recentRSI[rsiHighIndex][1]) rsiHighIndex = i;
    if (recentRSI[i][1] > 0 && (recentRSI[rsiLowIndex][1] === null || recentRSI[i][1] < recentRSI[rsiLowIndex][1])) rsiLowIndex = i;
  }
  
  // Vérifier divergence haussière (prix fait un plus bas mais RSI fait un plus haut)
  const bullishDiv = recentPrices[priceLowIndex][1] < recentPrices[priceLowIndex - 1]?.[1] && 
                    recentRSI[rsiLowIndex][1] > recentRSI[rsiLowIndex - 1]?.[1];
  
  // Vérifier divergence baissière (prix fait un plus haut mais RSI fait un plus bas)
  const bearishDiv = recentPrices[priceHighIndex][1] > recentPrices[priceHighIndex - 1]?.[1] && 
                    recentRSI[rsiHighIndex][1] < recentRSI[rsiHighIndex - 1]?.[1];
  
  if (bearishDiv) {
    return { hasDivergence: true, type: 'bearish', description: 'Bearish RSI Divergence: Price made higher high but RSI made lower high' };
  } else if (bullishDiv) {
    return { hasDivergence: true, type: 'bullish', description: 'Bullish RSI Divergence: Price made lower low but RSI made higher low' };
  }
  
  return { hasDivergence: false, type: null, description: null };
}

// Calculer l'OBV (On-Balance Volume)
function calculateOBV(prices, volumes) {
  if (!prices || !volumes || prices.length < 2 || volumes.length < 2) return null;
  // Trier par timestamp croissant
  const sortedPrices = [...prices].sort((a, b) => a[0] - b[0]);
  const sortedVolumes = [...volumes].sort((a, b) => a[0] - b[0]);
  let obv = 0;
  for (let i = 1; i < sortedPrices.length; i++) {
    const currentPrice = sortedPrices[i][1];
    const prevPrice = sortedPrices[i-1][1];
    const volume = sortedVolumes[i][1]; // Le volume associé à la période courante
    if (currentPrice > prevPrice) {
      obv += volume;
    } else if (currentPrice < prevPrice) {
      obv -= volume;
    }
    // Si prix égal, pas de changement d'OBV
  }
  return obv;
}

// Lire le cache
function readCache() {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      return JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
    }
  } catch (e) {
    console.warn('Cache read error:', e.message);
  }
  return null;
}

// Écrire dans le cache
function writeCache(data) {
  try {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(data, null, 2));
  } catch (e) {
    console.warn('Cache write error:', e.message);
  }
}

// Endpoint principal : récupérer toutes les données live
app.get('/api/live-data', async (req, res) => {
  const startTime = Date.now();
  const requestedTimeframe = req.query.timeframe || '1d';
  const validTimeframes = ['5m', '15m', '1h', '4h', '1d'];
  const timeframe = validTimeframes.includes(requestedTimeframe) ? requestedTimeframe : '1d';
  if (requestedTimeframe !== timeframe) {
    console.warn(`Invalid timeframe "${requestedTimeframe}", defaulting to 1d`);
  }
  
  try {
    console.log(`Fetching live data (timeframe: ${timeframe})...`);
    
    // Exécuter les deux commandes en parallèle
    const [taData, derivData] = await Promise.allSettled([
      execCommand(`tn ta hyperliquid --timeframe ${timeframe} --json`),
      execCommand('tn deriv hyperliquid --json')
    ]);

    let responseData = readCache() || {};
    let errors = [];

    // Traiter Technical Analysis
    if (taData.status === 'fulfilled') {
      const transformed = transformTechnicalData(taData.value);
      responseData = { ...responseData, ...transformed };
    } else {
      errors.push(`TA Error: ${taData.reason.message}`);
      console.error('TA failed:', taData.reason);
    }

    // Traiter Derivatives
    if (derivData.status === 'fulfilled') {
      responseData.derivatives = transformDerivativesData(derivData.value);
    } else {
      errors.push(`Derivatives Error: ${derivData.reason.message}`);
      console.error('Derivatives failed:', derivData.reason);
    }

    // Add CoinGecko historical data
    const history = await fetchCoinGeckoHistory();
    responseData.history = history;
    
    // Calculer les EMA (historique complet pour graphique)
    if (history && history.prices) {
      responseData.ema20History = calculateEMA(history.prices, 20);
      responseData.ema50History = calculateEMA(history.prices, 50);
      responseData.ema200History = calculateEMA(history.prices, 200);
      // Garder aussi la valeur actuelle pour le dashboard
      responseData.ema20 = responseData.ema20History.length > 0 ? responseData.ema20History[responseData.ema20History.length -1][1] : null;
      responseData.ema50 = responseData.ema50History.length > 0 ? responseData.ema50History[responseData.ema50History.length -1][1] : null;
      responseData.ema200 = responseData.ema200History.length > 0 ? responseData.ema200History[responseData.ema200History.length -1][1] : null;
    }
    
    // Calculer l'OBV
    if (history && history.prices && history.volumes) {
      responseData.obv = calculateOBV(history.prices, history.volumes);
    }
    
    // Calculer le RSI (historique complet pour graphique)
    let rsiHistory = [];
    if (history && history.prices) {
      rsiHistory = calculateRSI(history.prices, 14);
      responseData.rsiHistory = rsiHistory;
      // Garder la valeur actuelle
      responseData.rsi = rsiHistory.length > 0 ? rsiHistory[rsiHistory.length - 1][1] : null;
      
      // Détecter la divergence RSI
      const divergence = detectRSIDivergence(history.prices, rsiHistory);
      responseData.rsiDivergence = divergence;
    }
    
    // Ajouter les métadonnées de fraîcheur
    responseData.last_updated = new Date().toISOString();
    responseData.fetch_duration_ms = Date.now() - startTime;
    responseData.errors = errors.length > 0 ? errors : null;

    // Mettre à jour le cache
    writeCache(responseData);

    res.json(responseData);
  } catch (error) {
    console.error('Live data error:', error);
    const cache = readCache();
    if (cache) {
      cache.errors = [`Fetch error: ${error.message}`];
      cache.last_updated = new Date().toISOString();
      return res.json(cache);
    }
    res.status(500).json({ error: error.message });
  }
});

// Endpoint de santé
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`🚀 Micro-backend HYPE Monitor running on http://localhost:${PORT}`);
  console.log(`📡 Endpoints:`);
  console.log(`   GET /api/live-data?timeframe=X (valid: 5m, 15m, 1h, 4h, 1d)`);
  console.log(`   GET /health`);
});
