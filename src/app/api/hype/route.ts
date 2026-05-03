// @ts-nocheck
import { NextResponse } from 'next/server';

const CACHE_TTL = 30_000;
let cache: { data: any; timestamp: number } | null = null;

// ─── Calculate EMA ───
function calcEMA(prices, period) {
  if (prices.length < period) return [];
  const k = 2 / (period + 1);
  const ema = [prices.slice(0, period).reduce((a, b) => a + b, 0) / period];
  for (let i = period; i < prices.length; i++) {
    ema.push(prices[i] * k + ema[ema.length - 1] * (1 - k));
  }
  return ema;
}

// ─── Calculate RSI ───
function calcRSI(prices, period = 14) {
  if (prices.length < period + 1) return [];
  const changes = prices.slice(1).map((p, i) => p - prices[i]);
  let avgGain = changes.slice(0, period).filter(c => c > 0).reduce((a, b) => a + b, 0) / period;
  let avgLoss = changes.slice(0, period).filter(c => c < 0).reduce((a, b) => a + Math.abs(b), 0) / period;
  const rsi = [];
  for (let i = period; i < changes.length; i++) {
    avgGain = (avgGain * (period - 1) + Math.max(changes[i], 0)) / period;
    avgLoss = (avgLoss * (period - 1) + Math.max(-changes[i], 0)) / period;
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    rsi.push(100 - 100 / (1 + rs));
  }
  return rsi;
}

// ─── Fetch liquidations from TrueNorth via PM2 backend ───
async function fetchLiquidations() {
  try {
    // Try the PM2 backend which has TrueNorth access
    const res = await fetch('https://mayor-titled-mathematics-choices.trycloudflare.com/api/liquidations', {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const timeframe = searchParams.get('timeframe') || '1d';
  const t0 = Date.now();

  try {
    if (cache && Date.now() - cache.timestamp < CACHE_TTL) {
      // Still try to get fresh liquidations even from cache
      const liq = await fetchLiquidations();
      const data = { ...cache.data, fetch_duration_ms: Date.now() - t0, cached: true };
      if (liq) data.liquidations = liq;
      return NextResponse.json(data);
    }

    // ─── Fetch CoinGecko + Liquidations in parallel ───
    const days = timeframe === '1h' ? '7' : timeframe === '4h' ? '30' : '365';
    const [mcRes, histRes, liqData] = await Promise.all([
      fetch('https://api.coingecko.com/api/v3/coins/hyperliquid?localization=false&tickers=false&community_data=false&developer_data=false', { signal: AbortSignal.timeout(10000) }),
      fetch(`https://api.coingecko.com/api/v3/coins/hyperliquid/market_chart?vs_currency=usd&days=${days}&interval=${days === '365' ? 'daily' : 'hourly'}`, { signal: AbortSignal.timeout(10000) }),
      fetchLiquidations(),
    ]);

    if (!mcRes.ok) throw new Error(`CoinGecko HTTP ${mcRes.status}`);
    const mcData = await mcRes.json();
    const histData = histRes.ok ? await histRes.json() : null;

    const price = mcData.market_data?.current_price?.usd || 0;
    const priceValues = histData?.prices?.map(p => p[1]) || [];
    const tsValues = histData?.prices?.map(p => p[0]) || [];

    // Calculate indicators
    const ema20 = calcEMA(priceValues, 20);
    const ema50 = calcEMA(priceValues, 50);
    const ema200 = calcEMA(priceValues, 200);
    const rsiArr = calcRSI(priceValues, 14);

    const ema20Val = ema20.length ? ema20[ema20.length - 1] : null;
    const ema50Val = ema50.length ? ema50[ema50.length - 1] : null;
    const ema200Val = ema200.length ? ema200[ema200.length - 1] : null;
    const rsiVal = rsiArr.length ? rsiArr[rsiArr.length - 1] : null;

    const offset20 = tsValues.length - ema20.length;
    const offset50 = tsValues.length - ema50.length;
    const offset200 = tsValues.length - ema200.length;
    const offsetRsi = tsValues.length - rsiArr.length;

    const errors: string[] = [];

    // Check for CoinGecko rate limit
    if (mcData.error) errors.push('CoinGecko rate limited');

    const response: any = {
      price,
      price_change: {
        '24h': mcData.market_data?.price_change_percentage_24h?.toFixed(2) || '0',
        '7d': mcData.market_data?.price_change_percentage_7d?.toFixed(2) || '0',
        '30d': mcData.market_data?.price_change_percentage_30d?.toFixed(2) || '0',
      },
      market_cap: mcData.market_data?.market_cap?.usd || 0,
      market_cap_rank: mcData.market_cap_rank || 0,
      total_volume: mcData.market_data?.total_volume?.usd || 0,
      high_24h: mcData.market_data?.high_24h?.usd || 0,
      low_24h: mcData.market_data?.low_24h?.usd || 0,
      circulating_supply: mcData.market_data?.circulating_supply || 0,
      total_supply: mcData.market_data?.total_supply || 0,
      ath: mcData.market_data?.ath?.usd || 0,
      ema20: ema20Val, ema50: ema50Val, ema200: ema200Val, rsi: rsiVal,
      history: { prices: histData?.prices || [] },
      ema20History: tsValues.slice(offset20).map((t, i) => [t, ema20[i]]),
      ema50History: tsValues.slice(offset50).map((t, i) => [t, ema50[i]]),
      ema200History: tsValues.slice(offset200).map((t, i) => [t, ema200[i]]),
      rsiHistory: tsValues.slice(offsetRsi).map((t, i) => [t, rsiArr[i]]),
      timeframe,
      last_updated: new Date().toISOString(),
      source: 'CoinGecko',
      fetch_duration_ms: Date.now() - t0,
      errors,
    };

    // Add liquidations if available
    if (liqData) {
      response.liquidations = liqData;
    }

    cache = { data: response, timestamp: Date.now() };
    return NextResponse.json(response);

  } catch (error: any) {
    console.error('API error:', error.message);
    if (cache) {
      return NextResponse.json({ ...cache.data, fetch_duration_ms: Date.now() - t0, stale: true });
    }
    return NextResponse.json(
      { error: 'Failed to fetch data', details: error.message },
      { status: 500 }
    );
  }
}
