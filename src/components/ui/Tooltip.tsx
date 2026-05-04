'use client';

import { useState, useRef, useEffect, type ReactNode } from 'react';

interface TooltipProps {
  content: string;
  children: ReactNode;
}

export function Tooltip({ content, children }: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState<'top' | 'bottom'>('top');
  const triggerRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (visible && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      if (rect.top < 80) setPosition('bottom');
      else setPosition('top');
    }
  }, [visible]);

  return (
    <span
      ref={triggerRef}
      className="relative inline-flex items-center"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      {children}
      {visible && (
        <span
          className={`absolute z-50 px-3 py-2 text-[11px] leading-tight text-[var(--text-primary)] bg-[var(--bg-elevated)] border border-[var(--border-primary)] rounded-lg shadow-lg whitespace-nowrap pointer-events-none ${
            position === 'top' ? 'bottom-full mb-2 left-1/2 -translate-x-1/2' : 'top-full mt-2 left-1/2 -translate-x-1/2'
          }`}
        >
          {content}
          <span
            className={`absolute w-2 h-2 bg-[var(--bg-elevated)] border-l border-t border-[var(--border-primary)] rotate-45 left-1/2 -translate-x-1/2 ${
              position === 'top' ? '-bottom-1' : '-top-1'
            }`}
          />
        </span>
      )}
    </span>
  );
}

export function InfoIcon({ tip }: { tip: string }) {
  return (
    <Tooltip content={tip}>
      <span className="inline-flex items-center justify-center w-3.5 h-3.5 ml-1 text-[9px] text-[var(--text-muted)] border border-[var(--border-primary)] rounded-full cursor-help hover:border-[var(--accent-blue)] hover:text-[var(--accent-blue)] transition-colors">
        i
      </span>
    </Tooltip>
  );
}
