'use client';

import { useMarketData } from '../hooks/useMarketData';
import { Header } from '../components/layout/Header';
import { SignalBanner } from '../components/sections/SignalBanner';
import { MetricsRow, DerivativesRow, IndicatorsPanel } from '../components/sections/content';
import TradingViewChart from '../components/chart/TradingViewChart';
import { Button } from '../components/ui';
import { fmtPct, isStale } from '../lib/format';
import type { Timeframe } from '../types';
import { TIMEFRAME_CONFIG } from '../types';

const TFS: Timeframe[] = ['1h', '4h', '1d'];

export default function Home() {
  const { data, loading, error, tf, tfLoading, fetchCount, changeTimeframe, refetch } = useMarketData('4h');

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex flex-col items-center justify-center gap-4">
        <div className="w-10 h-10 rounded-full border-2 border-[var(--border-secondary)] border-t-cyan-500 animate-spin" />
        <p className="text-[var(--text-muted)] text-sm">Loading market data...</p>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex flex-col items-center justify-center gap-4 p-6">
        <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-2xl">⚠</div>
        <p className="text-red-400 font-semibold">Connection Error</p>
        <p className="text-[var(--text-muted)] text-sm">{error}</p>
        <button onClick={() => refetch()} className="mt-2 px-5 py-2 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] text-sm font-medium">
          Retry
        </button>
      </div>
    );
  }

  if (!data) return null;

  const stale = isStale(data.lastUpdated);

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] antialiased">
      <Header
        price={data.price}
        change24h={data.change24h}
        lastUpdated={data.lastUpdated}
        isStale={stale}
        onRefresh={() => refetch()}
      />

      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 py-5 space-y-4">
        <SignalBanner data={data} />
        <MetricsRow data={data} />
        <DerivativesRow data={data} />

        {/* Timeframes */}
        <div className="flex items-center gap-1.5">
          {TFS.map(t => (
            <Button key={t} active={tf === t} onClick={() => changeTimeframe(t)}>
              {TIMEFRAME_CONFIG[t].label}
              {tfLoading && tf === t && (
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-cyan-500 rounded-full animate-pulse" />
              )}
            </Button>
          ))}
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-4">
            {/* Chart */}
            <div className="bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-2xl overflow-hidden">
              <div className="px-4 py-3 border-b border-[var(--border-primary)] flex items-center justify-between">
                <h3 className="text-xs font-bold text-[var(--text-secondary)]">HYPE/USDT · TradingView</h3>
                <div className="flex gap-3 text-[9px] text-[var(--text-muted)]">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-emerald-500" /> Bull</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-red-500" /> Bear</span>
                </div>
              </div>
              <TradingViewChart timeframe={tf} />
            </div>

            {/* Performance */}
            <div className="grid grid-cols-3 gap-2">
              {(['24h', '7d', '30d'] as const).map(period => {
                const val = period === '24h' ? data.change24h : period === '7d' ? data.change7d : data.change30d;
                return (
                  <div key={period} className="bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-xl px-4 py-3">
                    <div className="text-[9px] text-[var(--text-muted)] uppercase tracking-wider font-semibold">{period}</div>
                    <div className={`text-base font-black font-mono mt-1 ${val >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {fmtPct(val)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Sidebar */}
          <aside className="space-y-4">
            <IndicatorsPanel data={data} />
            <div className="text-[9px] text-[var(--text-muted)] space-y-0.5 pt-2 px-1">
              <div>Hyperliquid · {fetchCount} fetches</div>
              <div>Updated {new Date(data.lastUpdated).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</div>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
