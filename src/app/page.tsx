'use client';

import { useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
import { useMarketData } from '../hooks/useMarketData';
import TradingViewChart from '../components/chart/TradingViewChart';
import { fmtPct, isStale } from '../lib/format';
import type { Timeframe } from '../types';
import { TIMEFRAME_CONFIG } from '../types';

const TFS: Timeframe[] = ['1h', '4h', '1d'];

/* ═══════════════════════════════════════════
   TOOLTIP — inline, works everywhere
   ═══════════════════════════════════════════ */
function Tip({ content, children }: { content: string; children: ReactNode }) {
  const [show, setShow] = useState(false);
  return (
    <span className="relative inline-flex items-center" onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
      {children}
      {show && (
        <span className="absolute z-[100] px-3 py-2 text-[11px] leading-snug text-[var(--text-primary)] bg-[var(--bg-surface)] border border-[var(--border-secondary)] rounded-lg shadow-xl whitespace-normal max-w-[220px] bottom-full mb-2 left-1/2 -translate-x-1/2 pointer-events-none">
          {content}
        </span>
      )}
    </span>
  );
}

function Info({ tip }: { tip: string }) {
  return (
    <Tip content={tip}>
      <span className="inline-flex items-center justify-center w-4 h-4 ml-1.5 text-[9px] font-bold text-[var(--accent)] border border-[var(--accent-border)] rounded-full cursor-help hover:bg-[var(--accent-bg)] transition-colors">?</span>
    </Tip>
  );
}

/* ═══════════════════════════════════════════
   SIGNAL GAUGE — modern & dynamic
   ═══════════════════════════════════════════ */
function SignalGauge({ data }: { data: NonNullable<ReturnType<typeof useMarketData>['data']> }) {
  const sig = data.signal;
  const isBullish = sig.action === 'strong_buy' || sig.action === 'buy';
  const isBearish = sig.action === 'strong_sell' || sig.action === 'sell';
  const isNeutral = sig.action === 'neutral';
  const isStale = (Date.now() - data.lastUpdated) > 120_000;

  const mainColor = isBullish ? 'var(--up-color)' : isBearish ? 'var(--down-color)' : 'var(--neutral-color)';
  const bgColor = isBullish ? 'var(--up-bg)' : isBearish ? 'var(--down-bg)' : 'var(--neutral-bg)';
  const borderColor = isBullish ? 'var(--up-border)' : isBearish ? 'var(--down-border)' : 'var(--neutral-border)';
  const gaugeColor = isBullish ? '#4ADE80' : isBearish ? '#F85149' : '#6B7280';
  const icon = isBullish ? '▲' : isBearish ? '▼' : '—';

  // Animated score mapping: 0-100 → visual
  const buyPct = Math.round((sig.buy / (sig.buy + sig.sell + sig.neutral)) * 100);

  return (
    <div className={`rounded-xl border-2 p-5 transition-all ${isStale ? 'opacity-50' : ''}`} style={{ borderColor: bgColor === 'var(--up-bg)' ? '#22C55E40' : bgColor === 'var(--down-bg)' ? '#F8514940' : '#4B556340', background: bgColor === 'var(--up-bg)' ? '#4ADE8008' : bgColor === 'var(--down-bg)' ? '#F8514908' : '#4B556308' }}>
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-5">
        {/* Left: Icon + Signal */}
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl flex flex-col items-center justify-center" style={{ background: `${mainColor}15`, border: `2px solid ${mainColor}40` }}>
            <span className="text-2xl font-black" style={{ color: mainColor }}>{icon}</span>
          </div>
          <div>
            <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-[0.15em] font-semibold mb-1">
              Trading Signal · {data.timeframe.toUpperCase()} · Hyperliquid
            </div>
            <div className="text-3xl font-black tracking-tight" style={{ color: mainColor }}>{sig.display}</div>
            <div className="text-sm text-[var(--text-secondary)] mt-0.5">{sig.summary}</div>
          </div>
        </div>

        {/* Right: Score gauge + breakdown */}
        <div className="flex items-center gap-6 w-full lg:w-auto">
          {/* Gauge */}
          <div className="flex-1 lg:w-48">
            <div className="flex justify-between text-[10px] text-[var(--text-muted)] mb-1.5 font-bold">
              <span className="text-[var(--down-color)]">SELL</span>
              <span className="font-mono font-black text-base" style={{ color: mainColor }}>{sig.score}</span>
              <span className="text-[var(--up-color)]">BUY</span>
            </div>
            <div className="w-full h-2.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-elevated)' }}>
              <div className="h-full rounded-full transition-all duration-700" style={{ width: `${sig.score}%`, background: gaugeColor }} />
            </div>
            <div className="flex justify-between text-[8px] text-[var(--text-muted)] mt-1">
              <span>← Bearish</span>
              <span>Bullish →</span>
            </div>
          </div>

          {/* Breakdown */}
          <div className="flex gap-4 text-center">
            <div>
              <div className="text-xl font-black text-[var(--up-color)]">{sig.buy}</div>
              <div className="text-[8px] text-[var(--text-muted)] uppercase tracking-wider font-bold">Buy</div>
            </div>
            <div>
              <div className="text-xl font-black text-[var(--neutral-color)]">{sig.neutral}</div>
              <div className="text-[8px] text-[var(--text-muted)] uppercase tracking-wider font-bold">Neut</div>
            </div>
            <div>
              <div className="text-xl font-black text-[var(--down-color)]">{sig.sell}</div>
              <div className="text-[8px] text-[var(--text-muted)] uppercase tracking-wider font-bold">Sell</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════════ */
export default function Home() {
  const { data, loading, error, tf, tfLoading, fetchCount, changeTimeframe, refetch } = useMarketData('4h');
  const [now, setNow] = useState(Date.now());

  // Update "last updated" display every second
  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(i);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4" style={{ background: 'var(--bg-primary)' }}>
        <div className="w-10 h-10 rounded-full border-2 border-[var(--border-secondary)] animate-spin" style={{ borderTopColor: 'var(--accent)' }} />
        <p className="text-[var(--text-muted)] text-sm">Loading market data...</p>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6" style={{ background: 'var(--bg-primary)' }}>
        <div className="text-3xl">⚠️</div>
        <p className="text-[var(--down-color)] font-semibold">Connection Error</p>
        <p className="text-[var(--text-muted)] text-sm">{error}</p>
        <button onClick={() => refetch()} className="mt-2 px-5 py-2.5 rounded-lg text-sm font-medium border transition" style={{ background: 'var(--accent-bg)', borderColor: 'var(--accent-border)', color: 'var(--accent)' }}>
          Retry
        </button>
      </div>
    );
  }

  if (!data) return null;

  const stale = isStale(data.lastUpdated);
  const ind = data.indicators;
  const rsiZone = ind.rsi14 > 70 ? 'Overbought' : ind.rsi14 < 30 ? 'Oversold' : ind.rsi14 > 50 ? 'Bullish zone' : 'Bearish zone';
  const rsiColor = ind.rsi14 > 70 ? 'var(--down-color)' : ind.rsi14 < 30 ? 'var(--up-color)' : 'var(--text-secondary)';
  const timeSinceUpdate = Math.floor((now - data.lastUpdated) / 1000);

  return (
    <div className="min-h-screen text-[var(--text-primary)] antialiased" style={{ background: 'var(--bg-primary)' }}>

      {/* ═══ HEADER ═══ */}
      <header className="sticky top-0 z-50 backdrop-blur-sm border-b" style={{ background: 'var(--bg-primary)/95', borderColor: 'var(--border-primary)' }}>
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--text-inverse)] text-xs font-black" style={{ background: 'var(--accent)' }}>H</div>
            <div>
              <span className="text-sm font-bold text-[var(--text-primary)]">HYPE</span>
              <span className="text-sm text-[var(--text-muted)] font-normal ml-1">Monitor</span>
            </div>
            <span className="text-[10px] px-2.5 py-0.5 rounded-full font-bold border" style={stale ? { background: 'var(--down-bg)', color: 'var(--down-color)', borderColor: 'var(--down-border)' } : { background: 'var(--up-bg)', color: 'var(--up-color)', borderColor: 'var(--up-border)' }}>
              {stale ? `Stale ${timeSinceUpdate}s` : '● Live'}
            </span>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-xl font-bold font-mono text-[var(--text-primary)]">${data.price.toFixed(2)}</div>
              <div className={`text-xs font-bold ${data.change24h >= 0 ? 'text-[var(--up-color)]' : 'text-[var(--down-color)]'}`}>
                {data.change24h >= 0 ? '+' : ''}{data.change24h.toFixed(2)}% <span className="text-[var(--text-muted)]">24h</span>
              </div>
            </div>
            <button onClick={() => refetch()} className="w-8 h-8 rounded-lg flex items-center justify-center border transition hover:opacity-80" style={{ background: 'var(--bg-tertiary)', borderColor: 'var(--border-primary)' }}>
              <svg className="w-4 h-4 text-[var(--text-secondary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-[1440px] mx-auto px-4 sm:px-6 py-5 space-y-4">

        {/* ═══ SIGNAL GAUGE ═══ */}
        <SignalGauge data={data} />

        {/* ═══ METRICS ROW 1 ═══ */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
          {([
            { label: 'Market Cap', value: data.marketCap > 0 ? `$${(data.marketCap / 1e9).toFixed(2)}B` : '—', tip: 'Total market value of all HYPE tokens in circulation' },
            { label: 'Volume 24h', value: `$${(data.volume24h / 1e6).toFixed(1)}M`, tip: 'Total trading volume across all exchanges in the last 24 hours' },
            { label: 'High 24h', value: `$${data.high24h.toFixed(2)}`, tip: 'Highest price reached in the last 24 hours' },
            { label: 'Low 24h', value: `$${data.low24h.toFixed(2)}`, tip: 'Lowest price reached in the last 24 hours' },
            { label: 'Open Interest', value: `$${(data.oiUsd / 1e6).toFixed(1)}M`, sub: `${(data.oiTokens / 1e6).toFixed(1)}M HYPE`, tip: 'Total value of all open perpetual futures contracts on Hyperliquid' },
            { label: 'Funding 8h', value: `${data.funding8h >= 0 ? '+' : ''}${data.funding8h.toFixed(4)}%`, sub: `Ann. ${data.fundingAnn.toFixed(1)}%`, color: data.funding8h > 0 ? 'var(--up-color)' : 'var(--down-color)', tip: 'Funding rate paid every 8h between longs and shorts. Positive = longs pay shorts' },
            { label: 'RSI 14', value: ind.rsi14.toFixed(1), sub: rsiZone, color: rsiColor, tip: 'Relative Strength Index (14 periods). >70 = overbought, <30 = oversold. Measures momentum strength' },
          ] as { label: string; value: string; sub?: string; color?: string; tip: string }[]).map(m => (
            <div key={m.label} className="rounded-xl px-3 py-3 border" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-primary)' }}>
              <div className="flex items-center text-[9px] text-[var(--text-muted)] uppercase tracking-wider font-bold">
                {m.label}
                <Info tip={m.tip} />
              </div>
              <div className={`text-sm font-bold font-mono mt-1 ${m.color || ''}`}>{m.value}</div>
              {m.sub && <div className="text-[9px] text-[var(--text-muted)] mt-0.5">{m.sub}</div>}
            </div>
          ))}
        </div>

        {/* ═══ DERIVATIVES + SMA ═══ */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div className="rounded-xl px-3 py-3 border" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-primary)' }}>
            <div className="flex items-center text-[9px] text-[var(--text-muted)] uppercase tracking-wider font-bold">
              Long Liquidations
              <Info tip="Estimated value of long positions that would be liquidated at this price zone" />
            </div>
            <div className="text-sm font-bold font-mono mt-1" style={{ color: 'var(--up-color)' }}>
              {data.liqZones[0] ? `$${(data.liqZones[0].valueUsd / 1e6).toFixed(1)}M` : '—'}
            </div>
            <div className="text-[9px] text-[var(--text-muted)] mt-0.5">
              {data.liqZones[0] ? `$${data.liqZones[0].priceLow.toFixed(2)} – $${data.liqZones[0].priceHigh.toFixed(2)}` : ''}
            </div>
          </div>
          <div className="rounded-xl px-3 py-3 border" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-primary)' }}>
            <div className="flex items-center text-[9px] text-[var(--text-muted)] uppercase tracking-wider font-bold">
              Short Liquidations
              <Info tip="Estimated value of short positions that would be liquidated at this price zone" />
            </div>
            <div className="text-sm font-bold font-mono mt-1" style={{ color: '#60A5FA' }}>
              {data.liqZones[1] ? `$${(data.liqZones[1].valueUsd / 1e6).toFixed(1)}M` : '—'}
            </div>
            <div className="text-[9px] text-[var(--text-muted)] mt-0.5">
              {data.liqZones[1] ? `$${data.liqZones[1].priceLow.toFixed(2)} – $${data.liqZones[1].priceHigh.toFixed(2)}` : ''}
            </div>
          </div>
          <div className="rounded-xl px-3 py-3 border" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-primary)' }}>
            <div className="flex items-center text-[9px] text-[var(--text-muted)] uppercase tracking-wider font-bold">
              SMA 10
              <Info tip="Simple Moving Average over 10 periods. Short-term trend direction. Price above = bullish" />
            </div>
            <div className="text-sm font-bold font-mono mt-1" style={{ color: '#F9A8D4' }}>${ind.sma10.toFixed(2)}</div>
            <div className={`text-[9px] mt-0.5 font-bold ${data.price > ind.sma10 ? 'text-[var(--up-color)]' : 'text-[var(--down-color)]'}`}>
              {data.price > ind.sma10 ? '▲ Price Above' : '▼ Price Below'}
            </div>
          </div>
          <div className="rounded-xl px-3 py-3 border" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-primary)' }}>
            <div className="flex items-center text-[9px] text-[var(--text-muted)] uppercase tracking-wider font-bold">
              SMA 50
              <Info tip="Simple Moving Average over 50 periods. Medium-term trend direction. Price above = bullish" />
            </div>
            <div className="text-sm font-bold font-mono mt-1" style={{ color: '#60A5FA' }}>${ind.sma50.toFixed(2)}</div>
            <div className={`text-[9px] mt-0.5 font-bold ${data.price > ind.sma50 ? 'text-[var(--up-color)]' : 'text-[var(--down-color)]'}`}>
              {data.price > ind.sma50 ? '▲ Price Above' : '▼ Price Below'}
            </div>
          </div>
        </div>

        {/* ═══ TIMEFRAMES ═══ */}
        <div className="flex items-center gap-2">
          {TFS.map(t => (
            <button key={t} onClick={() => changeTimeframe(t)}
              className="relative px-5 py-2.5 rounded-lg text-xs font-bold border transition"
              style={tf === t
                ? { background: 'var(--accent-bg)', borderColor: 'var(--accent-border)', color: 'var(--accent)' }
                : { background: 'var(--bg-tertiary)', borderColor: 'var(--border-primary)', color: 'var(--text-secondary)' }
              }>
              {TIMEFRAME_CONFIG[t].label}
              {tfLoading && tf === t && <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full animate-pulse" style={{ background: 'var(--accent)' }} />}
            </button>
          ))}
        </div>

        {/* ═══ MAIN GRID ═══ */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-4">
            {/* Chart */}
            <div className="rounded-xl overflow-hidden border" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-primary)' }}>
              <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: 'var(--border-primary)' }}>
                <h3 className="text-xs font-bold text-[var(--text-secondary)]">HYPE/USDT · TradingView</h3>
                <div className="flex gap-3 text-[10px] text-[var(--text-muted)] font-bold">
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: 'var(--up-color)' }} /> Bullish</span>
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: 'var(--down-color)' }} /> Bearish</span>
                </div>
              </div>
              <TradingViewChart timeframe={tf} />
            </div>

            {/* Performance */}
            <div className="grid grid-cols-3 gap-2">
              {(['24h', '7d', '30d'] as const).map(period => {
                const val = period === '24h' ? data.change24h : period === '7d' ? data.change7d : data.change30d;
                return (
                  <div key={period} className="rounded-xl px-4 py-3 border" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-primary)' }}>
                    <div className="text-[9px] text-[var(--text-muted)] uppercase tracking-wider font-bold">{period}</div>
                    <div className={`text-base font-black font-mono mt-1 ${val >= 0 ? 'text-[var(--up-color)]' : 'text-[var(--down-color)]'}`}>
                      {fmtPct(val)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ═══ SIDEBAR ═══ */}
          <aside className="space-y-4">
            {/* Technical Indicators */}
            <div className="rounded-xl overflow-hidden border" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-primary)' }}>
              <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--border-primary)' }}>
                <h3 className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-[0.12em]">
                  Technical Indicators · {data.timeframe.toUpperCase()}
                </h3>
              </div>
              <div className="p-4">
                {([
                  { label: 'SMA 10', value: `$${ind.sma10.toFixed(2)}`, color: data.price > ind.sma10 ? 'var(--up-color)' : 'var(--down-color)', sub: data.price > ind.sma10 ? 'Above' : 'Below', tip: 'Simple Moving Average over 10 periods. Short-term trend' },
                  { label: 'SMA 20', value: `$${ind.sma20.toFixed(2)}`, color: data.price > ind.sma20 ? 'var(--up-color)' : 'var(--down-color)', sub: data.price > ind.sma20 ? 'Above' : 'Below', tip: 'Simple Moving Average over 20 periods. Medium-short trend' },
                  { label: 'SMA 50', value: `$${ind.sma50.toFixed(2)}`, color: data.price > ind.sma50 ? 'var(--up-color)' : 'var(--down-color)', sub: data.price > ind.sma50 ? 'Above' : 'Below', tip: 'Simple Moving Average over 50 periods. Medium-term trend' },
                  { label: 'RSI 14', value: ind.rsi14.toFixed(1), color: rsiColor, sub: rsiZone, tip: 'Relative Strength Index. >70 overbought, <30 oversold' },
                  { label: 'MACD', value: ind.macd.toFixed(4), color: ind.macdHist > 0 ? 'var(--up-color)' : 'var(--down-color)', sub: `Sig: ${ind.macdSignal.toFixed(3)}`, tip: 'Moving Average Convergence Divergence. Signal crossover = trend change' },
                  { label: 'Stoch K', value: ind.stochK.toFixed(1), color: ind.stochK > 80 ? 'var(--down-color)' : ind.stochK < 20 ? 'var(--up-color)' : 'var(--text-secondary)', sub: `D: ${ind.stochD.toFixed(1)}`, tip: 'Stochastic Oscillator. >80 overbought, <20 oversold' },
                  { label: 'KDJ J', value: ind.kdjJ.toFixed(1), color: ind.kdjJ > 80 ? 'var(--down-color)' : ind.kdjJ < 20 ? 'var(--up-color)' : 'var(--text-secondary)', sub: `K: ${ind.kdjK.toFixed(1)}`, tip: 'KDJ Momentum indicator. J-line shows divergence' },
                  { label: 'CCI', value: ind.cci.toFixed(1), color: ind.cci > 100 ? 'var(--down-color)' : ind.cci < -100 ? 'var(--up-color)' : 'var(--text-secondary)', sub: ind.cci > 100 ? 'Overbought' : ind.cci < -100 ? 'Oversold' : 'Neutral', tip: 'Commodity Channel Index. >+100 overbought, <-100 oversold' },
                  { label: 'ADX', value: ind.adx.toFixed(1), color: ind.adx > 25 ? 'var(--warning)' : 'var(--text-muted)', sub: ind.adx > 25 ? 'Trending' : 'Ranging', tip: 'Average Directional Index. >25 = strong trend, <25 = ranging' },
                  { label: 'BB %B', value: ind.bbPercentB.toFixed(3), color: ind.bbPercentB > 1 ? 'var(--down-color)' : ind.bbPercentB < 0 ? 'var(--up-color)' : 'var(--text-secondary)', sub: '', tip: 'Bollinger Bands %B. >1 above upper band, <0 below lower band' },
                ] as const).map((r, i) => (
                  <div key={r.label} className={`flex justify-between items-center py-2.5 ${i < 9 ? 'border-b' : ''}`} style={{ borderColor: 'var(--border-primary)' }}>
                    <div className="flex items-center text-[11px] text-[var(--text-secondary)] font-medium">
                      {r.label}
                      <Info tip={r.tip} />
                    </div>
                    <div className="text-right">
                      <span className={`text-[12px] font-mono font-bold ${r.color}`}>{r.value}</span>
                      {r.sub && <span className="text-[9px] text-[var(--text-muted)] ml-2">{r.sub}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* RSI Gauge */}
            <div className="rounded-xl p-4 border" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-primary)' }}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-[0.12em]">
                  RSI (14)
                  <Info tip="Relative Strength Index. 0-100 scale. Green = oversold, Red = overbought" />
                </div>
                <span className="text-lg font-black font-mono" style={{ color: rsiColor === 'var(--up-color)' ? '#4ADE80' : rsiColor === 'var(--down-color)' ? '#F87171' : '#9CA3AF' }}>{ind.rsi14.toFixed(1)}</span>
              </div>
              <div className="relative h-3 rounded-full overflow-hidden" style={{ background: 'linear-gradient(to right, #4ADE80 0%, #4ADE80 30%, #FBBF24 30%, #FBBF24 70%, #F85149 70%, #F85149 100%)' }}>
                <div className="absolute top-0 h-full w-2 bg-white rounded-full shadow-lg shadow-white/40 transition-all duration-500" style={{ left: `${Math.min(100, Math.max(0, ind.rsi14))}%` }} />
              </div>
              <div className="flex justify-between text-[8px] mt-1.5 font-bold" style={{ color: 'var(--text-muted)' }}>
                <span style={{ color: '#4ADE80' }}>30 Oversold</span>
                <span>50</span>
                <span style={{ color: '#F85149' }}>70 Overbought</span>
              </div>
            </div>

            {/* S/R */}
            {(data.srLevels.resistances.length > 0 || data.srLevels.supports.length > 0) && (
              <div className="rounded-xl overflow-hidden border" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-primary)' }}>
                <div className="px-4 py-3 border-b flex items-center" style={{ borderColor: 'var(--border-primary)' }}>
                  <h3 className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-[0.12em]">Support / Resistance</h3>
                  <Info tip="Key price levels where price has previously reversed. R = resistance (above), S = support (below)" />
                </div>
                <div className="p-4 space-y-3">
                  {data.srLevels.resistances.map((r, i) => (
                    <div key={`r${i}`} className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded flex items-center justify-center text-[9px] font-black border" style={{ background: 'var(--down-bg)', borderColor: 'var(--down-border)', color: 'var(--down-color)' }}>R{i+1}</span>
                        <span className="text-[11px] font-mono font-bold" style={{ color: 'var(--down-color)' }}>${r.price.toFixed(2)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-elevated)' }}>
                          <div className="h-full rounded-full" style={{ width: `${r.strength}%`, background: 'var(--down-color)' }} />
                        </div>
                        <span className="text-[9px] font-bold w-7 text-right" style={{ color: 'var(--text-muted)' }}>{r.strength}%</span>
                      </div>
                    </div>
                  ))}
                  {data.srLevels.supports.map((s, i) => (
                    <div key={`s${i}`} className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded flex items-center justify-center text-[9px] font-black border" style={{ background: 'var(--up-bg)', borderColor: 'var(--up-border)', color: 'var(--up-color)' }}>S{i+1}</span>
                        <span className="text-[11px] font-mono font-bold" style={{ color: 'var(--up-color)' }}>${s.price.toFixed(2)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-elevated)' }}>
                          <div className="h-full rounded-full" style={{ width: `${s.strength}%`, background: 'var(--up-color)' }} />
                        </div>
                        <span className="text-[9px] font-bold w-7 text-right" style={{ color: 'var(--text-muted)' }}>{s.strength}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="text-[10px] space-y-1.5 px-1" style={{ color: 'var(--text-muted)' }}>
              <div className="flex justify-between"><span>Data source</span><span className="font-bold" style={{ color: 'var(--text-secondary)' }}>Hyperliquid</span></div>
              <div className="flex justify-between"><span>Fetches</span><span className="font-bold" style={{ color: 'var(--text-secondary)' }}>{fetchCount}</span></div>
              <div className="flex justify-between"><span>Last update</span><span className="font-bold" style={{ color: 'var(--text-secondary)' }}>
                {timeSinceUpdate < 60 ? `${timeSinceUpdate}s ago` : `${Math.floor(timeSinceUpdate/60)}m ago`}
              </span></div>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
