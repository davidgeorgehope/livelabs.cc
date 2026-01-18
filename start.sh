#!/bin/bash
# LiveLabs - Start Script
# Ports: Frontend 3004, Backend 8003

set -e
cd "$(dirname "$0")"

echo "Starting LiveLabs..."

# Check if already running
check_port() {
  ss -tlnp 2>/dev/null | grep -q ":$1 " || netstat -tlnp 2>/dev/null | grep -q ":$1 "
}

# Backend
if ! check_port 8003; then
  echo "  Starting backend on :8003..."
  cd backend
  source venv/bin/activate
  nohup venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8003 > /tmp/livelabs-backend.log 2>&1 &
  BACKEND_PID=$!
  cd ..
  sleep 2
  if check_port 8003; then
    echo "  Backend started (PID $BACKEND_PID)"
  else
    echo "  ERROR: Backend failed to start. Check /tmp/livelabs-backend.log"
    exit 1
  fi
else
  echo "  Backend already running on :8003"
fi

# Frontend
if ! check_port 3004; then
  echo "  Building frontend..."
  cd frontend
  npm run build > /tmp/livelabs-frontend-build.log 2>&1
  echo "  Starting frontend on :3004..."
  nohup npm run start -- -p 3004 > /tmp/livelabs-frontend.log 2>&1 &
  FRONTEND_PID=$!
  cd ..
  sleep 3
  if check_port 3004; then
    echo "  Frontend started (PID $FRONTEND_PID)"
  else
    echo "  ERROR: Frontend failed to start. Check /tmp/livelabs-frontend.log"
    exit 1
  fi
else
  echo "  Frontend already running on :3004"
fi

echo ""
echo "LiveLabs running at: http://localhost:3004"
echo "Logs: /tmp/livelabs-backend.log, /tmp/livelabs-frontend.log"
