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
    <div className={`rounded-2xl border ${sc.border} ${sc.bg} p-5 ${isStale ? 'opacity-50' : ''}`}>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className={`w-12 h-12 rounded-xl ${sc.bg} border ${sc.border} flex items-center justify-center text-2xl font-black ${sc.text}`}>
            {SIGNAL_ICONS[sig.action]}
          </div>
          <div>
            <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-[0.15em] font-semibold">
              Signal · {data.timeframe.toUpperCase()} · Hyperliquid
            </div>
            <div className={`text-2xl font-black tracking-tight ${sc.text}`}>{sig.display}</div>
            <div className="text-[11px] text-[var(--text-muted)] mt-0.5">{sig.summary}</div>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="w-32">
            <div className="flex justify-between text-[9px] text-[var(--text-muted)] mb-1">
              <span>Sell</span>
              <span className={`font-mono font-bold ${sc.text}`}>{sig.score}%</span>
              <span>Buy</span>
            </div>
            <div className="w-full bg-[var(--bg-elevated)] rounded-full h-1.5">
              <div
                className={`h-full rounded-full transition-all duration-700 ${
                  sig.score > 60 ? 'bg-emerald-500' : sig.score > 40 ? 'bg-amber-500' : 'bg-red-500'
                }`}
                style={{ width: `${sig.score}%` }}
              />
            </div>
          </div>
          <div className="flex gap-4 text-center">
            <div>
              <div className="text-lg font-black text-emerald-400">{sig.buy}</div>
              <div className="text-[8px] text-[var(--text-muted)] uppercase tracking-wider">Buy</div>
            </div>
            <div>
              <div className="text-lg font-black text-zinc-500">{sig.neutral}</div>
              <div className="text-[8px] text-[var(--text-muted)] uppercase tracking-wider">Neut</div>
            </div>
            <div>
              <div className="text-lg font-black text-red-400">{sig.sell}</div>
              <div className="text-[8px] text-[var(--text-muted)] uppercase tracking-wider">Sell</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
