#!/bin/bash
cd /root/hype-monitor/server

# Kill existing
pkill -f "node server.js" 2>/dev/null
sleep 2

# Start server
node server.js > /tmp/server_out.log 2>&1 &
SERVER_PID=$!
echo "Server started with PID: $SERVER_PID"

# Wait for server to be ready
for i in $(seq 1 10); do
  if curl -s "http://localhost:3001/health" > /dev/null 2>&1; then
    echo "Server is ready!"
    break
  fi
  sleep 1
done

# Test the API
echo ""
echo "=== Testing API ==="
curl -s "http://localhost:3001/api/live-data?timeframe=1d" 2>/dev/null | jq '{
  price: .price,
  market_cap: .market_cap,
  total_volume: .total_volume,
  bid: .bid,
  ask: .ask,
  open_interest: .open_interest,
  funding_rate: .funding_rate,
  rsi: .rsi,
  signal_score: .signal_score
}'

echo ""
echo "=== Server still running? ==="
kill -0 $SERVER_PID 2>/dev/null && echo "YES" || echo "NO"

# Don't kill the server - let it run
echo ""
echo "Server PID $SERVER_PID is still running. Test with:"
echo "  curl http://localhost:3001/api/live-data?timeframe=1d"
