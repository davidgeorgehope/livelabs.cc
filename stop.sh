#!/bin/bash
# LiveLabs - Stop Script
# Stops processes on ports 3004 and 8003 and cleans up Docker containers

cd "$(dirname "$0")"

echo "Stopping LiveLabs..."

# Find PID on port (works with ss or netstat)
get_pid() {
  local port=$1
  local pid=""
  # Try ss first
  pid=$(ss -tlnp 2>/dev/null | grep ":$port " | grep -oP 'pid=\K[0-9]+' | head -1)
  # Fallback to netstat
  if [ -z "$pid" ]; then
    pid=$(netstat -tlnp 2>/dev/null | grep ":$port " | awk '{print $7}' | cut -d'/' -f1 | head -1)
  fi
  echo "$pid"
}

# Stop backend
BACKEND_PID=$(get_pid 8003)
if [ -n "$BACKEND_PID" ] && [ "$BACKEND_PID" != "-" ]; then
  echo "  Stopping backend (PID $BACKEND_PID)..."
  kill "$BACKEND_PID" 2>/dev/null && echo "  Backend stopped" || echo "  Failed to stop backend"
else
  echo "  Backend not running"
fi

# Stop frontend
FRONTEND_PID=$(get_pid 3004)
if [ -n "$FRONTEND_PID" ] && [ "$FRONTEND_PID" != "-" ]; then
  echo "  Stopping frontend (PID $FRONTEND_PID)..."
  kill "$FRONTEND_PID" 2>/dev/null && echo "  Frontend stopped" || echo "  Failed to stop frontend"
else
  echo "  Frontend not running"
fi

# Clean up Docker containers created by LiveLabs (only those with app=livelabs label)
echo "  Cleaning up LiveLabs containers..."
CONTAINERS=$(docker ps -aq --filter "label=app=livelabs" 2>/dev/null)
if [ -n "$CONTAINERS" ]; then
  COUNT=$(echo "$CONTAINERS" | wc -l)
  docker rm -f $CONTAINERS >/dev/null 2>&1
  echo "  Removed $COUNT container(s)"
else
  echo "  No LiveLabs containers to clean up"
fi

echo "Done."
