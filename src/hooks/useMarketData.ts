import { useState, useEffect, useCallback, useRef } from 'react';
import type { MarketData, Timeframe } from '../types';
import { fetchMarketData } from '../lib/api';

const REFRESH_INTERVAL = 60_000;
const DERIV_REFRESH = 120_000;

export interface DerivativesData {
  longShortRatio: {
    ratio: number;
    longTotalUsd: number;
    shortTotalUsd: number;
    imbalanceUsd: number;
    interpretation: string;
  };
  openInterest: { current: number; oiMcapRatio: number; percentile7d: number };
  funding: { current1h: number; annualized: number; percentile7d: number };
  liquidations: {
    shortLevels: { price: number; valueUsd: number; distancePct: number }[];
    longLevels: { price: number; valueUsd: number; distancePct: number }[];
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
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const raw = await res.json();
      if (raw.error) throw new Error(raw.error);

      setDerivatives({
        longShortRatio: raw.longShortRatio || { ratio: 0, longTotalUsd: 0, shortTotalUsd: 0, imbalanceUsd: 0, interpretation: 'neutral' },
        openInterest: raw.openInterest || { current: 0, oiMcapRatio: 0, percentile7d: 0 },
        funding: raw.funding || { current1h: 0, annualized: 0, percentile7d: 0 },
        liquidations: raw.liquidations || { shortLevels: [], longLevels: [] },
        lastUpdated: raw.lastUpdated || Date.now(),
      });
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
    const dInterval = setInterval(fetchDerivatives, DERIV_REFRESH);
    return () => { clearInterval(interval); clearInterval(dInterval); abortRef.current?.abort(); };
  }, [fetchData, fetchDerivatives]);

  return { data, derivatives, loading, error, tf, tfLoading, fetchCount, changeTimeframe, refetch: fetchData };
}
