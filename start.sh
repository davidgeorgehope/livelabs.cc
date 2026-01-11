#!/bin/bash
# LiveLabs - Simple Start Script
# Ports: Frontend 3004, Backend 8003

cd "$(dirname "$0")"

echo "Starting LiveLabs..."

# Backend
if ! netstat -tlnp 2>/dev/null | grep -q ":8003 "; then
  echo "  Starting backend on 8003..."
  cd backend && source venv/bin/activate
  nohup uvicorn app.main:app --host 127.0.0.1 --port 8003 > /tmp/livelabs-backend.log 2>&1 &
  cd ..
  sleep 2
else
  echo "  Backend already running on 8003"
fi

# Frontend (production mode - much less memory usage)
if ! netstat -tlnp 2>/dev/null | grep -q ":3004 "; then
  echo "  Building frontend..."
  cd frontend
  npm run build > /tmp/livelabs-frontend-build.log 2>&1
  echo "  Starting frontend on 3004 (production mode)..."
  nohup npm run start -- -p 3004 > /tmp/livelabs-frontend.log 2>&1 &
  cd ..
  sleep 3
else
  echo "  Frontend already running on 3004"
fi

echo "Done. Check: http://localhost:3004"
