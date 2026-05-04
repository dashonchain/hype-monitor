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
    <header className="sticky top-0 z-50 bg-[var(--bg-primary)]/95 backdrop-blur-sm border-b border-[var(--border-primary)]">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[var(--accent-blue)] to-[var(--accent-cyan)] flex items-center justify-center text-white text-xs font-black">
            H
          </div>
          <div className="hidden sm:block">
            <span className="text-sm font-bold text-[var(--text-primary)]">HYPE</span>
            <span className="text-sm text-[var(--text-muted)] font-normal ml-1">Monitor</span>
          </div>
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold border ${
            isStale
              ? 'bg-[var(--danger-bg)] text-[var(--danger)] border-[var(--danger-border)]'
              : 'bg-[var(--success-bg)] text-[var(--success)] border-[var(--success-border)]'
          }`}>
            {isStale ? `Stale ${timeAgo(lastUpdated)}` : '● Live'}
          </span>
        </div>

        {/* Price + Refresh */}
        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-lg font-bold font-mono text-[var(--text-primary)]">
              ${price.toFixed(2)}
            </div>
            <div className={`text-xs font-semibold ${change24h >= 0 ? 'text-[var(--up-color)]' : 'text-[var(--down-color)]'}`}>
              {change24h >= 0 ? '+' : ''}{change24h.toFixed(2)}% <span className="text-[var(--text-muted)]">24h</span>
            </div>
          </div>
          <button
            onClick={onRefresh}
            className="w-8 h-8 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-primary)] flex items-center justify-center hover:bg-[var(--bg-surface)] transition"
            title="Refresh data"
          >
            <svg className="w-4 h-4 text-[var(--text-secondary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </div>
    </header>
  );
}
