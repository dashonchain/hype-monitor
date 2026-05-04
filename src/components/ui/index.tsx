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
  success: 'bg-[var(--success-bg)] text-[var(--success)] border-[var(--success-border)]',
  danger: 'bg-[var(--danger-bg)] text-[var(--danger)] border-[var(--danger-border)]',
  warning: 'bg-[var(--warning-bg)] text-[var(--warning)] border-[var(--warning-border)]',
  info: 'bg-[var(--info-bg)] text-[var(--info)] border-[var(--info-border)]',
  neutral: 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] border-[var(--border-primary)]',
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
      className={`relative px-5 py-2 rounded-lg text-xs font-bold transition-all ${
        active
          ? 'bg-[var(--accent-blue)]/10 text-[var(--accent-blue)] border border-[var(--accent-blue)]/30'
          : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] border border-[var(--border-primary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)]'
      } ${className}`}
    >
      {children}
    </button>
  );
}
