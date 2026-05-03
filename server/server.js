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

// ─── Execute CLI command ───
function execCommand(cmd) {
  return new Promise((resolve, reject) => {
    exec(cmd, { timeout: 15000 }, (error, stdout, stderr) => {
      if (error) {
        console.warn(`Command failed: ${cmd}`, stderr);
        return reject(error);
      }
      try {
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

// ─── Fetch real-time market data from CoinGecko ───
async function fetchCoinGeckoMarketData() {
  try {
    const cmd = `curl -s "https://api.coingecko.com/api/v3/coins/hyperliquid"`;
    const output = await new Promise((resolve, reject) => {
      exec(cmd, { timeout: 10000 }, (error, stdout, stderr) => {
        if (error) return reject(error);
        resolve(stdout);
      });
    });
    const data = JSON.parse(output);
    const md = data.market_data || {};
    return {
      price: md.current_price?.usd || 0,
      market_cap: md.market_cap?.usd || 0,
      market_cap_rank: md.market_cap_rank || 0,
      total_volume: md.total_volume?.usd || 0,
      high_24h: md.high_24h?.usd || 0,
      low_24h: md.low_24h?.usd || 0,
      price_change_24h: md.price_change_percentage_24h || 0,
      price_change_7d: md.price_change_percentage_7d || 0,
      price_change_30d: md.price_change_percentage_30d || 0,
      circulating_supply: md.circulating_supply || 0,
      total_supply: md.total_supply || 0,
      max_supply: md.max_supply || 0,
      ath: md.ath?.usd || 0,
      ath_date: md.ath_date?.usd || '',
      atl: md.atl?.usd || 0,
    };
  } catch (e) {
    console.warn('CoinGecko market data fetch failed:', e.message);
    return null;
  }
}

// ─── Fetch 1-year daily price+volume history from CoinGecko ───
async function fetchCoinGeckoHistory() {
  try {
    // Check cache (1 hour)
    if (fs.existsSync(COINGECKO_CACHE_FILE)) {
      const cache = JSON.parse(fs.readFileSync(COINGECKO_CACHE_FILE, 'utf8'));
      if (Date.now() - cache.timestamp < 3600000) {
        return cache.data;
      }
    }
  } catch (e) {}

  try {
    const apiUrl = 'https://api.coingecko.com/api/v3/coins/hyperliquid/market_chart?vs_currency=usd&days=365&interval=daily';
    const cmd = `curl -s "${apiUrl}"`;
    const output = await new Promise((resolve, reject) => {
      exec(cmd, { timeout: 15000 }, (error, stdout) => {
        if (error) return reject(error);
        resolve(stdout);
      });
    });
    const marketChart = JSON.parse(output);
    const historyData = {
      prices: marketChart.prices || [],
      volumes: marketChart.total_volumes || [],
    };
    fs.writeFileSync(COINGECKO_CACHE_FILE, JSON.stringify({ timestamp: Date.now(), data: historyData }, null, 2));
    return historyData;
  } catch (e) {
    console.warn('CoinGecko history fetch failed:', e.message);
    try {
      if (fs.existsSync(COINGECKO_CACHE_FILE)) {
        return JSON.parse(fs.readFileSync(COINGECKO_CACHE_FILE, 'utf8')).data;
      }
    } catch (_) {}
    return { prices: [], volumes: [] };
  }
}

// ─── Transform TrueNorth technical data ───
function transformTechnicalData(tnData) {
  const result = tnData.result;
  const metadata = result.token_metadata?.data || {};
  const indicators = result.technical_indicators || {};
  const support_resistance = result.support_resistance || {};

  const categories = {
    trend: [
      { name: 'SMA(10)', value: indicators.sma10?.value || 0, action: indicators.sma10?.state === 'price_above' ? 'buy' : 'sell', detail: `Slope: ${indicators.sma10?.slope || 'N/A'}` },
      { name: 'SMA(20)', value: indicators.sma20?.value || 0, action: indicators.sma20?.state === 'price_above' ? 'buy' : 'sell', detail: `Slope: ${indicators.sma20?.slope || 'N/A'}` },
      { name: 'SMA(50)', value: indicators.sma50?.value || 0, action: indicators.sma50?.state === 'price_above' ? 'buy' : 'sell', detail: `Slope: ${indicators.sma50?.slope || 'N/A'}` },
      { name: 'ADX(14)', value: indicators.adx14?.adx || 0, action: indicators.adx14?.trend_direction === 'bull' ? 'buy' : 'sell', detail: `Strength: ${indicators.adx14?.trend_strength || 'N/A'}` },
      { name: 'VWAP', value: support_resistance.vwap?.cumulative?.value || 0, action: support_resistance.vwap?.cumulative?.state === 'price_above' ? 'buy' : 'sell', detail: `Source: ${support_resistance.vwap?.tf_source || 'N/A'}` },
    ],
    momentum: [
      { name: 'RSI(14)', value: indicators.rsi14?.value || 0, action: indicators.rsi14?.state || 'neutral', detail: `Momentum: ${indicators.rsi14?.momentum || 'N/A'}` },
      { name: 'Stochastic(14,3,3)', value: indicators.stoch_k_14_3_3?.k || 0, action: indicators.stoch_k_14_3_3?.zone === 'overbought' ? 'sell' : indicators.stoch_k_14_3_3?.zone === 'oversold' ? 'buy' : 'neutral', detail: `Direction: ${indicators.stoch_k_14_3_3?.direction || 'N/A'}` },
      { name: 'KDJ(14,3,3)', value: indicators.kdj_14_3_3?.j || 0, action: indicators.kdj_14_3_3?.direction === 'bull' ? 'buy' : 'sell', detail: `K: ${indicators.kdj_14_3_3?.k || 0}` },
      { name: 'CCI(20)', value: indicators.cci20?.value || 0, action: indicators.cci20?.state === 'overbought' ? 'sell' : indicators.cci20?.state === 'oversold' ? 'buy' : 'neutral', detail: indicators.cci20?.state || 'N/A' },
      { name: 'MACD(12,26,9)', value: indicators.macd_12_26_9?.hist || 0, action: indicators.macd_12_26_9?.state === 'bull' ? 'buy' : 'sell', detail: `DIF: ${indicators.macd_12_26_9?.dif || 0}` },
    ],
    volatility: [
      { name: 'Bollinger(20,2)', value: indicators.boll_20_2?.pb || 0, action: indicators.boll_20_2?.near === 'near_upper' ? 'sell' : indicators.boll_20_2?.near === 'near_lower' ? 'buy' : 'neutral', detail: `Mid: ${indicators.boll_20_2?.mid || 0}` },
      { name: 'ATR(14)', value: indicators.atr14?.value || 0, action: indicators.atr14?.state === 'low' ? 'buy' : 'sell', detail: `${((indicators.atr14?.atr_pct || 0) * 100).toFixed(2)}%` },
      { name: 'BB Width', value: indicators.boll_20_2?.bandwidth || 0, action: 'neutral', detail: 'Relative Bands' },
    ],
    volume_indicators: [
      { name: 'Volume 1d', value: indicators.volume?.value || 0, action: indicators.volume?.state === 'low' ? 'sell' : 'buy', detail: `vs MA20: ${((indicators.volume?.vs_ma20 || 0) * 100).toFixed(1)}%` },
      { name: 'Vol MA20', value: indicators.volume?.ma20 || 0, action: 'neutral', detail: 'Moving Average' },
    ],
  };

  // Build decision from indicator_table
  const indicatorTable = metadata.indicator_table || [];
  const buySignals = indicatorTable.filter(i => i.action === 'buy' || i.action === 'strong_buy').length;
  const sellSignals = indicatorTable.filter(i => i.action === 'sell' || i.action === 'strong_sell').length;
  const neutralSignals = indicatorTable.filter(i => i.action === 'neutral').length;
  const overall = metadata.overall_dashboard || {};

  const totalSignals = buySignals + sellSignals + neutralSignals;
  const score = totalSignals > 0 ? Math.round(((buySignals * 1.5 + neutralSignals * 0.5) / (totalSignals * 1.5)) * 100) : 50;

  let actionMain = overall.overall_action || 'Neutral';
  let actionEmoji = '⚪';
  if (actionMain.includes('strong_buy') || score > 75) actionEmoji = '🟢';
  else if (actionMain.includes('buy') || score > 60) actionEmoji = '🟢';
  else if (actionMain.includes('strong_sell') || score < 25) actionEmoji = '🔴';
  else if (actionMain.includes('sell') || score < 40) actionEmoji = '🔴';
  else actionEmoji = '🟡';

  return {
    indicators: categories,
    support_resistance: support_resistance,
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
      summary: `${actionEmoji} Score: ${score}% | ${buySignals} buys, ${sellSignals} sells. Source: TrueNorth AI.`,
    },
    events: [],
    timeframe: metadata.timeframe || '1d',
    source: 'TrueNorth AI',
  };
}

// ─── Transform derivatives data ───
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
      oi_mcap_ratio: oi.oi_mcap_ratio_analysis?.oi_mcap_ratio_pct || 0,
    },
    funding_rate: {
      current_rate_pct: funding.current_funding_rate_in_percentage || 0,
      annualized_cost_pct: funding.annualized_funding_cost_est_in_percentage || 0,
      funding_percentile_7d: funding.current_funding_percentile_7d || 0,
      change_1d_pct: funding.funding_changes_in_percentage?.funding_change_1d_abs || 0,
    },
    liquidations: {
      short_liq_points: (liquidation.max_short_liquidation_point || []).slice(0, 3),
      long_liq_points: (liquidation.max_long_liquidation_point || []).slice(0, 3),
      imbalance_ratio: liquidation.imbalance?.imbalance_ratio || 0,
      interpretation: liquidation.imbalance?.interpretation || 'N/A',
    },
  };
}

// ─── EMA Calculation ───
function calculateEMA(prices, period) {
  if (!prices || prices.length < period) return [];
  const emaValues = new Array(prices.length).fill(null);
  let sum = 0;
  for (let i = 0; i < period; i++) sum += prices[i][1];
  let ema = sum / period;
  emaValues[period - 1] = ema;
  const multiplier = 2 / (period + 1);
  for (let i = period; i < prices.length; i++) {
    ema = (prices[i][1] - ema) * multiplier + ema;
    emaValues[i] = ema;
  }
  return prices.map((price, index) => [price[0], emaValues[index]]);
}

// ─── RSI Calculation ───
function calculateRSI(prices, period = 14) {
  if (!prices || prices.length < period + 1) return [];
  const rsiValues = new Array(prices.length).fill(null);
  let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) {
    const change = prices[i][1] - prices[i - 1][1];
    if (change > 0) gains += change; else losses -= change;
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;
  rsiValues[period] = avgLoss === 0 ? 100 : 100 - (100 / (1 + avgGain / avgLoss));
  for (let i = period + 1; i < prices.length; i++) {
    const change = prices[i][1] - prices[i - 1][1];
    avgGain = (avgGain * (period - 1) + (change > 0 ? change : 0)) / period;
    avgLoss = (avgLoss * (period - 1) + (change < 0 ? -change : 0)) / period;
    rsiValues[i] = avgLoss === 0 ? 100 : 100 - (100 / (1 + avgGain / avgLoss));
  }
  return prices.map((price, index) => [price[0], rsiValues[index]]);
}

// ─── OBV Calculation ───
function calculateOBV(prices, volumes) {
  if (!prices || !volumes || prices.length < 2) return null;
  const sortedP = [...prices].sort((a, b) => a[0] - b[0]);
  const sortedV = [...volumes].sort((a, b) => a[0] - b[0]);
  let obv = 0;
  for (let i = 1; i < sortedP.length; i++) {
    if (sortedP[i][1] > sortedP[i - 1][1]) obv += sortedV[i]?.[1] || 0;
    else if (sortedP[i][1] < sortedP[i - 1][1]) obv -= sortedV[i]?.[1] || 0;
  }
  return obv;
}

// ─── RSI Divergence Detection ───
function detectRSIDivergence(prices, rsiValues) {
  if (!prices || !rsiValues || prices.length < 20) return { hasDivergence: false, type: null, description: null };

  const recentP = prices.slice(-20);
  const recentR = rsiValues.filter(r => r[1] !== null).slice(-20);
  if (recentR.length < 10) return { hasDivergence: false, type: null, description: null };

  // Find swing lows and highs
  const findSwings = (data, lookback = 3) => {
    const swings = { highs: [], lows: [] };
    for (let i = lookback; i < data.length - lookback; i++) {
      let isHigh = true, isLow = true;
      for (let j = i - lookback; j <= i + lookback; j++) {
        if (j === i) continue;
        if (data[j][1] >= data[i][1]) isHigh = false;
        if (data[j][1] <= data[i][1]) isLow = false;
      }
      if (isHigh) swings.highs.push(i);
      if (isLow) swings.lows.push(i);
    }
    return swings;
  };

  const priceSwings = findSwings(recentP);
  const rsiSwings = findSwings(recentR);

  // Check bearish divergence: price higher high, RSI lower high
  if (priceSwings.highs.length >= 2 && rsiSwings.highs.length >= 2) {
    const pLast = priceSwings.highs[priceSwings.highs.length - 1];
    const pPrev = priceSwings.highs[priceSwings.highs.length - 2];
    const rLast = rsiSwings.highs[rsiSwings.highs.length - 1];
    const rPrev = rsiSwings.highs[rsiSwings.highs.length - 2];
    if (recentP[pLast][1] > recentP[pPrev][1] && recentR[rLast]?.[1] < recentR[rPrev]?.[1]) {
      return { hasDivergence: true, type: 'bearish', description: 'Bearish RSI Divergence: Price made higher high but RSI made lower high' };
    }
  }

  // Check bullish divergence: price lower low, RSI higher low
  if (priceSwings.lows.length >= 2 && rsiSwings.lows.length >= 2) {
    const pLast = priceSwings.lows[priceSwings.lows.length - 1];
    const pPrev = priceSwings.lows[priceSwings.lows.length - 2];
    const rLast = rsiSwings.lows[rsiSwings.lows.length - 1];
    const rPrev = rsiSwings.lows[rsiSwings.lows.length - 2];
    if (recentP[pLast][1] < recentP[pPrev][1] && recentR[rLast]?.[1] > recentR[rPrev]?.[1]) {
      return { hasDivergence: true, type: 'bullish', description: 'Bullish RSI Divergence: Price made lower low but RSI made higher low' };
    }
  }

  return { hasDivergence: false, type: null, description: null };
}

// ─── Cache helpers ───
function readCache() {
  try { if (fs.existsSync(CACHE_FILE)) return JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8')); } catch (e) {}
  return null;
}
function writeCache(data) {
  try { fs.writeFileSync(CACHE_FILE, JSON.stringify(data, null, 2)); } catch (e) {}
}

// ─── Main endpoint ───
app.get('/api/live-data', async (req, res) => {
  const startTime = Date.now();
  const requestedTf = req.query.timeframe || '1d';
  const validTfs = ['5m', '15m', '1h', '4h', '1d'];
  const timeframe = validTfs.includes(requestedTf) ? requestedTf : '1d';

  try {
    // Run all fetches in parallel
    const [taData, derivData, marketData, history] = await Promise.allSettled([
      execCommand(`tn ta hyperliquid --timeframe ${timeframe} --json`),
      execCommand('tn deriv hyperliquid --json'),
      fetchCoinGeckoMarketData(),
      fetchCoinGeckoHistory(),
    ]);

    let responseData = readCache() || {};
    const errors = [];

    // Technical Analysis
    if (taData.status === 'fulfilled') {
      responseData = { ...responseData, ...transformTechnicalData(taData.value) };
    } else {
      errors.push(`TA: ${taData.reason.message}`);
    }

    // Derivatives
    if (derivData.status === 'fulfilled') {
      responseData.derivatives = transformDerivativesData(derivData.value);
    } else {
      errors.push(`Derivatives: ${derivData.reason.message}`);
    }

    // Market Data from CoinGecko
    if (marketData.status === 'fulfilled' && marketData.value) {
      const m = marketData.value;
      responseData.price = m.price;
      responseData.market_cap = m.market_cap;
      responseData.market_cap_rank = m.market_cap_rank;
      responseData.total_volume = m.total_volume;
      responseData.high_24h = m.high_24h;
      responseData.low_24h = m.low_24h;
      responseData.price_change = {
        '24h': m.price_change_24h?.toFixed(2) + '%',
        '7d': m.price_change_7d?.toFixed(2) + '%',
        '30d': m.price_change_30d?.toFixed(2) + '%',
      };
      responseData.circulating_supply = m.circulating_supply;
      responseData.total_supply = m.total_supply;
      responseData.ath = m.ath;
      responseData.atl = m.atl;
    }

    // History
    if (history.status === 'fulfilled') {
      responseData.history = history.value;
      const prices = history.value?.prices || [];
      const volumes = history.value?.volumes || [];

      // EMA
      responseData.ema20History = calculateEMA(prices, 20);
      responseData.ema50History = calculateEMA(prices, 50);
      responseData.ema200History = calculateEMA(prices, 200);
      responseData.ema20 = responseData.ema20History[responseData.ema20History.length - 1]?.[1] || null;
      responseData.ema50 = responseData.ema50History[responseData.ema50History.length - 1]?.[1] || null;
      responseData.ema200 = responseData.ema200History[responseData.ema200History.length - 1]?.[1] || null;

      // OBV
      responseData.obv = calculateOBV(prices, volumes);

      // RSI
      const rsiHist = calculateRSI(prices, 14);
      responseData.rsiHistory = rsiHist;
      responseData.rsi = rsiHist[rsiHist.length - 1]?.[1] || null;

      // RSI Divergence
      responseData.rsiDivergence = detectRSIDivergence(prices, rsiHist);
    }

    responseData.last_updated = new Date().toISOString();
    responseData.fetch_duration_ms = Date.now() - startTime;
    responseData.errors = errors.length > 0 ? errors : null;

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

// ─── Health check ───
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`🚀 HYPE Monitor backend running on http://localhost:${PORT}`);
  console.log(`📡 GET /api/live-data?timeframe=[5m,15m,1h,4h,1d]`);
  console.log(`📡 GET /health`);
});
