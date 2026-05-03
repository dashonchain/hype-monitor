// @ts-nocheck
import { NextResponse } from 'next/server';

const CACHE_TTL = 30_000; // 30 seconds
let cache: { data: any; timestamp: number } | null = null;

// ─── Fetch Variational (Omni DEX data) ───
async function fetchVariational() {
  try {
    const res = await fetch('https://api.variational.io/v1/markets', {
      signal: AbortSignal.timeout(8000),
      headers: { 'Accept': 'application/json' }
    });
    if (!res.ok) throw new Error(`Variational HTTP ${res.status}`);
    const data = await res.json();

    const markets: any[] = Array.isArray(data) ? data : data?.markets || data?.data || [];
    const hype = markets.find((m: any) =>
      m?.symbol === 'HYPE' || m?.name === 'HYPE' || m?.base === 'HYPE' || m?.underlying === 'HYPE'
    );

    if (!hype) return null;

    const markPrice = parseFloat(hype.mark_price ?? hype.markPrice ?? hype.price ?? 0);
    const bidPrice = parseFloat(hype.bid_price ?? hype.bidPrice ?? hype.bid ?? 0);
    const askPrice = parseFloat(hype.ask_price ?? hype.askPrice ?? hype.ask ?? 0);
    const volume24h = parseFloat(hype.volume_24h ?? hype.volume24h ?? hype.volume ?? 0);
    const oiLong = parseFloat(hype.open_interest_long ?? hype.oiLong ?? hype.oi_long ?? 0);
    const oiShort = parseFloat(hype.open_interest_short ?? hype.oiShort ?? hype.oi_short ?? 0);
    const fundingRate = parseFloat(hype.funding_rate ?? hype.fundingRate ?? hype.funding ?? 0);
    const oiTotal = parseFloat(hype.open_interest ?? hype.openInterest ?? hype.oi ?? (oiLong + oiShort));

    const spread = askPrice > 0 && bidPrice > 0 ? askPrice - bidPrice : 0;
    const midPrice = (askPrice + bidPrice) / 2;
    const spreadBps = midPrice > 0 ? (spread / midPrice) * 10000 : 0;

    return {
      price: markPrice,
      bid: bidPrice,
      ask: askPrice,
      spread,
      spread_bps: spreadBps,
      volume_24h: volume24h,
      open_interest: {
        total: oiTotal,
        long: oiLong,
        short: oiShort,
        long_pct: oiTotal > 0 ? (oiLong / oiTotal) * 100 : 0,
        short_pct: oiTotal > 0 ? (oiShort / oiTotal) * 100 : 0,
      },
      funding_rate: fundingRate,
      funding_rate_pct: fundingRate * 100,
      updated_at: new Date().toISOString()
    };
  } catch (e: any) {
    console.warn('Variational error:', e.message);
    return null;
  }
}

// ─── Fetch CoinGecko (market cap / rank / history) ───
async function fetchCoinGecko(timeframe: string) {
  try {
    // Market data
    const mcRes = await fetch(
      'https://api.coingecko.com/api/v3/coins/hyperliquid?localization=false&tickers=false&community_data=false&developer_data=false',
      { signal: AbortSignal.timeout(8000) }
    );
    if (!mcRes.ok) throw new Error(`CoinGecko HTTP ${mcRes.status}`);
    const mcData = await mcRes.json();

    // History
    const days = timeframe === '1h' ? '1' : timeframe === '4h' ? '7' : '365';
    const interval = days === '365' ? 'daily' : 'hourly';
    const histRes = await fetch(
      `https://api.coingecko.com/api/v3/coins/hyperliquid/market_chart?vs_currency=usd&days=${days}&interval=${interval}`,
      { signal: AbortSignal.timeout(8000) }
    );
    const histData = histRes.ok ? await histRes.json() : null;

    return {
      market_cap: mcData.market_data?.market_cap?.usd ?? 0,
      market_cap_rank: mcData.market_cap_rank ?? 0,
      total_volume: mcData.market_data?.total_volume?.usd ?? 0,
      high_24h: mcData.market_data?.high_24h?.usd ?? 0,
      low_24h: mcData.market_data?.low_24h?.usd ?? 0,
      circulating_supply: mcData.market_data?.circulating_supply ?? 0,
      total_supply: mcData.market_data?.total_supply ?? 0,
      ath: mcData.market_data?.ath?.usd ?? 0,
      price_change: {
        '24h': mcData.market_data?.price_change_percentage_24h?.toFixed(2) ?? '0',
        '7d': mcData.market_data?.price_change_percentage_7d?.toFixed(2) ?? '0',
        '30d': mcData.market_data?.price_change_percentage_30d?.toFixed(2) ?? '0',
      },
      prices: histData?.prices?.map((p: [number, number]) => [p[0], p[1]]) ?? [],
      ema20History: [],
      ema50History: [],
      ema200History: [],
      rsiHistory: [],
    };
  } catch (e: any) {
    console.warn('CoinGecko error:', e.message);
    return null;
  }
}

// ─── Calculate EMA / RSI from price history ───
function calculateEMA(prices: number[], period: number): number[] {
  if (prices.length < period) return [];
  const k = 2 / (period + 1);
  const ema: number[] = [prices.slice(0, period).reduce((a, b) => a + b, 0) / period];
  for (let i = period; i < prices.length; i++) {
    ema.push(prices[i] * k + ema[ema.length - 1] * (1 - k));
  }
  return ema;
}

function calculateRSI(prices: number[], period = 14): number[] {
  if (prices.length < period + 1) return [];
  const changes = prices.slice(1).map((p, i) => p - prices[i]);
  let avgGain = changes.slice(0, period).filter(c => c > 0).reduce((a, b) => a + b, 0) / period;
  let avgLoss = changes.slice(0, period).filter(c => c < 0).reduce((a, b) => a + Math.abs(b), 0) / period;
  const rsi: number[] = [];
  for (let i = period; i < changes.length; i++) {
    avgGain = (avgGain * (period - 1) + Math.max(changes[i], 0)) / period;
    avgLoss = (avgLoss * (period - 1) + Math.max(-changes[i], 0)) / period;
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    rsi.push(100 - 100 / (1 + rs));
  }
  return rsi;
}

// ─── Technical Analysis from indicators ───
function buildAnalysis(ema20: number, ema50: number, ema200: number, rsi: number, price: number, cg: any) {
  const trend: any[] = [];
  const momentum: any[] = [];
  const volatility: any[] = [];
  const volume_indicators: any[] = [];
  let buy = 0, sell = 0, neutral = 0;

  // Trend
  const aboveEMA20 = price > ema20;
  const aboveEMA50 = price > ema50;
  const aboveEMA200 = price > ema200;
  const goldenCross = ema20 > ema50;
  const ema20gt50 = ema20 > ema50;
  const ema50gt200 = ema50 > ema200;

  if (goldenCross && aboveEMA200) {
    trend.push({ name: 'EMA Cross', value: 1, action: 'buy', detail: 'EMA20 > EMA50 — Bullish crossover' }); buy++;
  } else if (!goldenCross && !aboveEMA200) {
    trend.push({ name: 'EMA Cross', value: -1, action: 'sell', detail: 'EMA20 < EMA50 — Bearish crossover' }); sell++;
  } else {
    trend.push({ name: 'EMA Cross', value: 0, action: 'neutral', detail: 'No clear crossover' }); neutral++;
  }

  trend.push({ name: 'vs EMA20', value: aboveEMA20 ? 1 : -1, action: aboveEMA20 ? 'buy' : 'sell', detail: `Price ${aboveEMA20 ? 'above' : 'below'} EMA20` });
  aboveEMA20 ? buy++ : sell++;
  trend.push({ name: 'vs EMA50', value: aboveEMA50 ? 1 : -1, action: aboveEMA50 ? 'buy' : 'sell', detail: `Price ${aboveEMA50 ? 'above' : 'below'} EMA50` });
  aboveEMA50 ? buy++ : sell++;
  trend.push({ name: 'vs EMA200', value: aboveEMA200 ? 1 : -1, action: aboveEMA200 ? 'buy' : 'sell', detail: `Price ${aboveEMA200 ? 'above' : 'below'} EMA200` });
  aboveEMA200 ? buy++ : sell++;

  // Momentum
  if (rsi < 30) {
    momentum.push({ name: 'RSI(14)', value: rsi, action: 'buy', detail: `RSI ${rsi.toFixed(1)} — Oversold` }); buy++;
  } else if (rsi > 70) {
    momentum.push({ name: 'RSI(14)', value: rsi, action: 'sell', detail: `RSI ${rsi.toFixed(1)} — Overbought` }); sell++;
  } else {
    momentum.push({ name: 'RSI(14)', value: rsi, action: 'neutral', detail: `RSI ${rsi.toFixed(1)} — Neutral zone` }); neutral++;
  }

  momentum.push({ name: 'RSI Trend', value: rsi - 50, action: rsi > 50 ? 'buy' : 'sell', detail: rsi > 50 ? 'Bullish momentum' : 'Bearish momentum' });
  rsi > 50 ? buy++ : sell++;

  // Volatility (from ATR proxy)
  const dailyRange = cg ? (cg.high_24h - cg.low_24h) / price * 100 : 0;
  volatility.push({ name: 'Daily Range', value: dailyRange, action: dailyRange > 5 ? 'neutral' : 'neutral', detail: `${dailyRange.toFixed(2)}% — ${dailyRange > 5 ? 'High' : 'Normal'} volatility` });
  volatility.push({ name: 'ATH Distance', value: cg ? ((price / cg.ath) - 1) * 100 : 0, action: 'neutral', detail: `${cg ? ((price / cg.ath) * 100).toFixed(1) : 0}% of ATH` });
  neutral += 2;

  // Volume
  const volRatio = cg?.market_cap > 0 ? (cg.total_volume / cg.market_cap) * 100 : 0;
  volume_indicators.push({ name: 'Vol/Mcap', value: volRatio, action: volRatio > 5 ? 'buy' : 'neutral', detail: `${volRatio.toFixed(2)}% — ${volRatio > 5 ? 'High' : 'Normal'} turnover` });
  volume_indicators.push({ name: 'Volume', value: cg?.total_volume || 0, action: 'neutral', detail: `$${((cg?.total_volume || 0) / 1e6).toFixed(1)}M 24h` });
  volRatio > 5 ? buy++ : neutral++;
  neutral++;

  // Decision
  const total = buy + sell + neutral;
  const buyRatio = total > 0 ? (buy / total) * 100 : 50;
  const sellRatio = total > 0 ? (sell / total) * 100 : 50;

  let action = 'neutral', action_display = '🟡 NEUTRAL', summary = 'No clear signal';
  if (buyRatio > 65) { action = 'strong_buy'; action_display = '🟢 STRONG BUY'; summary = 'Strong bullish consensus — multiple indicators aligned'; }
  else if (buyRatio > 55) { action = 'buy'; action_display = '🟢 BUY'; summary = 'Bullish bias — more buy signals than sell'; }
  else if (sellRatio > 65) { action = 'strong_sell'; action_display = '🔴 STRONG SELL'; summary = 'Strong bearish consensus — multiple indicators aligned'; }
  else if (sellRatio > 55) { action = 'sell'; action_display = '🔴 SELL'; summary = 'Bearish bias — more sell signals than buy'; }
  else { summary = 'Mixed signals — market indecision'; }

  return {
    indicators: { trend, momentum, volatility, volume_indicators },
    overall_decision: { action, action_display, buy_signals: buy, sell_signals: sell, neutral_signals: neutral, buy_ratio: buyRatio, sell_ratio: sellRatio, summary },
    signal_score: buyRatio,
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const timeframe = searchParams.get('timeframe') || '1d';
  const t0 = Date.now();

  try {
    // Check cache
    if (cache && Date.now() - cache.timestamp < CACHE_TTL) {
      return NextResponse.json({ ...cache.data, fetch_duration_ms: Date.now() - t0, cached: true });
    }

    // Fetch all sources in parallel
    const [variational, coinGecko] = await Promise.all([
      fetchVariational(),
      fetchCoinGecko(timeframe),
    ]);

    if (!variational && !coinGecko) {
      throw new Error('All data sources failed');
    }

    const price = variational?.price || 0;
    const cg = coinGecko;

    // Calculate indicators from history
    const priceValues = cg?.prices?.map((p: [number, number]) => p[1]) || [];
    const ema20Arr = calculateEMA(priceValues, 20);
    const ema50Arr = calculateEMA(priceValues, 50);
    const ema200Arr = calculateEMA(priceValues, 200);
    const rsiArr = calculateRSI(priceValues, 14);

    const ema20 = ema20Arr.length ? ema20Arr[ema20Arr.length - 1] : 0;
    const ema50 = ema50Arr.length ? ema50Arr[ema50Arr.length - 1] : 0;
    const ema200 = ema200Arr.length ? ema200Arr[ema200Arr.length - 1] : 0;
    const rsi = rsiArr.length ? rsiArr[rsiArr.length - 1] : 50;

    const analysis = buildAnalysis(ema20, ema50, ema200, rsi, price, cg);

    // Build history arrays for chart
    const offsetEma20 = priceValues.length - ema20Arr.length;
    const offsetEma50 = priceValues.length - ema50Arr.length;
    const offsetEma200 = priceValues.length - ema200Arr.length;
    const offsetRsi = priceValues.length - rsiArr.length;

    const ema20History = cg?.prices?.slice(offsetEma20).map((p: [number, number], i: number) => [p[0], ema20Arr[i]]) || [];
    const ema50History = cg?.prices?.slice(offsetEma50).map((p: [number, number], i: number) => [p[0], ema50Arr[i]]) || [];
    const ema200History = cg?.prices?.slice(offsetEma200).map((p: [number, number], i: number) => [p[0], ema200Arr[i]]) || [];
    const rsiHistory = cg?.prices?.slice(offsetRsi).map((p: [number, number], i: number) => [p[0], rsiArr[i]]) || [];

    // Derivatives from Variational
    const derivatives = variational?.open_interest ? {
      open_interest: {
        current_oi: variational.open_interest.total,
        oi_change_1d: 0,
        oi_change_4h: 0,
        oi_percentile_7d: 0,
        oi_mcap_ratio: (cg?.market_cap ?? 0) > 0 ? (variational.open_interest.total / cg.market_cap) : 0,
      },
      funding_rate: {
        current_rate_pct: variational.funding_rate_pct || 0,
        annualized_cost_pct: ((variational.funding_rate_pct || 0) * 3 * 365),
        direction: (variational.funding_rate || 0) > 0 ? 'longs_pay' : 'shorts_pay',
      },
      liquidations: {
        imbalance_ratio: variational.open_interest.short > 0
          ? (variational.open_interest.long - variational.open_interest.short) / variational.open_interest.total
          : 0,
        short_liq_points: [],
        long_liq_points: [],
      }
    } : null;

    const response: any = {
      price,
      price_change: cg?.price_change || { '24h': '0', '7d': '0', '30d': '0' },
      market_cap: cg?.market_cap || 0,
      market_cap_rank: cg?.market_cap_rank || 0,
      total_volume: cg?.total_volume || variational?.volume_24h || 0,
      high_24h: cg?.high_24h || 0,
      low_24h: cg?.low_24h || 0,
      circulating_supply: cg?.circulating_supply || 0,
      total_supply: cg?.total_supply || 0,
      ath: cg?.ath || 0,
      bid: variational?.bid || 0,
      ask: variational?.ask || 0,
      spread: variational?.spread || 0,
      spread_bps: variational?.spread_bps || 0,
      funding_rate: variational?.funding_rate || 0,
      funding_interval_h: 8,
      open_interest: variational?.open_interest || null,
      derivatives,
      ema20, ema50, ema200, rsi,
      obv: 0,
      history: {
        prices: cg?.prices || [],
      },
      ema20History,
      ema50History,
      ema200History,
      rsiHistory,
      ...analysis,
      support_resistance: { channels: [] },
      timeframe,
      last_updated: new Date().toISOString(),
      variational_updated_at: variational?.updated_at || null,
      source: 'Variational Omni + CoinGecko',
      fetch_duration_ms: Date.now() - t0,
      errors: [] as string[],
    };

    if (!variational) response.errors.push('Variational unavailable');
    if (!cg) response.errors.push('CoinGecko unavailable');

    cache = { data: response, timestamp: Date.now() };
    return NextResponse.json(response);

  } catch (error: any) {
    console.error('API error:', error.message);
    return NextResponse.json(
      { error: 'Failed to fetch HYPE data', details: error.message },
      { status: 500 }
    );
  }
}
