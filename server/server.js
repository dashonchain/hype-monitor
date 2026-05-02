const express = require('express');
const { exec } = require('child_process');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3001;
const CACHE_FILE = path.join(__dirname, 'cache.json');

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

  return {
    price: metadata.price || 0,
    price_change: metadata.price_change || {},
    market_cap: metadata.market_cap || 0,
    market_cap_rank: metadata.market_cap_rank || 0,
    total_volume: metadata.total_volume || 0,
    indicators: categories,
    support_resistance: result.support_resistance || {},
    overall_decision: {
      action: overall.overall_action || 'Neutral',
      buy_signals: buySignals,
      sell_signals: sellSignals,
      neutral_signals: neutralSignals,
      buy_ratio: overall.buy_ratio || 0,
      sell_ratio: overall.sell_ratio || 0,
      summary: `Tendance basée sur ${buySignals} achats, ${sellSignals} ventes. Source: TrueNorth.`
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
  const timeframe = req.query.timeframe || '1d';
  
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
  console.log(`   GET /api/live-data?timeframe=1d (1h, 4h, 1d, 1w)`);
  console.log(`   GET /health`);
});
