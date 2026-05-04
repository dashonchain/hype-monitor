'use client';

import { timeAgo } from '../../lib/format';

interface HeaderProps {
  price: number;
  change24h: number;
  lastUpdated: number;
  isStale: boolean;
  onRefresh: () => void;
}

export function Header({ price, change24h, lastUpdated, isStale, onRefresh }: HeaderProps) {
  return (
    <header className="sticky top-0 z-50 bg-[var(--bg-primary)]/90 backdrop-blur-xl border-b border-[var(--border-primary)]">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white text-xs font-black shadow-lg shadow-cyan-500/20">
            H
          </div>
          <div>
            <span className="text-sm font-bold tracking-tight text-[var(--text-primary)]">HYPE</span>
            <span className="text-sm text-[var(--text-muted)] font-normal ml-1">Monitor</span>
          </div>
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold border ${
            isStale
              ? 'bg-red-500/10 text-red-400 border-red-500/20'
              : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
          }`}>
            {isStale ? `⚠ Stale ${timeAgo(lastUpdated)}` : '● Live'}
          </span>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-lg font-bold font-mono tracking-tight">${price.toFixed(2)}</div>
            <div className={`text-[11px] font-semibold ${change24h >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {change24h >= 0 ? '+' : ''}{change24h.toFixed(2)}% <span className="text-[var(--text-muted)]">24h</span>
            </div>
          </div>
          <button
            onClick={onRefresh}
            className="w-8 h-8 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-primary)] flex items-center justify-center hover:bg-[var(--bg-tertiary)] transition"
          >
            <svg className="w-4 h-4 text-[var(--text-secondary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </div>
    </header>
  );
}
