# WhatsApp Business API CRM (DoubleTick Alternative) with Human-in-the-Loop AI Approval Queue

A high-performance WhatsApp CRM designed for fast-paced customer engagement, support, and sales teams. Built with **Django REST Framework**, **Celery**, **Redis**, **Meta WhatsApp Cloud API**, and a modern **React (Vite + Tailwind CSS)** dual/three-pane inbox.

---

## 🌟 Key Features

1. **Meta WhatsApp Cloud API Webhook Ingestion**:
   - Webhook verification challenge handler (`GET /api/webhooks/whatsapp/`).
   - Secure payload ingestion (`POST /api/webhooks/whatsapp/`) with timing-safe `X-Hub-Signature-256` HMAC-SHA256 signature validation.
   - Non-blocking async ingestion via Celery workers for sub-200ms Meta webhook response guarantees.
   - Real-time updates for delivery receipts (`SENT`, `DELIVERED`, `READ`, `FAILED`).

2. **Human-in-the-Loop AI Approval Queue**:
   - Automated intent detection and risk scoring (`0.0` safe to `1.0` critical).
   - High-sensitivity customer intents (e.g. refunds, chargebacks, legal disputes, contract pricing discounts, VIP cancellations) are drafted by AI but held in `ApprovalQueue` with `PENDING_APPROVAL` status.
   - Supervisors and agents review the draft, edit responses inline, and trigger a **1-click approve & dispatch** to the customer's WhatsApp.
   - Safe / low-risk queries (e.g. FAQ hours, general greetings) can be configured to auto-reply immediately.

3. **DoubleTick-Style 3-Pane Web Inbox**:
   - **Left Pane**: Filterable conversation list (`All`, `Needs Approval`, `Open`, `Closed`), live unread badges, full-text search, and risk alert indicators.
   - **Center Pane**: Real-time WhatsApp chat timeline with direction bubbles, status checkmarks (single check, double check, blue read checkmarks), customer info header, and quick template launcher.
   - **Right Slide-out Drawer**: AI Approval Queue drawer displaying risk score meters, intent tags, editable draft textarea, 1-click approve, and rejection workflows with audit trail.
   - **Interactive Webhook Simulator**: Built-in simulator modal to test incoming customer messages and observe risk scoring without needing ngrok or a live WhatsApp phone number.

---

## 🏗️ Architecture & Project Structure

```
whatsapp_crm/
├── backend/
│   ├── manage.py
│   ├── requirements.txt
│   ├── .env.example
│   ├── whatsapp_crm/
│   │   ├── settings.py         # Django settings, Celery, CORS & Meta configs
│   │   ├── celery.py           # Celery application configuration
│   │   ├── urls.py             # Root URL routing
│   │   └── wsgi.py
│   └── crm_core/
│       ├── models.py           # Contact, Conversation, Message, ApprovalQueue, Template
│       ├── signature.py        # X-Hub-Signature-256 verification utility
│       ├── whatsapp_client.py  # Meta Cloud API client (with simulated & live mode)
│       ├── tasks.py            # Celery async tasks (dispatch, webhook, AI evaluation)
│       ├── serializers.py      # DRF serializers
│       ├── views.py            # REST API ViewSets & Webhook endpoints
│       ├── urls.py             # App-level routes
│       ├── admin.py            # Django Admin registration
│       ├── management/commands/
│       │   └── seed_crm_data.py # Demo database seeder
│       └── tests/
│           ├── test_webhook.py  # Verification & signature tests
│           ├── test_approval.py # AI risk evaluation & approve/reject tests
│           └── test_api.py      # API endpoints tests
├── frontend/
│   ├── package.json
│   ├── vite.config.js          # Vite configuration with API proxy
│   ├── tailwind.config.js
│   ├── src/
│   │   ├── App.jsx             # Main 3-pane dashboard container
│   │   ├── services/api.js     # API service layer
│   │   └── components/
│   │       ├── Sidebar.jsx             # Navigation bar & quick tools
│   │       ├── ConversationList.jsx    # Left conversation list with filters
│   │       ├── ChatTimeline.jsx        # Center timeline with message bubbles
│   │       ├── ApprovalDrawer.jsx      # Right drawer for AI approval queue
│   │       ├── TemplateModal.jsx       # Meta template selection modal
│   │       └── SimulateWebhookModal.jsx# Inbound webhook simulator
├── docker-compose.yml          # Full-stack container orchestration
├── start.sh                    # One-command local startup script
└── README.md
```

---

## 🗄️ Data Models

### 1. `Contact`
- `phone_number` (CharField, unique, indexed): Customer WhatsApp number in E.164 format.
- `name` (CharField): Customer name.
- `tags` (JSONField): List of labels (e.g. `["VIP", "Enterprise", "Dispute"]`).
- `metadata` (JSONField): Flexible CRM metadata (company, MRR, source, custom attributes).

### 2. `Conversation`
- `contact` (ForeignKey -> Contact).
- `status` (`OPEN`, `PENDING_APPROVAL`, `CLOSED`).
- `assigned_agent` (CharField): Team member handling the chat.
- `unread_count` (PositiveIntegerField): Unread badge counter.
- `last_message_at` (DateTimeField): Timestamp of the most recent message.

### 3. `Message`
- `conversation` (ForeignKey -> Conversation).
- `direction` (`INBOUND`, `OUTBOUND`).
- `message_type` (`TEXT`, `TEMPLATE`, `IMAGE`, `DOCUMENT`, `AUDIO`, `VIDEO`, `INTERACTIVE`).
- `content` (TextField): Message body text or media caption.
- `status` (`DRAFT`, `PENDING_APPROVAL`, `APPROVED`, `REJECTED`, `SENT`, `DELIVERED`, `READ`, `FAILED`).
- `meta_message_id` (CharField, indexed): Meta's unique identifier (`wamid.HBgL...`).
- `raw_payload` (JSONField): Raw WhatsApp Cloud API response or incoming webhook object.

### 4. `ApprovalQueue`
- `message` (OneToOneField -> Message): Linked draft message pending human sign-off.
- `intent` (CharField): Detected intent (e.g. `refund_dispute`, `enterprise_pricing_discount`).
- `risk_score` (FloatField): Model confidence/risk rating (`0.0` to `1.0`).
- `suggested_response` (TextField): Suggested text draft.
- `approved_by` / `approved_at` / `rejection_reason`.
- `is_resolved` (BooleanField, indexed).

### 5. `MessageTemplate`
- `name` (CharField, unique): Pre-approved WhatsApp template identifier.
- `category` (`MARKETING`, `UTILITY`, `AUTHENTICATION`).
- `language` (CharField, default `'en_US'`).
- `components` (JSONField): Header, Body, Footer, and Action buttons.
- `meta_status` (`APPROVED`, `PENDING`, `REJECTED`).

---

## ⚡ Celery Async Task Pipeline

1. **`process_webhook_payload(payload)`**:
   - Meta sends incoming POST requests to `/api/webhooks/whatsapp/`.
   - The view quickly validates the `X-Hub-Signature-256` header and passes execution to `process_webhook_payload.delay(payload)`.
   - Updates message delivery statuses (`DELIVERED`, `READ`), creates contacts, creates inbound messages, and triggers AI evaluation.

2. **`evaluate_ai_response_and_approval(inbound_message_id)`**:
   - Classifies customer message intent using domain heuristics and calculates a risk score.
   - If `risk_score >= 0.50`, generates a suggested response, creates a draft message with status `PENDING_APPROVAL`, registers an `ApprovalQueue` item, and flags the conversation.
   - If `risk_score < 0.50`, auto-generates a low-risk answer and dispatches it directly.

3. **`dispatch_outbound_meta_message(message_id)`**:
   - Communicates with Meta WhatsApp Cloud API (`https://graph.facebook.com/v20.0/{phone_number_id}/messages`).
   - Supports text and pre-approved template messages.
   - When `WHATSAPP_SIMULATE_OUTBOUND=True`, simulates realistic Meta Cloud API responses with synthetic `wamid` IDs for smooth local development.

---

## 🚀 Quickstart & Running Locally

### Option A: One-Command Startup Script

Run the automated launcher:
```bash
chmod +x start.sh
./start.sh
```
This automatically sets up Python virtual environments, applies database migrations, seeds realistic demo data, launches Django on `http://127.0.0.1:8000`, and starts the React Vite UI on `http://localhost:5173`.

### Option B: Docker Compose

```bash
docker-compose up --build
```
Spins up:
- Redis (`6379`)
- Django Backend (`8000`)
- Celery Worker
- React Vite Frontend (`5173`)

### Option C: Manual Setup

1. **Backend**:
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py seed_crm_data
python manage.py runserver 0.0.0.0:8000
```

2. **Celery Worker** (optional in dev; `CELERY_ALWAYS_EAGER=True` can also be used):
```bash
celery -A whatsapp_crm worker -l info
```

3. **Frontend**:
```bash
cd frontend
npm install
npm run dev
```

Visit **http://localhost:5173** to access the dashboard.

---

## 🧪 Testing

Run the automated backend test suite:
```bash
cd backend
venv/bin/python manage.py test crm_core
```

Tests cover:
- Meta Webhook verification handshake (`hub.challenge` & token checks).
- `X-Hub-Signature-256` HMAC-SHA256 generation and timing-safe validation.
- Inbound webhook message ingestion and conversation matching.
- AI risk scoring and automatic `ApprovalQueue` routing.
- Approval workflow (editing suggested response, marking `APPROVED`, triggering dispatch).
- Rejection workflow (recording rejection reason and marking `REJECTED`).
- REST API list, filter, and message dispatch endpoints.

---

## 📡 REST API Reference

| Endpoint | Method | Description |
|---|---|---|
| `GET /api/webhooks/whatsapp/` | GET | Meta Webhook Verification Challenge handshake |
| `POST /api/webhooks/whatsapp/` | POST | Ingests real-time events from Meta WhatsApp Cloud API |
| `POST /api/webhooks/whatsapp/simulate/` | POST | Helper endpoint to simulate inbound customer messages in dev/QA |
| `GET /api/conversations/` | GET | List conversations (`?status=OPEN|PENDING_APPROVAL|CLOSED&search=...`) |
| `GET /api/conversations/<id>/` | GET | Retrieve conversation details with nested messages |
| `POST /api/conversations/<id>/mark-read/` | POST | Resets unread counter to 0 |
| `GET /api/messages/?conversation_id=<id>` | GET | List messages for a specific conversation |
| `POST /api/messages/` | POST | Send an outbound text or template message |
| `GET /api/approvals/` | GET | List pending approval queue items (`?resolved=false`) |
| `POST /api/approvals/<id>/approve/` | POST | Approve AI draft (optional `edited_text`, `approved_by`) and dispatch |
| `POST /api/approvals/<id>/reject/` | POST | Reject AI draft with `rejection_reason` |
| `GET /api/templates/` | GET | List Meta pre-approved WhatsApp templates |
| `GET /api/contacts/` | GET | List & search CRM contacts |
| `GET /api/stats/` | GET | Dashboard metrics (open chats, pending approvals, delivery rates) |

---

## 🛡️ Meta Cloud API Configuration (.env)

Configure in `backend/.env`:
```env
WHATSAPP_API_TOKEN=EAA...
WHATSAPP_PHONE_NUMBER_ID=1092837465...
WHATSAPP_BUSINESS_ACCOUNT_ID=987654321...
WHATSAPP_VERIFY_TOKEN=openmausbot_crm_verify_token_secure
WHATSAPP_APP_SECRET=a1b2c3d4e5f6...
WHATSAPP_SIMULATE_OUTBOUND=False # Set to True for dev without Meta balance
```
