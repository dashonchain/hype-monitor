export function fmt(n: number, d = 2): string {
  if (!n || isNaN(n)) return '—';
  if (Math.abs(n) >= 1e9) return `$${(Math.abs(n) / 1e9).toFixed(d)}B`;
  if (Math.abs(n) >= 1e6) return `$${(Math.abs(n) / 1e6).toFixed(d)}M`;
  if (Math.abs(n) >= 1e3) return `$${(Math.abs(n) / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(d)}`;
}

export function fmtPct(n: number): string {
  return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;
}

export function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  return `${Math.floor(s / 3600)}h`;
}

export function isStale(ts: number): boolean {
  return (Date.now() - ts) > 120_000;
}
