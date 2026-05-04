'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { MarketData, Timeframe } from '../types';
import { fetchMarketData } from '../lib/api';

const REFRESH_INTERVAL = 60_000; // 60s

export function useMarketData(initialTf: Timeframe = '4h') {
  const [data, setData] = useState<MarketData | null>(null);
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

  const changeTimeframe = useCallback((t: Timeframe) => {
    setTf(t);
    fetchData(t);
  }, [fetchData]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => fetchData(undefined, true), REFRESH_INTERVAL);
    return () => { clearInterval(interval); abortRef.current?.abort(); };
  }, [fetchData]);

  return { data, loading, error, tf, tfLoading, fetchCount, changeTimeframe, refetch: fetchData };
}
