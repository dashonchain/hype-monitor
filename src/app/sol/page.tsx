'use client';

import { useState, useEffect } from 'react';

const MF = "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace";
const SF = "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', Roboto, sans-serif";

function safeNum(v: any, fallback = 0) {
  return v != null && !isNaN(Number(v)) ? Number(v) : fallback;
}

export default function SolPage() {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const fetchData = async () => {
      try {
        const res = await fetch('/api/sol?timeframe=4h');
        if (!res.ok) throw new Error(`API ${res.status}`);
        const json = await res.json();
        if (mounted) {
          setData(json);
          setLoading(false);
        }
      } catch (e: any) {
        if (mounted) {
          setError(e.message || 'Fetch failed');
          setLoading(false);
        }
      }
    };
    fetchData();
    const interval = setInterval(fetchData, 30_000);
    return () => { mounted = false; clearInterval(interval); };
  }, []);

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#080C0A', color: 'rgba(255,255,255,0.3)', fontFamily: SF }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 28, height: 28, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.08)', borderTopColor: '#4ADE80', animation: 'spin 1s linear infinite' }} />
          <p style={{ fontSize: 14 }}>Loading…</p>
        </div>
      </div>
    );
  }

  if (error || !data || !data.price) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, background: '#080C0A', color: 'rgba(255,255,255,0.9)', fontFamily: SF }}>
        <div style={{ fontSize: 32 }}>⚠️</div>
        <div style={{ fontSize: 16, fontWeight: 600, color: '#F87171' }}>Connection Error</div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)' }}>{error || 'Unable to fetch SOL data'}</div>
        <button onClick={() => window.location.reload()} style={{ marginTop: 8, padding: '8px 20px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: '#fff', cursor: 'pointer', fontSize: 13 }}>Retry</button>
      </div>
    );
  }

  const price = safeNum(data.price);
  const ch24 = safeNum(data.change24h);
  const ind = data.indicators || {};
  const rsi = safeNum(ind.rsi14);
  const vwap = safeNum(ind.vwap);
  const atr = safeNum(ind.atr);
  const mfi = safeNum(ind.mfi);
  const fund8h = safeNum(data.funding8h);
  const sm = data.smartMoney;
  const sr = data.srLevels || { supports: [], resistances: [] };
  const sig = data.signal || {};

  return (
    <div style={{ background: '#080C0A', color: 'rgba(255,255,255,0.9)', minHeight: '100vh', fontFamily: SF }}>
      <header style={{ position: 'sticky', top: 0, zIndex: 50, background: 'rgba(8,12,10,0.85)', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '12px 20px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 14, fontWeight: 700 }}>SOL Monitor</span>
            <a href="/" style={{ fontSize: 11, padding: '2px 8px', borderRadius: 999, color: '#FBBF24', border: '1px solid rgba(251,191,36,0.25)', textDecoration: 'none' }}>HYPE →</a>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 18, fontWeight: 700, fontFamily: MF }}>${price.toFixed(2)}</div>
            <div style={{ fontSize: 12, color: ch24 >= 0 ? '#34D399' : '#F87171', fontFamily: MF }}>
              {ch24 >= 0 ? '+' : ''}{ch24.toFixed(2)}% 24h
            </div>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: 1200, margin: '0 auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Signal */}
        <div style={{ borderRadius: 12, padding: 20, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 4 }}>Composite Signal</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#9CA3AF' }}>{sig.display || 'NEUTRAL'}</div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>{sig.summary || '—'}</div>
          <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 10, color: '#F87171' }}>SELL</span>
            <div style={{ flex: 1, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.08)' }}>
              <div style={{ height: '100%', width: `${safeNum(sig.score)}%`, background: '#9CA3AF', borderRadius: 2 }} />
            </div>
            <span style={{ fontSize: 10, color: '#34D399' }}>BUY</span>
            <span style={{ fontSize: 14, fontWeight: 700, fontFamily: MF, color: '#9CA3AF', marginLeft: 4 }}>{safeNum(sig.score)}</span>
          </div>
        </div>

        {/* Metrics Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
          {[
            { l: 'RSI 14', v: rsi.toFixed(1), s: rsi > 70 ? 'Overbought' : rsi < 30 ? 'Oversold' : 'Neutral', c: rsi > 70 ? '#F87171' : rsi < 30 ? '#34D399' : '#9CA3AF' },
            { l: 'VWAP', v: `$${vwap.toFixed(2)}`, s: price > vwap ? 'Above' : 'Below', c: price > vwap ? '#34D399' : '#F87171' },
            { l: 'Funding 8h', v: `${fund8h >= 0 ? '+' : ''}${fund8h.toFixed(2)}%`, s: data.fundingDirection || '—', c: fund8h > 0.001 ? '#F87171' : fund8h < -0.001 ? '#34D399' : '#9CA3AF' },
            { l: 'ATR (14)', v: `$${atr.toFixed(2)}`, s: 'Volatility', c: '#FBBF24' },
            { l: 'MFI', v: mfi.toFixed(1), s: mfi > 80 ? 'Overbought' : mfi < 20 ? 'Oversold' : 'Neutral', c: mfi > 80 ? '#F87171' : mfi < 20 ? '#34D399' : '#9CA3AF' },
            { l: 'L/S Ratio', v: sm ? `${safeNum(sm.longPct).toFixed(1)}% L / ${safeNum(sm.shortPct).toFixed(1)}% S` : '—', s: sm ? (sm.longPct > sm.shortPct ? 'Longs dom.' : 'Shorts dom.') : '—', c: sm ? (sm.longPct > sm.shortPct ? '#34D399' : '#F87171') : '#9CA3AF' },
          ].map(m => (
            <div key={m.l} style={{ borderRadius: 10, padding: '14px 16px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>{m.l}</div>
              <div style={{ fontSize: 18, fontWeight: 700, fontFamily: MF, color: '#fff' }}>{m.v}</div>
              <div style={{ fontSize: 10, color: m.c, marginTop: 3 }}>{m.s}</div>
            </div>
          ))}
        </div>

        {/* Chart */}
        <div style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.06)' }}>
          <iframe
            src="https://s.tradingview.com/widgetembed/?frameElementId=tv_chart_container&symbol=BINANCE:SOLUSDT&interval=4h&hidesidetoolbar=0&symboledit=0&saveimage=0&toolbarbg=0D1117&studies=%5B%22RSI%40tv-basicstudies%22%2C%22MACD%40tv-basicstudies%22%5D&theme=dark&style=1&timezone=Etc%2FUTC&locale=en&allow_symbol_change=false&height=520"
            style={{ width: '100%', height: 520, border: 'none', display: 'block' }}
            title="SOL Chart"
          />
        </div>

        {/* Panels */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>

          {/* Smart Money */}
          <div style={{ borderRadius: 12, padding: 16, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 10 }}>Smart Money</div>
            {sm ? (
              <>
                <div style={{ fontSize: 12, fontWeight: 600, color: sm.signal === 'LONGS_DOMINANT' ? '#34D399' : sm.signal === 'SHORTS_DOMINANT' ? '#F87171' : '#9CA3AF', marginBottom: 6 }}>
                  {sm.signal === 'LONGS_DOMINANT' ? 'Longs dominant ▲' : sm.signal === 'SHORTS_DOMINANT' ? 'Shorts dominant ▼' : 'Balanced ◆'}
                </div>
                <div style={{ display: 'flex', height: 5, borderRadius: 3, overflow: 'hidden', background: 'rgba(248,113,113,0.15)', marginBottom: 6 }}>
                  <div style={{ width: `${safeNum(sm.longPct)}%`, background: 'rgba(52,211,153,0.7)' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontFamily: MF, marginBottom: 8 }}>
                  <span style={{ color: '#34D399' }}>L {safeNum(sm.longPct).toFixed(1)}%</span>
                  <span style={{ color: '#F87171' }}>S {safeNum(sm.shortPct).toFixed(1)}%</span>
                </div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
                  Net: {safeNum(sm.netUsd) >= 0 ? '+' : ''}${(safeNum(sm.netUsd) / 1e6).toFixed(1)}M · {(sm.longCount || 0) + (sm.shortCount || 0)} wallets
                </div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', marginTop: 6, marginBottom: 4 }}>Top:</div>
                {(sm.wallets || []).slice(0, 3).map((w: any, i: number) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, fontFamily: MF, marginBottom: 2 }}>
                    <span style={{ color: w.direction === 'LONG' ? '#34D399' : '#F87171' }}>
                      {w.direction} ${(safeNum(w.sizeUsd) / 1e6).toFixed(1)}M {safeNum(w.leverage)}x
                    </span>
                    <span style={{ color: safeNum(w.unrealizedPnl) >= 0 ? '#34D399' : '#F87171' }}>
                      {safeNum(w.unrealizedPnl) >= 0 ? '+' : ''}${(safeNum(w.unrealizedPnl) / 1e6).toFixed(1)}M
                    </span>
                  </div>
                ))}
              </>
            ) : <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>Loading…</div>}
          </div>

          {/* S/R */}
          <div style={{ borderRadius: 12, padding: 16, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 10 }}>Support / Resistance</div>
            {sr.resistances?.length > 0 || sr.supports?.length > 0 ? (
              <>
                {sr.resistances?.map((r: any, i: number) => (
                  <div key={`r${i}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, fontFamily: MF, color: '#F87171' }}>R{i + 1} ${safeNum(r.price).toFixed(2)}</span>
                    <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>{safeNum(r.strength)}%</span>
                  </div>
                ))}
                {sr.supports?.map((s: any, i: number) => (
                  <div key={`s${i}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, fontFamily: MF, color: '#34D399' }}>S{i + 1} ${safeNum(s.price).toFixed(2)}</span>
                    <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>{safeNum(s.strength)}%</span>
                  </div>
                ))}
              </>
            ) : <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>No levels</div>}
          </div>

          {/* Changes */}
          <div style={{ borderRadius: 12, padding: 16, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 10 }}>Price Change</div>
            {[
              { p: '24h', v: ch24 },
              { p: '7d', v: safeNum(data.change7d) },
              { p: '30d', v: safeNum(data.change30d) },
            ].map(({ p, v }) => (
              <div key={p} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>{p}</span>
                <span style={{ fontSize: 14, fontWeight: 700, fontFamily: MF, color: v >= 0 ? '#34D399' : '#F87171' }}>
                  {v >= 0 ? '+' : ''}{v.toFixed(2)}%
                </span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.15)', display: 'flex', justifyContent: 'space-between', paddingBottom: 20 }}>
          <span>HL API · SOL/USDT</span>
          <span>{new Date().toISOString()}</span>
        </div>
      </main>
    </div>
  );
}
