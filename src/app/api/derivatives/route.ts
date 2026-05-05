// @ts-nocheck
import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const TN_PATH = '/root/.hermes/node/bin/tn';
const CACHE_TTL = 60_000; // 60s

let cache: { data: any; timestamp: number } | null = null;

export async function GET() {
  // Check cache
  if (cache && Date.now() - cache.timestamp < CACHE_TTL) {
    return NextResponse.json({ ...cache.data, cached: true });
  }

  try {
    // Call TrueNorth CLI for derivatives data
    const { stdout, stderr } = await execAsync(`${TN_PATH} deriv hyperliquid --json`, {
      timeout: 15000,
    });

    const raw = JSON.parse(stdout);
    const result = raw?.result?.derivative_data?.HYPE;

    if (!result) {
      throw new Error('No HYPE derivatives data in TrueNorth response');
    }

    const liq = result['Binance/Bybit/OKX aggreated liquidation map'] || {};
    const imbalance = liq.imbalance || {};
    const oi = result['Aggregated open interest'] || {};
    const funding = result['1h Aggregated OI weighted funding rate'] || {};

    const response = {
      // Long/Short ratio from liquidation imbalance
      longShortRatio: {
        ratio: imbalance.imbalance_ratio || 0, // negative = short bias, positive = long bias
        longTotalUsd: imbalance.long_total_usd || 0,
        shortTotalUsd: imbalance.short_total_usd || 0,
        imbalanceUsd: imbalance.imbalance_usd || 0,
        interpretation: imbalance.interpretation || 'neutral',
      },
      // Liquidation levels
      liquidations: {
        shortLevels: (liq.max_short_liquidation_point || []).slice(0, 5).map((l: any) => ({
          price: l.price,
          valueUsd: l.liq_usd,
          distancePct: l.distance_pct,
        })),
        longLevels: (liq.max_long_liquidation_point || []).slice(0, 5).map((l: any) => ({
          price: l.price,
          valueUsd: l.liq_usd,
          distancePct: l.distance_pct,
        })),
      },
      // Open interest
      openInterest: {
        current: oi.current_open_interest || 0,
        oiMcapRatio: oi.oi_mcap_ratio_analysis?.oi_mcap_ratio_pct || 0,
        percentile7d: oi.percentile_analysis?.current_oi_percentile_7d || 0,
        change1h: oi.rolling_changes?.oi_change_1h_abs || 0,
        change4h: oi.rolling_changes?.oi_change_4h_abs || 0,
        change1d: oi.rolling_changes?.oi_change_1d_abs || 0,
      },
      // Funding
      funding: {
        current1h: funding.current_funding_rate_in_percentage || 0,
        annualized: funding.annualized_funding_cost_est_in_percentage || 0,
        percentile7d: funding.current_funding_percentile_7d || 0,
      },
      lastUpdated: Date.now(),
    };

    cache = { data: response, timestamp: Date.now() };
    return NextResponse.json(response);
  } catch (error: any) {
    console.error('TrueNorth API error:', error.message);
    // Return stale cache if available
    if (cache) {
      return NextResponse.json({ ...cache.data, stale: true });
    }
    return NextResponse.json(
      { error: 'Failed to fetch TrueNorth data', details: error.message },
      { status: 500 }
    );
  }
}
