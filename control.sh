#!/bin/bash
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$PROJECT_ROOT/backend"
FRONTEND_DIR="$PROJECT_ROOT/frontend"
VENV_BIN="$BACKEND_DIR/venv/bin"

BACKEND_PID_FILE="/tmp/whatsapp_crm_backend.pid"
CELERY_PID_FILE="/tmp/whatsapp_crm_celery.pid"
FRONTEND_PID_FILE="/tmp/whatsapp_crm_frontend.pid"

BACKEND_LOG="/tmp/whatsapp_crm_backend.log"
CELERY_LOG="/tmp/whatsapp_crm_celery.log"
FRONTEND_LOG="/tmp/whatsapp_crm_frontend.log"

case "$1" in
  start)
    echo "Starting WhatsApp CRM services..."

    # 1. Start Django
    if ! pgrep -f "manage.py runserver 0.0.0.0:8000" > /dev/null; then
      cd "$BACKEND_DIR"
      setsid nohup "$VENV_BIN/python" manage.py runserver 0.0.0.0:8000 < /dev/null > "$BACKEND_LOG" 2>&1 &
      echo $! > "$BACKEND_PID_FILE"
      echo "  - Django Backend started on port 8000"
    else
      echo "  - Django Backend is already running"
    fi

    # 2. Start Celery Worker
    if ! pgrep -f "celery -A whatsapp_crm worker" > /dev/null; then
      cd "$BACKEND_DIR"
      setsid nohup "$VENV_BIN/celery" -A whatsapp_crm worker -l info < /dev/null > "$CELERY_LOG" 2>&1 &
      echo $! > "$CELERY_PID_FILE"
      echo "  - Celery Worker started"
    else
      echo "  - Celery Worker is already running"
    fi

    # 3. Start Frontend (production preview daemon)
    if ! pgrep -f "port 5174" > /dev/null; then
      cd "$FRONTEND_DIR"
      if [ ! -d "dist" ]; then
        npm run build
      fi
      setsid nohup ./node_modules/.bin/vite preview --host 0.0.0.0 --port 5174 < /dev/null > "$FRONTEND_LOG" 2>&1 &
      echo $! > "$FRONTEND_PID_FILE"
      echo "  - React Vite Frontend started on port 5174"
    else
      echo "  - React Vite Frontend is already running"
    fi
    ;;

  stop)
    echo "Stopping WhatsApp CRM services..."
    pkill -f "manage.py runserver 0.0.0.0:8000" || true
    pkill -f "celery -A whatsapp_crm worker" || true
    pkill -f "port 5174" || true
    rm -f "$BACKEND_PID_FILE" "$CELERY_PID_FILE" "$FRONTEND_PID_FILE"
    echo "All WhatsApp CRM processes stopped."
    ;;

  restart)
    $0 stop
    sleep 2
    $0 start
    ;;

  status)
    echo "WhatsApp CRM Service Status:"
    echo -n "  Backend (Django 8000):  "
    pgrep -f "manage.py runserver 0.0.0.0:8000" > /dev/null && echo "RUNNING" || echo "STOPPED"
    echo -n "  Worker (Celery):        "
    pgrep -f "celery -A whatsapp_crm worker" > /dev/null && echo "RUNNING" || echo "STOPPED"
    echo -n "  Frontend (Vite 5174):   "
    pgrep -f "port 5174" > /dev/null && echo "RUNNING" || echo "STOPPED"
    ;;

  logs)
    tail -n 20 "$BACKEND_LOG" "$CELERY_LOG" "$FRONTEND_LOG"
    ;;

  *)
    echo "Usage: $0 {start|stop|restart|status|logs}"
    exit 1
    ;;
esac
