'use client';

import { useState, useEffect } from 'react';

interface Indicator {
  id: string;
  name: string;
  shortName: string;
  icon: string;
  color: string;
  what: string;
  how: string;
  signals: string[];
  tip: string;
}

// ─── Mount guard for client-only rendering ───
function useClientMount() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  return mounted;
}

const INDICATORS: Indicator[] = [
  {
    id: 'candlestick',
    name: 'Japanese Candlesticks',
    shortName: 'Candles',
    icon: '🕯️',
    color: 'text-amber-400',
    what: 'Each candlestick shows 4 price points for a time period: Open, High, Low, and Close. The colored body represents the range between open and close. The thin lines (wicks) show the highest and lowest prices reached.',
    how: 'Green candle = price went UP during the period (close > open). Red candle = price went DOWN (close < open). Long body = strong momentum. Long wicks = price was rejected at that level.',
    signals: [
      'Green candle with small wicks = strong buying pressure',
      'Red candle with small wicks = strong selling pressure',
      'Long upper wick = sellers pushed price down from highs',
      'Long lower wick = buyers pushed price up from lows',
      'Doji (tiny body) = indecision, potential reversal',
    ],
    tip: 'Look at candle patterns in context of the overall trend. A single candle rarely tells the full story — look for clusters and support/resistance levels.',
  },
  {
    id: 'ema20',
    name: 'EMA 20 (Exponential Moving Average)',
    shortName: 'EMA 20',
    icon: '📈',
    color: 'text-pink-400',
    what: 'The EMA 20 is the average price over the last 20 periods, weighted to give more importance to recent prices. It acts as a dynamic support/resistance level for short-term trends.',
    how: 'When price is ABOVE the EMA 20, the short-term trend is bullish. When price is BELOW, it\'s bearish. The steeper the slope, the stronger the trend.',
    signals: [
      'Price crossing ABOVE EMA 20 = potential buy signal',
      'Price crossing BELOW EMA 20 = potential sell signal',
      'EMA 20 sloping up = uptrend confirmed',
      'EMA 20 sloping down = downtrend confirmed',
      'Price bouncing off EMA 20 = strong support/resistance',
    ],
    tip: 'EMA 20 works best in trending markets. In sideways/choppy markets, it generates many false signals. Combine with RSI for confirmation.',
  },
  {
    id: 'ema50',
    name: 'EMA 50 (Exponential Moving Average)',
    shortName: 'EMA 50',
    icon: '📊',
    color: 'text-blue-400',
    what: 'The EMA 50 is the average price over the last 50 periods. It represents the medium-term trend and is widely watched by institutional traders. It\'s a key indicator of market sentiment.',
    how: 'Price above EMA 50 = medium-term bullish. Price below = medium-term bearish. The EMA 50 often acts as a "line in the sand" — breaking below it can trigger significant selling.',
    signals: [
      'Price holding above EMA 50 = healthy uptrend',
      'Price breaking below EMA 50 = trend weakening',
      'EMA 20 crossing above EMA 50 = "Golden Cross" (bullish)',
      'EMA 20 crossing below EMA 50 = "Death Cross" (bearish)',
    ],
    tip: 'The EMA 50 is one of the most respected levels in crypto. Whales and algorithms often use it as a reference point. Watch for reactions when price approaches it.',
  },
  {
    id: 'ema200',
    name: 'EMA 200 (Exponential Moving Average)',
    shortName: 'EMA 200',
    icon: '🏔️',
    color: 'text-yellow-400',
    what: 'The EMA 200 is the average price over the last 200 periods. It\'s the most important long-term trend indicator. Being above or below the EMA 200 defines whether the market is in a bull or bear phase.',
    how: 'Price above EMA 200 = long-term bull market. Price below = long-term bear market. The EMA 200 is often the last line of defense in a downtrend.',
    signals: [
      'Price above EMA 200 = bull market structure intact',
      'Price below EMA 200 = bear market, be cautious',
      'Price reclaiming EMA 200 = potential trend reversal',
      'EMA 200 acting as support = strong long-term demand',
      'EMA 200 acting as resistance = strong long-term supply',
    ],
    tip: 'The EMA 200 is the "king" of moving averages. Bitcoin and altcoins often find strong support at the EMA 200 during bull markets. A weekly close below it is a major warning sign.',
  },
  {
    id: 'rsi',
    name: 'RSI (Relative Strength Index)',
    shortName: 'RSI',
    icon: '⚡',
    color: 'text-purple-400',
    what: 'RSI measures the speed and magnitude of price changes on a scale of 0-100. It identifies overbought and oversold conditions. Developed by J. Welles Wilder in 1978, it\'s the most popular momentum oscillator.',
    how: 'RSI above 70 = overbought (price may pullback). RSI below 30 = oversold (price may bounce). RSI around 50 = neutral, no clear momentum. Divergences between RSI and price can signal reversals.',
    signals: [
      'RSI > 70 = overbought, consider taking profits',
      'RSI < 30 = oversold, potential buying opportunity',
      'RSI diverging from price = weakening momentum',
      'RSI crossing above 50 = bullish momentum building',
      'RSI crossing below 50 = bearish momentum building',
    ],
    tip: 'In strong uptrends, RSI can stay above 70 for extended periods. In strong downtrends, it can stay below 30. Don\'t blindly sell at 70 or buy at 30 — look for divergences and confirm with other indicators.',
  },
  {
    id: 'signal',
    name: 'Composite Signal Score',
    shortName: 'Signal',
    icon: '🎯',
    color: 'text-cyan-400',
    what: 'The signal score combines all indicators (EMA 20/50/200, RSI, Open Interest) into a single percentage from 0-100%. It represents the overall bullish/bearish consensus of the technical indicators.',
    how: 'Score above 58% = more buy signals than sell signals. Score below 42% = more sell signals. The further from 50%, the stronger the consensus. Buy/Sell/Neutral counts show how many individual indicators agree.',
    signals: [
      'Score 70%+ = strong bullish consensus (STRONG BUY)',
      'Score 58-70% = moderate bullish (BUY)',
      'Score 42-58% = mixed signals (NEUTRAL)',
      'Score 30-42% = moderate bearish (SELL)',
      'Score <30% = strong bearish consensus (STRONG SELL)',
    ],
    tip: 'The signal score is a summary, not a trading strategy. Always consider the broader market context, news, and your risk management. No indicator is 100% accurate.',
  },
  {
    id: 'liquidation',
    name: 'Liquidation Levels',
    shortName: 'Liquidations',
    icon: '💥',
    color: 'text-red-400',
    what: 'Liquidation levels show price points where large numbers of leveraged positions will be forcibly closed. These levels act as "magnets" for price because liquidation cascades can accelerate moves in either direction.',
    how: 'Short liquidation levels are ABOVE current price (shorts get liquidated when price goes up). Long liquidation levels are BELOW current price (longs get liquidated when price goes down). The larger the liquidation cluster, the stronger the magnet effect.',
    signals: [
      'Large short liq cluster above = potential short squeeze target',
      'Large long liq cluster below = potential long squeeze target',
      'Imbalance toward shorts = more upside liquidation pressure',
      'Imbalance toward longs = more downside liquidation pressure',
      'Price approaching liq cluster = expect volatility',
    ],
    tip: 'Liquidation levels are not predictions — they\'re potential targets. Price may or may not reach them. Use them as reference points for setting stop-losses and take-profits, not as guaranteed outcomes.',
  },
];

export default function IndicatorTutorial() {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<string | null>(null);
  const mounted = useClientMount();

  if (!mounted) return null;

  const activeIndicator = INDICATORS.find(i => i.id === active);

  return (
    <>
      {/* Toggle Button */}
      <button
        onClick={() => setOpen(!open)}
        className="fixed bottom-4 right-4 z-50 w-10 h-10 rounded-full bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400 hover:bg-cyan-500/25 transition shadow-lg shadow-cyan-500/10"
        title="Indicator Guide"
      >
        <span className="text-sm font-bold">?</span>
      </button>

      {/* Overlay */}
      {open && (
        <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
      )}

      {/* Panel */}
      <div className={`fixed right-0 top-0 bottom-0 z-50 w-full max-w-md bg-[#0c0e14] border-l border-zinc-800/50 transform transition-transform duration-300 ${open ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="h-full flex flex-col">
          {/* Header */}
          <div className="px-5 py-4 border-b border-zinc-800/50 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-white">Indicator Guide</h2>
              <p className="text-[10px] text-zinc-500 mt-0.5">Learn what each indicator means and how to use it</p>
            </div>
            <button onClick={() => { setOpen(false); setActive(null); }} className="w-7 h-7 rounded-md bg-zinc-800/60 border border-zinc-700/40 flex items-center justify-center text-zinc-500 hover:text-zinc-300 transition">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            {!active ? (
              /* Indicator List */
              <div className="p-3 space-y-1.5">
                <p className="text-[10px] text-zinc-600 px-2 pb-2">Tap an indicator to learn more</p>
                {INDICATORS.map(ind => (
                  <button
                    key={ind.id}
                    onClick={() => setActive(ind.id)}
                    className="w-full text-left px-3 py-2.5 rounded-lg bg-zinc-900/60 border border-zinc-800/40 hover:border-zinc-700/60 hover:bg-zinc-800/40 transition group"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="text-base">{ind.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-semibold text-zinc-200 group-hover:text-white transition">{ind.name}</div>
                        <div className="text-[9px] text-zinc-600 truncate">{ind.what.slice(0, 60)}...</div>
                      </div>
                      <svg className="w-3.5 h-3.5 text-zinc-700 group-hover:text-zinc-500 transition" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              /* Detail View */
              <div className="p-4">
                <button onClick={() => setActive(null)} className="flex items-center gap-1.5 text-[10px] text-zinc-500 hover:text-zinc-300 mb-4 transition">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                  Back to list
                </button>

                {activeIndicator && (
                  <div className="space-y-4">
                    {/* Title */}
                    <div className="flex items-center gap-2.5">
                      <span className="text-xl">{activeIndicator.icon}</span>
                      <div>
                        <h3 className={`text-sm font-bold ${activeIndicator.color}`}>{activeIndicator.name}</h3>
                      </div>
                    </div>

                    {/* What is it */}
                    <div>
                      <h4 className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold mb-1.5">What is it?</h4>
                      <p className="text-xs text-zinc-300 leading-relaxed">{activeIndicator.what}</p>
                    </div>

                    {/* How it works */}
                    <div>
                      <h4 className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold mb-1.5">How it works</h4>
                      <p className="text-xs text-zinc-300 leading-relaxed">{activeIndicator.how}</p>
                    </div>

                    {/* Key Signals */}
                    <div>
                      <h4 className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold mb-1.5">Key Signals</h4>
                      <div className="space-y-1.5">
                        {activeIndicator.signals.map((sig, i) => (
                          <div key={i} className="flex items-start gap-2">
                            <span className="text-[9px] text-zinc-600 mt-0.5 shrink-0">•</span>
                            <span className="text-[11px] text-zinc-400">{sig}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Pro Tip */}
                    <div className="bg-cyan-500/5 border border-cyan-500/15 rounded-lg p-3">
                      <h4 className="text-[10px] text-cyan-400 uppercase tracking-wider font-semibold mb-1">💡 Pro Tip</h4>
                      <p className="text-[11px] text-zinc-400 leading-relaxed">{activeIndicator.tip}</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-5 py-3 border-t border-zinc-800/50">
            <p className="text-[9px] text-zinc-700 text-center">
              Educational purposes only. Not financial advice. Always do your own research.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
