import { type ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
}

export function Card({ children, className = '' }: CardProps) {
  return (
    <div className={`bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-xl ${className}`}>
      {children}
    </div>
  );
}

interface CardHeaderProps {
  children: ReactNode;
  className?: string;
}

export function CardHeader({ children, className = '' }: CardHeaderProps) {
  return (
    <div className={`px-4 py-3 border-b border-[var(--border-primary)] ${className}`}>
      {children}
    </div>
  );
}

interface BadgeProps {
  variant: 'success' | 'danger' | 'warning' | 'info' | 'neutral';
  children: ReactNode;
  size?: 'sm' | 'md';
}

const badgeColors = {
  success: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  danger: 'bg-red-500/10 text-red-400 border-red-500/20',
  warning: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  info: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
  neutral: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20',
};

export function Badge({ variant, children, size = 'sm' }: BadgeProps) {
  const sizeClasses = size === 'sm' ? 'text-[10px] px-2 py-0.5' : 'text-xs px-2.5 py-1';
  return (
    <span className={`inline-flex items-center font-semibold rounded-full border ${badgeColors[variant]} ${sizeClasses}`}>
      {children}
    </span>
  );
}

interface StatCardProps {
  label: string;
  value: string;
  sub?: string;
  color?: string;
}

export function StatCard({ label, value, sub, color = '' }: StatCardProps) {
  return (
    <div className="bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-xl px-3 py-3">
      <div className="text-[9px] text-[var(--text-muted)] uppercase tracking-wider font-semibold">{label}</div>
      <div className={`text-sm font-bold font-mono mt-1 ${color}`}>{value}</div>
      {sub && <div className="text-[9px] text-[var(--text-muted)] mt-0.5">{sub}</div>}
    </div>
  );
}

interface ButtonProps {
  children: ReactNode;
  onClick?: () => void;
  active?: boolean;
  className?: string;
}

export function Button({ children, onClick, active = false, className = '' }: ButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`relative px-6 py-2 rounded-lg text-xs font-bold transition-all ${
        active
          ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/25 shadow-lg shadow-cyan-500/5'
          : 'bg-[var(--bg-secondary)] text-[var(--text-muted)] border border-[var(--border-primary)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'
      } ${className}`}
    >
      {children}
    </button>
  );
}
