#!/bin/bash
# LiveLabs - Simple Stop Script
# Only kills processes on ports 3004 and 8003 that are NOT docker

cd "$(dirname "$0")"

echo "Stopping LiveLabs..."

# Stop backend on 8003
PID=$(netstat -tlnp 2>/dev/null | grep ":8003 " | grep -v docker | awk '{print $7}' | cut -d'/' -f1)
if [ -n "$PID" ]; then
  echo "  Stopping backend (PID $PID)..."
  kill $PID 2>/dev/null
fi

# Stop frontend on 3004
PID=$(netstat -tlnp 2>/dev/null | grep ":3004 " | grep -v docker | awk '{print $7}' | cut -d'/' -f1)
if [ -n "$PID" ]; then
  echo "  Stopping frontend (PID $PID)..."
  kill $PID 2>/dev/null
fi

echo "Done."
