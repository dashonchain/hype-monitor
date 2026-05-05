'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { MarketData, Timeframe } from '../types';
import { fetchMarketData } from '../lib/api';

const REFRESH_INTERVAL = 60_000; // 60s
const DERIV_REFRESH = 120_000; // 120s for derivatives

export interface DerivativesData {
  longShortRatio: {
    ratio: number;
    longTotalUsd: number;
    shortTotalUsd: number;
    imbalanceUsd: number;
    interpretation: string;
  };
  liquidations: {
    shortLevels: { price: number; valueUsd: number; distancePct: number }[];
    longLevels: { price: number; valueUsd: number; distancePct: number }[];
  };
  openInterest: {
    current: number;
    oiMcapRatio: number;
    percentile7d: number;
    change1h: number;
    change4h: number;
    change1d: number;
  };
  funding: {
    current1h: number;
    annualized: number;
    percentile7d: number;
  };
  lastUpdated: number;
}

export function useMarketData(initialTf: Timeframe = '4h') {
  const [data, setData] = useState<MarketData | null>(null);
  const [derivatives, setDerivatives] = useState<DerivativesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tf, setTf] = useState<Timeframe>(initialTf);
  const [fetchCount, setFetchCount] = useState(0);
  const [tfLoading, setTfLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const fetchData = useCallback(async (timeframe?: Timeframe, silent = false) => {
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    try {
      if (!silent) setTfLoading(true);
      const d = await fetchMarketData(timeframe || tf);
      setData(d);
      setFetchCount(c => c + 1);
      setError('');
    } catch (e: any) {
      if (e.name !== 'AbortError') setError(e.message || 'Error');
    } finally {
      setLoading(false);
      setTfLoading(false);
    }
  }, [tf]);

  const fetchDerivatives = useCallback(async () => {
    try {
      const res = await fetch('/api/derivatives');
      if (res.ok) {
        const d = await res.json();
        if (!d.error) setDerivatives(d);
      }
    } catch {
      // silent fail
    }
  }, []);

  const changeTimeframe = useCallback((t: Timeframe) => {
    setTf(t);
    fetchData(t);
  }, [fetchData]);

  useEffect(() => {
    fetchData();
    fetchDerivatives();
    const interval = setInterval(() => fetchData(undefined, true), REFRESH_INTERVAL);
    const derivInterval = setInterval(fetchDerivatives, DERIV_REFRESH);
    return () => {
      clearInterval(interval);
      clearInterval(derivInterval);
      abortRef.current?.abort();
    };
  }, [fetchData, fetchDerivatives]);

  return { data, derivatives, loading, error, tf, tfLoading, fetchCount, changeTimeframe, refetch: fetchData };
}
