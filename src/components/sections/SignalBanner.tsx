'use client';

import type { MarketData } from '../../types';
import { SIGNAL_COLORS, SIGNAL_ICONS } from '../../types';

interface Props {
  data: MarketData;
}

export function SignalBanner({ data }: Props) {
  const sig = data.signal;
  const sc = SIGNAL_COLORS[sig.action];
  const isStale = (Date.now() - data.lastUpdated) > 120_000;

  return (
    <div className={`rounded-xl border-2 ${sc.border} ${sc.bg} p-5 ${isStale ? 'opacity-50' : ''}`}>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className={`w-14 h-14 rounded-xl ${sc.bg} border-2 ${sc.border} flex items-center justify-center text-3xl ${sc.text}`}>
            {SIGNAL_ICONS[sig.action]}
          </div>
          <div>
            <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-widest font-semibold mb-1">
              Signal · {data.timeframe.toUpperCase()} · Hyperliquid
            </div>
            <div className={`text-2xl font-black tracking-tight ${sc.text}`}>{sig.display}</div>
            <div className="text-sm text-[var(--text-secondary)] mt-0.5">{sig.summary}</div>
          </div>
        </div>
        <div className="flex items-center gap-6">
          {/* Score bar */}
          <div className="w-36">
            <div className="flex justify-between text-[10px] text-[var(--text-muted)] mb-1.5 font-semibold">
              <span>SELL</span>
              <span className={`font-mono font-bold ${sc.text}`}>{sig.score}%</span>
              <span>BUY</span>
            </div>
            <div className="w-full bg-[var(--bg-elevated)] rounded-full h-2">
              <div
                className={`h-full rounded-full transition-all duration-700 ${
                  sig.score > 60 ? 'bg-[var(--up-color)]' : sig.score > 40 ? 'bg-[var(--warning)]' : 'bg-[var(--down-color)]'
                }`}
                style={{ width: `${sig.score}%` }}
              />
            </div>
          </div>
          {/* Counts */}
          <div className="flex gap-5 text-center">
            <div>
              <div className="text-xl font-black text-[var(--up-color)]">{sig.buy}</div>
              <div className="text-[9px] text-[var(--text-muted)] uppercase tracking-wider font-semibold">Buy</div>
            </div>
            <div>
              <div className="text-xl font-black text-[var(--neutral-color)]">{sig.neutral}</div>
              <div className="text-[9px] text-[var(--text-muted)] uppercase tracking-wider font-semibold">Neut</div>
            </div>
            <div>
              <div className="text-xl font-black text-[var(--down-color)]">{sig.sell}</div>
              <div className="text-[9px] text-[var(--text-muted)] uppercase tracking-wider font-semibold">Sell</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
