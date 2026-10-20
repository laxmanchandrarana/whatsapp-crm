#!/bin/bash
set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$PROJECT_ROOT/backend"
FRONTEND_DIR="$PROJECT_ROOT/frontend"
VENV_BIN="$BACKEND_DIR/venv/bin"

echo "=========================================================="
echo " Starting WhatsApp Business CRM (DoubleTick Alternative)  "
echo "=========================================================="

# Check venv
if [ ! -f "$VENV_BIN/python" ]; then
    echo "Creating python virtual environment..."
    python3 -m venv "$BACKEND_DIR/venv"
    "$VENV_BIN/pip" install --upgrade pip
    "$VENV_BIN/pip" install -r "$BACKEND_DIR/requirements.txt"
fi

# Apply migrations
echo "[1/4] Applying database migrations..."
cd "$BACKEND_DIR"
"$VENV_BIN/python" manage.py migrate

# Seed data if database is fresh
echo "[2/4] Ensuring demo CRM data is loaded..."
"$VENV_BIN/python" manage.py seed_crm_data

# Start Celery Worker (background) if redis is available, otherwise always_eager mode handles tasks
if command -v redis-server >/dev/null 2>&1; then
    if ! pgrep -x "redis-server" > /dev/null; then
        echo "Starting local redis-server..."
        redis-server --daemonize yes 2>/dev/null || true
    fi
fi

# Start Django backend
echo "[3/4] Starting Django API server on http://127.0.0.1:8000 ..."
"$VENV_BIN/python" manage.py runserver 0.0.0.0:8000 &
BACKEND_PID=$!

# Start Frontend
echo "[4/4] Starting React Vite Frontend on http://localhost:5173 ..."
cd "$FRONTEND_DIR"
if [ ! -d "node_modules" ]; then
    npm install
fi
npm run dev -- --host 0.0.0.0 &
FRONTEND_PID=$!

trap "echo 'Shutting down WhatsApp CRM services...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit 0" INT TERM

echo ""
echo "✅ WhatsApp CRM is running!"
echo "   - Web Inbox UI:      http://localhost:5173"
echo "   - Django REST API:    http://127.0.0.1:8000/api/"
echo "   - Webhook Ingestion:  http://127.0.0.1:8000/api/webhooks/whatsapp/"
echo "   - Django Admin:       http://127.0.0.1:8000/admin/"
echo "Press Ctrl+C to stop all servers."

wait
