// Server-side rendered SOL Monitor — no client JS, no React hydration issues
export const dynamic = 'force-dynamic';

const MF = "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace";
const SF = "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', Roboto, sans-serif";

async function fetchSolData() {
  try {
    // Use absolute URL with fallback for server-side fetch
    const baseUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : (process.env.NEXT_PUBLIC_VERCEL_URL || 'http://localhost:3000');
    const res = await fetch(`${baseUrl}/api/sol?timeframe=4h`, {
      cache: 'no-store',
    });
    if (!res.ok) throw new Error(`API ${res.status}`);
    return await res.json();
  } catch (e: any) {
    return null;
  }
}

function fmtPct(n: number) {
  return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;
}

function safeNum(v: any, fallback = 0) {
  return v != null && !isNaN(v) ? v : fallback;
}

export default async function SolPage() {
  const d = await fetchSolData();

  if (!d || !d.price) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, fontFamily: SF, background: '#080C0A', color: 'rgba(255,255,255,0.9)' }}>
        <div style={{ fontSize: 32 }}>⚠️</div>
        <div style={{ fontSize: 16, fontWeight: 600, color: '#F87171' }}>Connection Error</div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)' }}>Unable to fetch SOL market data</div>
      </div>
    );
  }

  const ind = d.indicators || {};
  const price = safeNum(d.price);
  const ch24 = safeNum(d.change24h);
  const ch7 = safeNum(d.change7d);
  const ch30 = safeNum(d.change30d);
  const rsi = safeNum(ind.rsi14);
  const vwap = safeNum(ind.vwap);
  const atr = safeNum(ind.atr);
  const mfi = safeNum(ind.mfi);
  const fund8h = safeNum(d.funding8h);
  const sm = d.smartMoney;
  const sr = d.srLevels || { supports: [], resistances: [] };
  const signal = d.signal || {};
  const bull = signal.action === 'strong_buy' || signal.action === 'buy';
  const bear = signal.action === 'strong_sell' || signal.action === 'sell';
  const sigColor = bull ? '#34D399' : bear ? '#F87171' : '#9CA3AF';

  const metrics = [
    { l: 'RSI 14', v: rsi.toFixed(1), s: rsi > 70 ? 'Overbought' : rsi < 30 ? 'Oversold' : rsi > 50 ? 'Bullish' : 'Bearish', c: rsi > 70 ? '#F87171' : rsi < 30 ? '#34D399' : '#9CA3AF' },
    { l: 'VWAP', v: `$${vwap.toFixed(2)}`, s: price > vwap ? 'Price above' : 'Price below', c: price > vwap ? '#34D399' : '#F87171' },
    { l: 'Funding 8h', v: `${fund8h >= 0 ? '+' : ''}${fund8h.toFixed(2)}%`, s: d.fundingDirection || '—', c: fund8h > 0.001 ? '#F87171' : fund8h < -0.001 ? '#34D399' : '#9CA3AF' },
    { l: 'ATR (14)', v: `$${atr.toFixed(2)}`, s: `Volatility`, c: '#FBBF24' },
    { l: 'MFI', v: mfi.toFixed(1), s: mfi > 80 ? 'Overbought' : mfi < 20 ? 'Oversold' : 'Neutral', c: mfi > 80 ? '#F87171' : mfi < 20 ? '#34D399' : '#9CA3AF' },
    { l: 'L/S Ratio', v: sm ? `${safeNum(sm.longPct).toFixed(1)}% L / ${safeNum(sm.shortPct).toFixed(1)}% S` : '—', s: sm ? (sm.longPct > sm.shortPct ? 'Longs dominant' : 'Shorts dominant') : '—', c: sm ? (sm.longPct > sm.shortPct ? '#34D399' : '#F87171') : '#9CA3AF' },
  ];

  return (
    <div style={{ background: '#080C0A', color: 'rgba(255,255,255,0.9)', minHeight: '100vh', fontFamily: SF }}>
      {/* Header */}
      <header style={{ position: 'sticky', top: 0, zIndex: 50, background: 'rgba(8,12,10,0.85)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 20px', height: 48, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>SOL</span>
            <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)' }}>Monitor</span>
            <a href="/" style={{ fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 999, color: '#FBBF24', border: '1px solid rgba(251,191,36,0.25)', textDecoration: 'none', marginLeft: 4 }}>HYPE →</a>
            <span style={{ fontSize: 9, fontWeight: 500, padding: '2px 8px', borderRadius: 999, color: '#4ADE80', border: '1px solid rgba(74,222,128,0.2)' }}>● Live</span>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 16, fontWeight: 700, fontFamily: MF }}>${price.toFixed(2)}</div>
            <div style={{ fontSize: 11, fontWeight: 500, color: ch24 >= 0 ? '#34D399' : '#F87171' }}>
              {fmtPct(ch24)} <span style={{ color: 'rgba(255,255,255,0.2)' }}>24h</span>
            </div>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: 1200, margin: '0 auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Signal Gauge */}
        <div style={{ borderRadius: 16, padding: '28px 32px', background: bull ? 'rgba(52,211,153,0.08)' : bear ? 'rgba(248,113,113,0.08)' : 'rgba(255,255,255,0.03)', border: `1px solid ${bull ? 'rgba(52,211,153,0.2)' : bear ? 'rgba(248,113,113,0.2)' : 'rgba(255,255,255,0.08)'}` }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 500, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 4 }}>Composite Signal · 17 indicators</div>
              <div style={{ fontSize: 32, fontWeight: 700, color: sigColor, letterSpacing: '-.03em' }}>{signal.display || 'NEUTRAL'}</div>
              <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', marginTop: 3 }}>{signal.summary || 'Analyzing market...'}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 10, fontWeight: 600, color: '#F87171' }}>SELL</span>
              <div style={{ flex: 1, maxWidth: 200 }}>
                <div style={{ fontSize: 24, fontWeight: 700, fontFamily: MF, color: sigColor, textAlign: 'center' }}>{safeNum(signal.score)}</div>
                <div style={{ width: '100%', height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.08)' }}>
                  <div style={{ height: '100%', width: `${safeNum(signal.score)}%`, background: sigColor, borderRadius: 3 }} />
                </div>
              </div>
              <span style={{ fontSize: 10, fontWeight: 600, color: '#34D399' }}>BUY</span>
              <div style={{ display: 'flex', gap: 16 }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#34D399', fontFamily: MF }}>{safeNum(signal.buy)}</div>
                  <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)' }}>B</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#6B7280', fontFamily: MF }}>{safeNum(signal.neutral)}</div>
                  <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)' }}>N</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#F87171', fontFamily: MF }}>{safeNum(signal.sell)}</div>
                  <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)' }}>S</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Key Metrics */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
          {metrics.map(m => (
            <div key={m.l} style={{ borderRadius: 12, padding: '16px 18px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ fontSize: 10, fontWeight: 500, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>{m.l}</div>
              <div style={{ fontSize: 20, fontWeight: 700, fontFamily: MF, color: 'rgba(255,255,255,0.9)', letterSpacing: '-.01em' }}>{m.v}</div>
              <div style={{ fontSize: 11, fontWeight: 500, color: m.c, marginTop: 4 }}>{m.s}</div>
            </div>
          ))}
        </div>

        {/* Chart */}
        <div style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' }}>
          <iframe
            src="https://s.tradingview.com/widgetembed/?frameElementId=tv_chart_container&symbol=BINANCE:SOLUSDT&interval=4h&hidesidetoolbar=0&symboledit=0&saveimage=0&toolbarbg=0D1117&studies=%5B%22RSI%40tv-basicstudies%22%2C%22MACD%40tv-basicstudies%22%5D&theme=dark&style=1&timezone=Etc%2FUTC&locale=en&allow_symbol_change=false&height=520"
            style={{ width: '100%', height: 520, border: 'none' }}
            title="SOL Chart"
          />
        </div>

        {/* Panels */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
          {/* Smart Money */}
          <div style={{ borderRadius: 12, padding: 20, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ fontSize: 11, fontWeight: 500, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 14 }}>Smart Money</div>
            {sm ? (
              <>
                <div style={{ fontSize: 11, fontWeight: 500, color: sm.signal === 'LONGS_DOMINANT' ? '#34D399' : sm.signal === 'SHORTS_DOMINANT' ? '#F87171' : '#9CA3AF', marginBottom: 6 }}>
                  {sm.signal === 'LONGS_DOMINANT' ? 'Longs dominant ▲' : sm.signal === 'SHORTS_DOMINANT' ? 'Shorts dominant ▼' : 'Balanced ◆'}
                </div>
                <div style={{ display: 'flex', height: 6, borderRadius: 3, overflow: 'hidden', background: 'rgba(248,113,113,0.15)', marginBottom: 6 }}>
                  <div style={{ width: `${safeNum(sm.longPct)}%`, background: 'rgba(52,211,153,0.7)' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#34D399', fontFamily: MF }}>L {safeNum(sm.longPct).toFixed(1)}%</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#F87171', fontFamily: MF }}>S {safeNum(sm.shortPct).toFixed(1)}%</span>
                </div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>
                  Net: {sm.netUsd >= 0 ? '+' : ''}${((sm.netUsd || 0) / 1e6).toFixed(1)}M · {(sm.longCount || 0) + (sm.shortCount || 0)} wallets
                </div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginBottom: 6 }}>Top Positions:</div>
                {(sm.wallets || []).slice(0, 5).map((w: any, i: number) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontFamily: MF, marginBottom: 4 }}>
                    <span style={{ color: w.direction === 'LONG' ? '#34D399' : '#F87171' }}>
                      {w.direction} ${safeNum(w.sizeUsd / 1e6).toFixed(1)}M {safeNum(w.leverage)}x
                    </span>
                    <span style={{ color: safeNum(w.unrealizedPnl) >= 0 ? '#34D399' : '#F87171' }}>
                      {safeNum(w.unrealizedPnl) >= 0 ? '+' : ''}${safeNum(w.unrealizedPnl / 1e6).toFixed(1)}M
                    </span>
                  </div>
                ))}
              </>
            ) : <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)' }}>Loading…</div>}
          </div>

          {/* S/R Levels */}
          <div style={{ borderRadius: 12, padding: 20, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ fontSize: 11, fontWeight: 500, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 14 }}>Support / Resistance</div>
            {sr.resistances.length > 0 || sr.supports.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {sr.resistances.map((r: any, i: number) => (
                  <div key={`r${i}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 20, height: 20, borderRadius: 4, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: '#F87171', background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.15)' }}>R{i + 1}</span>
                      <span style={{ fontSize: 13, fontWeight: 600, fontFamily: MF, color: '#F87171' }}>${safeNum(r.price).toFixed(2)}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 48, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.06)' }}>
                        <div style={{ height: '100%', width: `${safeNum(r.strength)}%`, background: '#F87171', borderRadius: 2 }} />
                      </div>
                      <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', width: 28, textAlign: 'right' }}>{safeNum(r.strength)}%</span>
                    </div>
                  </div>
                ))}
                {sr.supports.map((s: any, i: number) => (
                  <div key={`s${i}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 20, height: 20, borderRadius: 4, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: '#34D399', background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.15)' }}>S{i + 1}</span>
                      <span style={{ fontSize: 13, fontWeight: 600, fontFamily: MF, color: '#34D399' }}>${safeNum(s.price).toFixed(2)}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 48, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.06)' }}>
                        <div style={{ height: '100%', width: `${safeNum(s.strength)}%`, background: '#34D399', borderRadius: 2 }} />
                      </div>
                      <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', width: 28, textAlign: 'right' }}>{safeNum(s.strength)}%</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)' }}>No levels</div>}
          </div>

          {/* Period Changes */}
          <div style={{ borderRadius: 12, padding: 20, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ fontSize: 11, fontWeight: 500, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 14 }}>Price Change</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { p: '24h', v: ch24 },
                { p: '7d', v: ch7 },
                { p: '30d', v: ch30 },
              ].map(({ p, v }) => (
                <div key={p} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>{p}</span>
                  <span style={{ fontSize: 16, fontWeight: 700, fontFamily: MF, color: v >= 0 ? '#34D399' : '#F87171' }}>{fmtPct(v)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.12)', display: 'flex', justifyContent: 'space-between' }}>
          <span>HL API · SOL/USDT</span>
          <span>{d.timeframe || '4d'} · {new Date().toISOString()}</span>
        </div>
      </main>
    </div>
  );
}
