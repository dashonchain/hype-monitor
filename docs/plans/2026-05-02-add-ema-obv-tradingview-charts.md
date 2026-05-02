# HYPE Monitor: Add EMA, OBV & TradingView Charts Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Enhance HYPE Monitor with professional EMA indicators, OBV volume confirmation, RSI divergence detection, and TradingView Lightweight Charts integration for visual analysis.

**Architecture:** 
- Backend (`server.js`): Fetch CoinGecko 1-year daily data, compute EMA(20/50/200), OBV, and RSI divergence. Add to `/api/live-data` response.
- Frontend (`page.tsx`): Replace sparkline with TradingView Lightweight Charts component, overlay EMA lines, display OBV separately.

**Tech Stack:** 
- Backend: Node.js, CoinGecko API (free), EMA/OBV calculation
- Frontend: React, TypeScript, lightweight-charts (TradingView)

---

## Task 1: Add CoinGecko historical data fetch to backend

**Objective:** Fetch 1-year daily price+volume data from CoinGecko in backend and cache it.

**Files:**
- Modify: `~/hype-monitor/server/server.js`
- Add: `fetchCoinGeckoHistory()` function
- Cache: `~/hype-monitor/server/cache-coingecko.json`

**Step 1: Write failing test**
```javascript
// In a new test file or just concept — we'll test manually first
// But TDD says write test first. Let's create a simple test in same file?
// Actually, we'll add a test endpoint later. For now, add function and test via curl.
```

**Step 2: Add function to server.js**
```javascript
const CG_API = 'https://api.coingecko.com/api/v3';
const CG_ID = 'hyperliquid';

async function fetchCoinGeckoHistory() {
  const cacheFile = path.join(__dirname, 'cache-coingecko.json');
  // Check cache (1 hour)
  if (fs.existsSync(cacheFile)) {
    const stats = fs.statSync(cacheFile);
    if (Date.now() - stats.mtimeMs < 3600000) {
      return JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
    }
  }
  
  const url = `${CG_API}/coins/${CG_ID}/market_chart?vs_currency=usd&days=365&interval=daily`;
  const res = await fetch(url); // Note: need to add node-fetch or use https
  // Since we're in Node, we can use 'node:https' or install 'node-fetch'
  // Simpler: use 'curl' via exec (but that's hacky). Better install node-fetch.
  // We'll modify later. For now, use exec with curl.
  const { exec } = require('child_process');
  return new Promise((resolve, reject) => {
    exec(`curl -s "${url}"`, { timeout: 10000 }, (error, stdout) => {
      if (error) return reject(error);
      try {
        const data = JSON.parse(stdout);
        fs.writeFileSync(cacheFile, JSON.stringify(data));
        resolve(data);
      } catch (e) { reject(e); }
    });
  });
}
```

**Step 3: Install dependencies if needed**
Run: `cd ~/hype-monitor/server && npm install node-fetch`

**Step 4: Integrate into live-data endpoint**
Add after deriving derivData, fetch history and compute indicators.

**Step 5: Commit**
```bash
cd ~/hype-monitor && git add server/ && git commit -m "feat(backend): add CoinGecko history fetch for EMA/OBV calc"
```

---

## Task 2: Implement EMA calculation (20, 50, 200)

**Objective:** Calculate Exponential Moving Averages from historical prices and add to indicators.

**Files:**
- Modify: `~/hype-monitor/server/server.js` (add `calculateEMA()` and integrate)

**Step 1: Write failing test**
```javascript
function calculateEMA(prices, period) {
  // prices: array of numbers (most recent last)
  // EMA = price * (2/(period+1)) + prevEMA * (1 - 2/(period+1))
}
// Test: prices [1,2,3,4,5], period 2 => expect ~4.67
```

**Step 2: Implement calculateEMA**
```javascript
function calculateEMA(prices, period) {
  const k = 2 / (period + 1);
  // First EMA = SMA of first 'period' prices
  let ema = prices.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < prices.length; i++) {
    ema = prices[i] * k + ema * (1 - k);
  }
  return ema;
}
```

**Step 3: Add to transformTechnicalData or live-data endpoint**
After fetching history, compute EMA20, EMA50, EMA200 using closing prices.

**Step 4: Add to indicators object**
In `categories.trend` array, add:
```javascript
{ name: 'EMA(20)', value: ema20, action: ema20 > price ? 'buy' : 'sell', detail: `vs SMA20: ${((ema20/sma20-1)*100).toFixed(1)}%` }
```

**Step 5: Commit**
```bash
git commit -m "feat: add EMA(20/50/200) indicators with buy/sell signals"
```

---

## Task 3: Implement OBV (On-Balance Volume)

**Objective:** Calculate On-Balance Volume from historical price+volume data.

**Files:**
- Modify: `~/hype-monitor/server/server.js`

**Step 1: Write failing test**
```javascript
// OBV: if close > prev close, OBV = prev + volume; if close < prev close, OBV = prev - volume
function calculateOBV(closes, volumes) { ... }
```

**Step 2: Implement OBV**
```javascript
function calculateOBV(closes, volumes) {
  let obv = 0;
  for (let i = 1; i < closes.length; i++) {
    if (closes[i] > closes[i-1]) obv += volumes[i];
    else if (closes[i] < closes[i-1]) obv -= volumes[i];
  }
  return obv;
}
```

**Step 3: Add to indicators under volume category**
```javascript
{ name: 'OBV', value: obv, action: obv > 0 ? 'buy' : 'sell', detail: `Trend: ${obvTrend}` }
```

**Step 4: Commit**
```bash
git commit -m "feat: add OBV (On-Balance Volume) indicator"
```

---

## Task 4: Detect RSI Divergence (Bonus)

**Objective:** Detect price vs RSI divergence (higher high price + lower high RSI = bearish divergence).

**Files:**
- Modify: `~/hype-monitor/server/server.js`

**Approach:** Store last 14 RSI values and prices, look for divergence pattern. (Optional for this plan; can be skipped initially)

---

## Task 5: Install TradingView Lightweight Charts in frontend

**Objective:** Replace sparkline with interactive TradingView chart.

**Files:**
- Modify: `~/hype-monitor/package.json` (add dependency)
- Create: `~/hype-monitor/src/components/PriceChart.tsx`
- Modify: `~/hype-monitor/src/app/page.tsx` (integrate chart)

**Step 1: Install lightweight-charts**
Run: `cd ~/hype-monitor && npm install lightweight-charts`

**Step 2: Create PriceChart component**
```tsx
'use client';
import { createChart, ColorType } from 'lightweight-charts';
import { useEffect, useRef } from 'react';

export default function PriceChart({ history }: { history: { time: string; open: number; high: number; low: number; close: number }[] }) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (!chartContainerRef.current) return;
    const chart = createChart(chartContainerRef.current, { width: 800, height: 400 });
    const candlestickSeries = chart.addCandlestickSeries({ upColor: '#26a69a', downColor: '#ef5350' });
    candlestickSeries.setData(history);
    return () => chart.remove();
  }, [history]);
  
  return <div ref={chartContainerRef} />;
}
```

**Step 3: Pass history data from page.tsx**
Need to add history to the Data type and fetch from backend (or keep using CoinGecko in frontend).

**Step 4: Commit**
```bash
git commit -m "feat(frontend): add TradingView Lightweight Charts component"
```

---

## Task 6: Overlay EMA lines on chart

**Objective:** Display EMA20/50/200 as lines on the TradingView chart.

**Files:**
- Modify: `~/hype-monitor/src/components/PriceChart.tsx`

Add line series for each EMA.

---

## Final Integration & Testing

After all tasks:
1. Run backend: `cd ~/hype-monitor/server && node server.js`
2. Test API: `curl http://localhost:3001/api/live-data?timeframe=1d | jq '.indicators.trend'`
3. Verify EMA and OBV present.
4. Run frontend: `cd ~/hype-monitor && npm run dev`
5. Check chart displays with overlays.
6. Commit all changes.

---

**Remember:**
- Bite-sized tasks (2-5 min each)
- TDD where possible
- Frequent commits
- DRY, YAGNI
- Use subagent-driven-development for execution

*Created by Chupeta (Hermes Agent) on 2026-05-02*
