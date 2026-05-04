'use client';

import { useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
import { useMarketData } from '../hooks/useMarketData';
import TradingViewChart from '../components/chart/TradingViewChart';
import { fmtPct, isStale } from '../lib/format';
import type { Timeframe } from '../types';
import { TIMEFRAME_CONFIG } from '../types';

const TFS: Timeframe[] = ['1h', '4h', '1d'];

/* ═══════════════════════════════════════════
   INFO — tiny grey tooltip, CSS-only
   ═══════════════════════════════════════════ */
function Info({ tip }: { tip: string }) {
  return (
    <span className="info-wrap">
      <span className="info-dot" />
      <span className="info-tip">{tip}</span>
    </span>
  );
}

/* ═══════════════════════════════════════════
   SIGNAL GAUGE
   ═══════════════════════════════════════════ */
function SignalGauge({ data }: { data: NonNullable<ReturnType<typeof useMarketData>['data']> }) {
  const sig = data.signal;
  const isBullish = sig.action === 'strong_buy' || sig.action === 'buy';
  const isBearish = sig.action === 'strong_sell' || sig.action === 'sell';
  const isStale = (Date.now() - data.lastUpdated) > 120_000;

  const mainColor = isBullish ? '#4ADE80' : isBearish ? '#F87171' : '#6B7280';
  const bgGlow = isBullish ? 'rgba(74,222,128,0.06)' : isBearish ? 'rgba(248,113,113,0.06)' : 'rgba(107,114,128,0.06)';
  const icon = isBullish ? '▲' : isBearish ? '▼' : '—';

  return (
    <div className="rounded-xl p-5 transition-all" style={{ background: bgGlow, border: `2px solid ${mainColor}30`, opacity: isStale ? 0.5 : 1 }}>
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-5">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl flex items-center justify-center" style={{ background: `${mainColor}15`, border: `2px solid ${mainColor}40` }}>
            <span className="text-2xl font-black" style={{ color: mainColor }}>{icon}</span>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-[0.15em] font-semibold mb-1" style={{ color: '#6B7280' }}>
              Trading Signal · {data.timeframe.toUpperCase()} · Hyperliquid
            </div>
            <div className="text-2xl font-black tracking-tight" style={{ color: mainColor }}>{sig.display}</div>
            <div className="text-sm mt-0.5" style={{ color: '#9CA3AF' }}>{sig.summary}</div>
          </div>
        </div>
        <div className="flex items-center gap-5 w-full lg:w-auto">
          <div className="flex-1 lg:w-44">
            <div className="flex justify-between text-[10px] mb-1.5 font-bold">
              <span style={{ color: '#F87171' }}>SELL</span>
              <span className="font-mono font-black text-base" style={{ color: mainColor }}>{sig.score}</span>
              <span style={{ color: '#4ADE80' }}>BUY</span>
            </div>
            <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: '#1a2b20' }}>
              <div className="h-full rounded-full transition-all duration-700" style={{ width: `${sig.score}%`, background: mainColor }} />
            </div>
          </div>
          <div className="flex gap-4 text-center">
            <div><div className="text-lg font-black" style={{ color: '#4ADE80' }}>{sig.buy}</div><div className="text-[8px] uppercase tracking-wider font-bold" style={{ color: '#4B5563' }}>Buy</div></div>
            <div><div className="text-lg font-black" style={{ color: '#6B7280' }}>{sig.neutral}</div><div className="text-[8px] uppercase tracking-wider font-bold" style={{ color: '#4B5563' }}>Neut</div></div>
            <div><div className="text-lg font-black" style={{ color: '#F87171' }}>{sig.sell}</div><div className="text-[8px] uppercase tracking-wider font-bold" style={{ color: '#4B5563' }}>Sell</div></div>
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

  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(i);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4" style={{ background: '#0A0F0D' }}>
        <div className="w-10 h-10 rounded-full border-2 animate-spin" style={{ borderColor: '#263328', borderTopColor: '#4ADE80' }} />
        <p className="text-sm" style={{ color: '#4B5563' }}>Loading market data...</p>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6" style={{ background: '#0A0F0D' }}>
        <div className="text-3xl">⚠️</div>
        <p className="font-semibold" style={{ color: '#F87171' }}>Connection Error</p>
        <p className="text-sm" style={{ color: '#4B5563' }}>{error}</p>
        <button onClick={() => refetch()} className="mt-2 px-5 py-2.5 rounded-lg text-sm font-medium border" style={{ background: 'rgba(74,222,128,0.08)', borderColor: 'rgba(74,222,128,0.25)', color: '#4ADE80' }}>Retry</button>
      </div>
    );
  }

  if (!data) return null;

  const stale = isStale(data.lastUpdated);
  const ind = data.indicators;
  const rsiZone = ind.rsi14 > 70 ? 'Overbought' : ind.rsi14 < 30 ? 'Oversold' : ind.rsi14 > 50 ? 'Bullish zone' : 'Bearish zone';
  const timeSinceUpdate = Math.floor((now - data.lastUpdated) / 1000);

  return (
    <div className="min-h-screen text-[#E5E7EB] antialiased" style={{ background: '#0A0F0D' }}>

      {/* Tooltip styles */}
      <style>{`
        .info-wrap {
          position: relative;
          display: inline-flex;
          align-items: center;
          margin-left: 4px;
          cursor: help;
        }
        .info-dot {
          display: inline-block;
          width: 4px;
          height: 4px;
          border-radius: 50%;
          background: #4B5563;
          flex-shrink: 0;
          transition: background 0.15s;
        }
        .info-wrap:hover .info-dot {
          background: #9CA3AF;
        }
        .info-tip {
          position: absolute;
          z-index: 999;
          bottom: calc(100% + 6px);
          left: 50%;
          transform: translateX(-50%);
          padding: 6px 10px;
          font-size: 10px;
          line-height: 1.4;
          color: #9CA3AF;
          background: #141E17;
          border: 1px solid #263328;
          border-radius: 6px;
          box-shadow: 0 4px 16px rgba(0,0,0,0.6);
          white-space: nowrap;
          pointer-events: none;
          opacity: 0;
          transition: opacity 0.15s;
        }
        .info-wrap:hover .info-tip {
          opacity: 1;
        }
      `}</style>

      {/* ═══ HEADER ═══ */}
      <header className="sticky top-0 z-50 backdrop-blur-sm" style={{ background: 'rgba(10,15,13,0.95)', borderBottom: '1px solid #263328' }}>
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-[#0A0F0D] text-xs font-black" style={{ background: '#4ADE80' }}>H</div>
            <div>
              <span className="text-sm font-bold text-[#E5E7EB]">HYPE</span>
              <span className="text-sm font-normal ml-1" style={{ color: '#4B5563' }}>Monitor</span>
            </div>
            <span className="text-[10px] px-2.5 py-0.5 rounded-full font-bold" style={stale ? { background: 'rgba(248,113,113,0.08)', color: '#F87171', border: '1px solid rgba(248,113,113,0.25)' } : { background: 'rgba(74,222,128,0.08)', color: '#4ADE80', border: '1px solid rgba(74,222,128,0.25)' }}>
              {stale ? `Stale ${timeSinceUpdate}s` : '● Live'}
            </span>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-xl font-bold font-mono text-[#E5E7EB]">${data.price.toFixed(2)}</div>
              <div className={`text-xs font-bold ${data.change24h >= 0 ? '' : ''}`} style={{ color: data.change24h >= 0 ? '#4ADE80' : '#F87171' }}>
                {data.change24h >= 0 ? '+' : ''}{data.change24h.toFixed(2)}% <span style={{ color: '#4B5563' }}>24h</span>
              </div>
            </div>
            <button onClick={() => refetch()} className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#142219', border: '1px solid #263328' }}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="#9CA3AF" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-[1440px] mx-auto px-4 sm:px-6 py-5 space-y-4">

        {/* ═══ SIGNAL ═══ */}
        <SignalGauge data={data} />

        {/* ═══ METRICS ROW 1 ═══ */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
          {([
            { label: 'Market Cap', value: data.marketCap > 0 ? `$${(data.marketCap / 1e9).toFixed(2)}B` : '—', tip: 'Total market value of all HYPE tokens in circulation' },
            { label: 'Volume 24h', value: `$${(data.volume24h / 1e6).toFixed(1)}M`, tip: 'Total trading volume across all exchanges in the last 24 hours' },
            { label: 'High 24h', value: `$${data.high24h.toFixed(2)}`, tip: 'Highest price reached in the last 24 hours' },
            { label: 'Low 24h', value: `$${data.low24h.toFixed(2)}`, tip: 'Lowest price reached in the last 24 hours' },
            { label: 'Open Interest', value: `$${(data.oiUsd / 1e6).toFixed(1)}M`, sub: `${(data.oiTokens / 1e6).toFixed(1)}M HYPE`, tip: 'Total value of all open perpetual futures contracts on Hyperliquid' },
            { label: 'Funding 8h', value: `${data.funding8h >= 0 ? '+' : ''}${data.funding8h.toFixed(4)}%`, sub: `Ann. ${data.fundingAnn.toFixed(1)}%`, color: data.funding8h > 0 ? '#4ADE80' : '#F87171', tip: 'Funding rate paid every 8h. Positive = longs pay shorts. Negative = shorts pay longs' },
            { label: 'RSI 14', value: ind.rsi14.toFixed(1), sub: rsiZone, color: ind.rsi14 > 70 ? '#F87171' : ind.rsi14 < 30 ? '#4ADE80' : '#9CA3AF', tip: 'Relative Strength Index (14 periods). >70 = overbought, <30 = oversold' },
          ] as { label: string; value: string; sub?: string; color?: string; tip: string }[]).map(m => (
            <div key={m.label} className="rounded-xl px-3 py-3" style={{ background: '#0F1A14', border: '1px solid #263328' }}>
              <div className="flex items-center text-[9px] uppercase tracking-wider font-bold" style={{ color: '#4B5563' }}>
                {m.label}
                <Info tip={m.tip} />
              </div>
              <div className="text-sm font-bold font-mono mt-1" style={{ color: m.color || '#E5E7EB' }}>{m.value}</div>
              {m.sub && <div className="text-[9px] mt-0.5" style={{ color: '#4B5563' }}>{m.sub}</div>}
            </div>
          ))}
        </div>

        {/* ═══ DERIVATIVES + SMA ═══ */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {([
            { label: 'Long Liquidations', value: data.liqZones[0] ? `$${(data.liqZones[0].valueUsd / 1e6).toFixed(1)}M` : '—', sub: data.liqZones[0] ? `$${data.liqZones[0].priceLow.toFixed(2)}–$${data.liqZones[0].priceHigh.toFixed(2)}` : '', color: '#4ADE80', tip: 'Estimated value of long positions liquidated at this price zone' },
            { label: 'Short Liquidations', value: data.liqZones[1] ? `$${(data.liqZones[1].valueUsd / 1e6).toFixed(1)}M` : '—', sub: data.liqZones[1] ? `$${data.liqZones[1].priceLow.toFixed(2)}–$${data.liqZones[1].priceHigh.toFixed(2)}` : '', color: '#60A5FA', tip: 'Estimated value of short positions liquidated at this price zone' },
          ] as { label: string; value: string; sub: string; color: string; tip: string }[]).map(m => (
            <div key={m.label} className="rounded-xl px-3 py-3" style={{ background: '#0F1A14', border: '1px solid #263328' }}>
              <div className="flex items-center text-[9px] uppercase tracking-wider font-bold" style={{ color: '#4B5563' }}>
                {m.label}
                <Info tip={m.tip} />
              </div>
              <div className="text-sm font-bold font-mono mt-1" style={{ color: m.color }}>{m.value}</div>
              <div className="text-[9px] mt-0.5" style={{ color: '#4B5563' }}>{m.sub}</div>
            </div>
          ))}
          {([
            { label: 'SMA 10', value: ind.sma10.toFixed(2), color: '#F9A8D4', above: data.price > ind.sma10, tip: 'Simple Moving Average over 10 periods. Short-term trend direction' },
            { label: 'SMA 50', value: ind.sma50.toFixed(2), color: '#60A5FA', above: data.price > ind.sma50, tip: 'Simple Moving Average over 50 periods. Medium-term trend direction' },
          ] as { label: string; value: string; color: string; above: boolean; tip: string }[]).map(m => (
            <div key={m.label} className="rounded-xl px-3 py-3" style={{ background: '#0F1A14', border: '1px solid #263328' }}>
              <div className="flex items-center text-[9px] uppercase tracking-wider font-bold" style={{ color: '#4B5563' }}>
                {m.label}
                <Info tip={m.tip} />
              </div>
              <div className="text-sm font-bold font-mono mt-1" style={{ color: m.color }}>${m.value}</div>
              <div className="text-[9px] mt-0.5 font-bold" style={{ color: m.above ? '#4ADE80' : '#F87171' }}>
                {m.above ? '▲ Price Above' : '▼ Price Below'}
              </div>
            </div>
          ))}
        </div>

        {/* ═══ TIMEFRAMES ═══ */}
        <div className="flex items-center gap-2">
          {TFS.map(t => (
            <button key={t} onClick={() => changeTimeframe(t)}
              className="relative px-5 py-2 rounded-lg text-xs font-bold transition-all"
              style={tf === t
                ? { background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.25)', color: '#4ADE80' }
                : { background: '#142219', border: '1px solid #263328', color: '#9CA3AF' }
              }>
              {TIMEFRAME_CONFIG[t].label}
              {tfLoading && tf === t && <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full animate-pulse" style={{ background: '#4ADE80' }} />}
            </button>
          ))}
        </div>

        {/* ═══ MAIN GRID ═══ */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-4">
            <div className="rounded-xl overflow-hidden" style={{ background: '#0F1A14', border: '1px solid #263328' }}>
              <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid #263328' }}>
                <h3 className="text-xs font-bold" style={{ color: '#9CA3AF' }}>HYPE/USDT · TradingView</h3>
                <div className="flex gap-3 text-[10px] font-bold" style={{ color: '#4B5563' }}>
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: '#4ADE80' }} /> Bullish</span>
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: '#F87171' }} /> Bearish</span>
                </div>
              </div>
              <TradingViewChart timeframe={tf} />
            </div>

            <div className="grid grid-cols-3 gap-2">
              {(['24h', '7d', '30d'] as const).map(period => {
                const val = period === '24h' ? data.change24h : period === '7d' ? data.change7d : data.change30d;
                return (
                  <div key={period} className="rounded-xl px-4 py-3" style={{ background: '#0F1A14', border: '1px solid #263328' }}>
                    <div className="text-[9px] uppercase tracking-wider font-bold" style={{ color: '#4B5563' }}>{period}</div>
                    <div className="text-base font-black font-mono mt-1" style={{ color: val >= 0 ? '#4ADE80' : '#F87171' }}>{fmtPct(val)}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ═══ SIDEBAR ═══ */}
          <aside className="space-y-4">
            <div className="rounded-xl overflow-hidden" style={{ background: '#0F1A14', border: '1px solid #263328' }}>
              <div className="px-4 py-3" style={{ borderBottom: '1px solid #263328' }}>
                <h3 className="text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: '#9CA3AF' }}>Technical Indicators · {data.timeframe.toUpperCase()}</h3>
              </div>
              <div className="p-4">
                {([
                  { label: 'SMA 10', value: `$${ind.sma10.toFixed(2)}`, color: data.price > ind.sma10 ? '#4ADE80' : '#F87171', sub: data.price > ind.sma10 ? 'Above' : 'Below', tip: 'Simple Moving Average over 10 periods' },
                  { label: 'SMA 20', value: `$${ind.sma20.toFixed(2)}`, color: data.price > ind.sma20 ? '#4ADE80' : '#F87171', sub: data.price > ind.sma20 ? 'Above' : 'Below', tip: 'Simple Moving Average over 20 periods' },
                  { label: 'SMA 50', value: `$${ind.sma50.toFixed(2)}`, color: data.price > ind.sma50 ? '#4ADE80' : '#F87171', sub: data.price > ind.sma50 ? 'Above' : 'Below', tip: 'Simple Moving Average over 50 periods' },
                  { label: 'RSI 14', value: ind.rsi14.toFixed(1), color: ind.rsi14 > 70 ? '#F87171' : ind.rsi14 < 30 ? '#4ADE80' : '#9CA3AF', sub: rsiZone, tip: 'Relative Strength Index. >70 overbought, <30 oversold' },
                  { label: 'MACD', value: ind.macd.toFixed(4), color: ind.macdHist > 0 ? '#4ADE80' : '#F87171', sub: `Sig: ${ind.macdSignal.toFixed(3)}`, tip: 'Moving Average Convergence Divergence' },
                  { label: 'Stoch K', value: ind.stochK.toFixed(1), color: ind.stochK > 80 ? '#F87171' : ind.stochK < 20 ? '#4ADE80' : '#9CA3AF', sub: `D: ${ind.stochD.toFixed(1)}`, tip: 'Stochastic Oscillator. >80 overbought, <20 oversold' },
                  { label: 'KDJ J', value: ind.kdjJ.toFixed(1), color: ind.kdjJ > 80 ? '#F87171' : ind.kdjJ < 20 ? '#4ADE80' : '#9CA3AF', sub: `K: ${ind.kdjK.toFixed(1)}`, tip: 'KDJ Momentum indicator' },
                  { label: 'CCI', value: ind.cci.toFixed(1), color: ind.cci > 100 ? '#F87171' : ind.cci < -100 ? '#4ADE80' : '#9CA3AF', sub: ind.cci > 100 ? 'Overbought' : ind.cci < -100 ? 'Oversold' : 'Neutral', tip: 'Commodity Channel Index. >+100 overbought, <-100 oversold' },
                  { label: 'ADX', value: ind.adx.toFixed(1), color: ind.adx > 25 ? '#FBBF24' : '#4B5563', sub: ind.adx > 25 ? 'Trending' : 'Ranging', tip: 'Average Directional Index. >25 = strong trend' },
                  { label: 'BB %B', value: ind.bbPercentB.toFixed(3), color: ind.bbPercentB > 1 ? '#F87171' : ind.bbPercentB < 0 ? '#4ADE80' : '#9CA3AF', sub: '', tip: 'Bollinger Bands %B. >1 above upper, <0 below lower' },
                ] as { label: string; value: string; color: string; sub: string; tip: string }[]).map((r, i) => (
                  <div key={r.label} className={`flex justify-between items-center py-2.5 ${i < 9 ? '' : ''}`} style={{ borderBottom: i < 9 ? '1px solid rgba(38,51,40,0.5)' : 'none' }}>
                    <div className="flex items-center text-[11px] font-medium" style={{ color: '#9CA3AF' }}>
                      {r.label}
                      <Info tip={r.tip} />
                    </div>
                    <div className="text-right">
                      <span className="text-[12px] font-mono font-bold" style={{ color: r.color }}>{r.value}</span>
                      {r.sub && <span className="text-[9px] ml-2" style={{ color: '#4B5563' }}>{r.sub}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* RSI Gauge */}
            <div className="rounded-xl p-4" style={{ background: '#0F1A14', border: '1px solid #263328' }}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: '#9CA3AF' }}>
                  RSI (14)
                  <Info tip="0-100 scale. Green zone = oversold, Red zone = overbought" />
                </div>
                <span className="text-lg font-black font-mono" style={{ color: ind.rsi14 > 70 ? '#F87171' : ind.rsi14 < 30 ? '#4ADE80' : '#9CA3AF' }}>{ind.rsi14.toFixed(1)}</span>
              </div>
              <div className="relative h-2.5 rounded-full overflow-hidden" style={{ background: 'linear-gradient(to right, #4ADE80 0%, #4ADE80 30%, #FBBF24 30%, #FBBF24 70%, #F85149 70%, #F85149 100%)' }}>
                <div className="absolute top-0 h-full w-2 bg-white rounded-full shadow-lg shadow-white/40 transition-all duration-500" style={{ left: `${Math.min(100, Math.max(0, ind.rsi14))}%` }} />
              </div>
              <div className="flex justify-between text-[8px] mt-1.5 font-bold">
                <span style={{ color: '#4ADE80' }}>30 Oversold</span>
                <span style={{ color: '#4B5563' }}>50</span>
                <span style={{ color: '#F85149' }}>70 Overbought</span>
              </div>
            </div>

            {/* S/R */}
            {(data.srLevels.resistances.length > 0 || data.srLevels.supports.length > 0) && (
              <div className="rounded-xl overflow-hidden" style={{ background: '#0F1A14', border: '1px solid #263328' }}>
                <div className="px-4 py-3 flex items-center" style={{ borderBottom: '1px solid #263328' }}>
                  <h3 className="text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: '#9CA3AF' }}>Support / Resistance</h3>
                  <Info tip="Key price levels where price has previously reversed. R = above, S = below" />
                </div>
                <div className="p-4 space-y-3">
                  {data.srLevels.resistances.map((r, i) => (
                    <div key={`r${i}`} className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded flex items-center justify-center text-[9px] font-black" style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.25)', color: '#F87171' }}>R{i+1}</span>
                        <span className="text-[11px] font-mono font-bold" style={{ color: '#F87171' }}>${r.price.toFixed(2)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 rounded-full overflow-hidden" style={{ background: '#1a2b20' }}>
                          <div className="h-full rounded-full" style={{ width: `${r.strength}%`, background: '#F87171' }} />
                        </div>
                        <span className="text-[9px] font-bold w-7 text-right" style={{ color: '#4B5563' }}>{r.strength}%</span>
                      </div>
                    </div>
                  ))}
                  {data.srLevels.supports.map((s, i) => (
                    <div key={`s${i}`} className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded flex items-center justify-center text-[9px] font-black" style={{ background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.25)', color: '#4ADE80' }}>S{i+1}</span>
                        <span className="text-[11px] font-mono font-bold" style={{ color: '#4ADE80' }}>${s.price.toFixed(2)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 rounded-full overflow-hidden" style={{ background: '#1a2b20' }}>
                          <div className="h-full rounded-full" style={{ width: `${s.strength}%`, background: '#4ADE80' }} />
                        </div>
                        <span className="text-[9px] font-bold w-7 text-right" style={{ color: '#4B5563' }}>{s.strength}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="text-[10px] space-y-1.5 px-1" style={{ color: '#4B5563' }}>
              <div className="flex justify-between"><span>Source</span><span className="font-bold" style={{ color: '#9CA3AF' }}>Hyperliquid</span></div>
              <div className="flex justify-between"><span>Fetches</span><span className="font-bold" style={{ color: '#9CA3AF' }}>{fetchCount}</span></div>
              <div className="flex justify-between"><span>Updated</span><span className="font-bold" style={{ color: '#9CA3AF' }}>{timeSinceUpdate < 60 ? `${timeSinceUpdate}s ago` : `${Math.floor(timeSinceUpdate/60)}m ago`}</span></div>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
