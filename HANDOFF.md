# 📋 Beauty Parlour Chatbot — Session Handoff Document

> **Generated:** 2026-04-10
> **Project:** Beauty Parlour Appointment Booking Chatbot
> **Stack:** FastAPI + PostgreSQL (Supabase) + Redis + Groq LLM (qwen/qwen3-1.5b) + React Frontend

---

## 1. Project Overview

A multi-tenant, multi-channel AI chatbot that lets customers book beauty parlour appointments via **WhatsApp** and **Telegram**. Features a 9-step conversational booking flow, automated notifications, analytics API, and a dashboard frontend.

**Codebase root:** `f:\beauty_parlour_chatbot\Beauty_Parlour_chatbot-\app\`
**Frontend root:** `f:\beauty_parlour_chatbot\frontend\src\`

---

## 2. Architecture

```
Telegram/WhatsApp → Webhook → FastAPI API → Conversation Engine → Redis State
                                            ↓
                                    Tenant Service (salon/customer resolution)
                                            ↓
                                    Appointment Service (DB creation + notifications)
                                            ↓
                                    Message Dispatcher → Telegram/WhatsApp Transport
```

**Key modules:**
- `app/api/` — REST endpoints (webhooks, appointments, users, analytics)
- `app/services/` — Business logic (appointment, conversation, tenant, notification)
- `app/flows/engine.py` — State machine for booking conversation
- `app/llm/service.py` — LLM calls (classification, date/time parsing, translation)
- `app/messaging/` — WhatsApp + Telegram transports + dispatcher
- `app/workers/` — Notification polling worker
- `app/redis/state_store.py` — Redis conversation state
- `app/middleware/` — Request ID + exception handling (pure ASGI)
- `app/core/logging_config.py` — Structured logging with request ID tracing

---

## 3. Current Feature Audit

### 3.1 Booking Flow — BASIC
| Exists | Status |
|--------|--------|
| 9-step linear flow (Greeting → Language → Marriage Type → Service → Sample Images → Date → Time → Confirmation → Complete) | ✅ |
| LLM-powered date/time parsing (natural language: "tomorrow at 3pm") | ✅ |
| 4-language support (English, Hindi, Hinglish, Telugu) with LLM translation | ✅ |
| Reset tokens (hi, hello, restart, menu) | ✅ |
| Per-salon flow config overrides (JSONB) | ✅ |
| Attempt count tracking | ✅ |
| Past-time rejection | ✅ |

| Missing | Priority |
|---------|----------|
| **Availability checking / conflict detection** | 🔴 P0 |
| **Business hours enforcement** | 🔴 P0 |
| Rescheduling via chat | 🟡 P1 |
| Cancellation via chat | 🟡 P1 |
| Multi-service booking | 🟡 P1 |
| Staff/stylist selection | 🟢 P2 |
| Deposit/prepayment | 🟢 P2 |
| Waiting list | 🟢 P2 |

### 3.2 LLM Usage — BASIC
| Exists | Status |
|--------|--------|
| `classify_option()` — matches free text to known options | ✅ |
| `parse_date()` — extracts date from natural language | ✅ |
| `parse_time()` — extracts time from natural language | ✅ |
| `localize_text()` — translates outbound messages | ✅ |
| Temperature=0 for determinism | ✅ |
| Graceful degradation when LLM unavailable | ✅ |

| Missing | Priority |
|---------|----------|
| **Intent detection engine** (classify ALL user messages) | 🔴 P0 |
| Multi-LLM fallback chain | 🟡 P1 |
| Prompt injection guardrails | 🟡 P1 |
| Token usage tracking / cost monitoring | 🟡 P1 |
| Sentiment analysis for escalation | 🟢 P2 |
| Response caching for repeated queries | 🟢 P2 |

### 3.3 Channels — MODERATE
| Exists | Status |
|--------|--------|
| WhatsApp Business API (text + images + buttons) | ✅ |
| Telegram Bot API (text + photos) | ✅ |
| Per-salon channel config | ✅ |
| QR deep links (t.me/, wa.me/) | ✅ |

| Missing | Priority |
|---------|----------|
| **Webhook signature verification** (Telegram + WhatsApp) | 🔴 P0 |
| Instagram DM | 🟢 P2 |
| Facebook Messenger | 🟢 P2 |
| Web widget / embedded chat | 🟢 P2 |
| Interactive WhatsApp templates | 🟢 P2 |

### 3.4 User Management — MODERATE
| Exists | Status |
|--------|--------|
| 3 roles: admin, salon_owner, reception | ✅ |
| JWT via Supabase Auth | ✅ |
| Role-based access control | ✅ |
| Tenant isolation | ✅ |
| User CRUD (admin only) | ✅ |

| Missing | Priority |
|---------|----------|
| **Rate limiting on all endpoints** | 🔴 P0 |
| MFA/2FA | 🟡 P1 |
| Session management / logout | 🟡 P1 |
| Audit log for user actions | 🟡 P1 |

### 3.5 Notifications — MODERATE
| Exists | Status |
|--------|--------|
| 4 types: customer 60m, customer 15m, salon 60m, salon 15m | ✅ |
| Polling worker with retry + exponential backoff | ✅ |
| Stale job recovery | ✅ |
| Graceful shutdown | ✅ |
| LLM-localized notification text | ✅ |

| Missing | Priority |
|---------|----------|
| Event-driven queue (replace polling) | 🟡 P1 |
| 24-hour reminder | 🟡 P1 |
| No-show follow-up | 🟢 P2 |
| Feedback request after appointment | 🟢 P2 |
| Push/email/SMS channels | 🟢 P2 |

### 3.6 Analytics — GOOD
| Exists | Status |
|--------|--------|
| 10 API endpoints (KPIs, revenue, staff utilization, customer metrics) | ✅ |
| Role-aware filtering + tenant isolation | ✅ |
| Cancellation rate tracking | ✅ |

| Missing | Priority |
|---------|----------|
| Conversion rate (chat → booking) | 🟡 P1 |
| Drop-off analysis per step | 🟡 P1 |
| Export (CSV, PDF) | 🟢 P2 |
| Real-time dashboard UI | 🟢 P2 |

### 3.7 Payment — NONE
| Missing | Priority |
|---------|----------|
| **No payment processing at all** | 🟡 P1 |
| Deposit collection | 🟡 P1 |
| Invoicing / receipts | 🟢 P2 |
| Refund handling | 🟢 P2 |

### 3.8 Multi-Tenant — GOOD
| Exists | Status |
|--------|--------|
| Full tenant isolation (salon_id on all data) | ✅ |
| Row Level Security (RLS) policies | ✅ |
| Per-salon config, timezone, language | ✅ |
| Per-salon flow config overrides | ✅ |
| Webhook URL includes salon_slug | ✅ |

| Missing | Priority |
|---------|----------|
| Self-signup / onboarding | 🟢 P2 |
| Custom domains | 🟢 P2 |
| White-labeling | 🟢 P2 |

### 3.9 Error Handling & Logging — MODERATE → GOOD (recently fixed)
| Exists | Status |
|--------|--------|
| Pure ASGI RequestIDMiddleware (no ExceptionGroup bug) | ✅ |
| ServerErrorMiddleware replacement for global exception catching | ✅ |
| CompactFormatter for app.log (no tracebacks) | ✅ |
| error.log with full tracebacks | ✅ |
| Rotating file handlers (10MB, 5 backups) | ✅ |
| JSON log format (optional) | ✅ |
| Log sanitizer (passwords, tokens redacted) | ✅ |
| Structured logging across all critical paths | ✅ |
| Redis error logging | ✅ |
| Webhook error logging | ✅ |
| Conversation operation tracking | ✅ |

| Missing | Priority |
|---------|----------|
| Sentry integration | 🟡 P1 |
| Circuit breaker for external APIs | 🟡 P1 |
| Retry on outbound message sends | 🟡 P1 |
| Dead letter queue | 🟢 P2 |
| Alerting (Slack, PagerDuty) | 🟢 P2 |

### 3.10 Security — MODERATE (needs hardening)
| Exists | Status |
|--------|--------|
| JWT + RLS + role-based auth | ✅ |
| CORS configuration | ✅ |
| Request ID audit trails | ✅ |
| Structured security event logging | ✅ |
| Debug endpoints disabled in production | ✅ |

| Missing | Priority |
|---------|----------|
| **Rate limiting** | 🔴 P0 |
| **Webhook signature verification** | 🔴 P0 |
| **Input sanitization for LLM prompts** | 🔴 P0 |
| **Security headers middleware** | 🔴 P0 |
| PII redaction in logs | 🟡 P1 |
| GDPR compliance (data deletion, consent) | 🟡 P1 |
| Secret rotation | 🟢 P2 |

### 3.11 Internationalization — MODERATE
| Exists | Status |
|--------|--------|
| 4 languages with LLM translation | ✅ |
| Per-salon default language | ✅ |
| Timezone-aware dates | ✅ |
| Multilingual YES/NO tokens | ✅ |

| Missing | Priority |
|---------|----------|
| Static translation files (fallback) | 🟡 P1 |
| Auto language detection | 🟢 P2 |
| RTL language support | 🟢 P2 |

---

## 4. Known Issues

| Issue | Status |
|-------|--------|
| Redis not running on dev machine — causes webhook 500 errors | ⚠️ Known |
| Frontend has 18 dead/unused files | ⚠️ Known |
| No frontend structured logging (46 console.* calls) | ⚠️ Known |
| No appointment availability checking (double bookings possible) | 🔴 Critical |
| No business hours enforcement | 🟡 Important |
| `create_user` endpoint doesn't create Supabase Auth users (TODO in code) | ⚠️ Known |

---

## 5. Competitive Benchmark

| Feature | Your App | Syntalith | Crowdy.ai | Fresha |
|---------|----------|-----------|-----------|--------|
| 24/7 automated booking | ✅ | ✅ | ✅ | ✅ |
| Multi-channel | ✅ 2 | ✅ 5 | ✅ 3+ | ✅ Web+app |
| LLM NLP | ✅ Basic | ✅ Advanced | ✅ Advanced | ✅ |
| Payment processing | ❌ | ✅ | ✅ | ✅ |
| Rescheduling via chat | ❌ | ✅ | ✅ | ✅ |
| Cancellation via chat | ❌ | ✅ | ✅ | ✅ |
| Real-time availability | ❌ | ✅ | ✅ | ✅ |
| Upselling | ❌ | ✅ | ✅ | ❌ |
| Customer feedback | ❌ | ✅ | ✅ | ✅ |
| Rate limiting | ❌ | ✅ | ✅ | ✅ |
| Webhook security | ❌ | ✅ | ✅ | ✅ |
| GDPR compliance | ❌ | ✅ | ✅ | ✅ |
| Multi-language | ✅ 4 | ✅ 30+ | ✅ | ✅ |
| Human handoff | ❌ | ✅ | ✅ | ✅ |
| Multi-service booking | ❌ | ✅ | ✅ | ✅ |
| Deposit collection | ❌ | ✅ | ✅ | ✅ |

---

## 6. Upgrade Roadmap

### Phase 1: Critical Fixes (Week 1-2)
1. **Rate limiting** (slowapi) on all endpoints
2. **Webhook signature verification** (Telegram + WhatsApp)
3. **Security headers middleware** (CSP, HSTS, X-Frame-Options)
4. **Input sanitization for LLM prompts**
5. **Availability checking** — query existing appointments before confirming
6. **Business hours enforcement** — reject bookings outside operating hours
7. PII redaction in logs
8. Idempotency keys for webhooks

### Phase 2: Advanced LLM (Week 3-4)
1. **Intent Detection Engine** — classify EVERY message (START_BOOKING, RESCHEDULE, CANCEL, INQUIRE_PRICING, COMPLAIN, etc.)
2. **Multi-slot pre-filling** — "book bridal makeup tomorrow at 3" fills service+date+time in one message
3. **Multi-LLM fallback chain** — Groq qwen → Groq llama → rule-based
4. **LLM guardrails** — prompt injection detection, input length limits, response validation
5. **Token usage tracking** — cost monitoring per conversation

### Phase 3: Revenue & Retention (Week 5-6)
1. **Stripe integration** — deposits before confirmation
2. **Payment status tracking** on appointments
3. **Upselling engine** — add-on prompts during booking
4. **Customer feedback loop** — post-appointment rating + escalation

### Phase 4: Advanced Features (Week 7-8)
1. **Rescheduling via chat** — "change my appointment"
2. **Cancellation via chat** — "cancel booking BP-XXXX"
3. **Human handoff** — queue messages for salon staff
4. **Smart scheduling** — conflict detection, buffer time, smart alternatives
5. **Multi-service booking** — book 2+ services per session

### Phase 5: Production Readiness (Week 9-10)
1. **Sentry integration** — real-time error alerting
2. **Conversion tracking** — chat started → booking completed
3. **Drop-off analysis** — which step loses users
4. **Event-driven notifications** — replace polling with ARQ
5. **Circuit breakers** — graceful degradation
6. **GDPR compliance** — data deletion, export, consent

---

## 7. File Locations

### Backend (FastAPI)
| File | Purpose |
|------|---------|
| `app/main.py` | App entry, middleware registration, exception handlers |
| `app/core/logging_config.py` | Structured logging, CompactFormatter, request ID |
| `app/core/config.py` | Pydantic settings |
| `app/core/enums.py` | Enums (roles, statuses, notification types) |
| `app/middleware/request_id.py` | Pure ASGI request ID middleware |
| `app/middleware/exception_handler.py` | Global exception handler (ServerErrorMiddleware replacement) |
| `app/utils/logger.py` | StructuredLogger class with track_operation |
| `app/utils/log_sanitizer.py` | Sensitive data redaction |
| `app/api/webhooks.py` | WhatsApp + Telegram webhook endpoints |
| `app/api/appointments.py` | Appointment CRUD (dashboard) |
| `app/api/users.py` | User management |
| `app/api/analytics.py` | 10 analytics endpoints |
| `app/api/deps.py` | Auth dependencies (JWT, roles) |
| `app/services/conversation_service.py` | Main conversation orchestration |
| `app/services/appointment_service.py` | Appointment creation + notification scheduling |
| `app/services/tenant_service.py` | Salon/customer resolution |
| `app/services/webhook_service.py` | Webhook normalization |
| `app/flows/engine.py` | State machine for booking flow |
| `app/llm/service.py` | LLM calls (classify, parse_date, parse_time, localize) |
| `app/messaging/dispatcher.py` | Channel routing |
| `app/messaging/whatsapp.py` | WhatsApp transport |
| `app/messaging/telegram.py` | Telegram transport |
| `app/redis/state_store.py` | Redis state management |
| `app/workers/notification_worker.py` | Polling notification worker |
| `app/db/session.py` | Database engine + session factory |
| `app/db/models/` | SQLAlchemy models |
| `app/schemas/` | Pydantic schemas |

### Frontend (React)
| File | Purpose |
|------|---------|
| `frontend/src/App.tsx` | Main app, routing |
| `frontend/src/hooks/useAuth.ts` | Auth hook (20 console.* calls) |
| `frontend/src/services/apiClient.ts` | Axios client with interceptors |
| `frontend/src/components/dashboard/NewAppointmentModal.tsx` | Dashboard booking form |
| `frontend/src/pages/DashboardRedesigned.tsx` | Main dashboard |

### 18 Dead Frontend Files (to delete)
- `components/auth/LoginForm.tsx` (replaced by LoginFormRedesigned)
- `components/common/Input.tsx`, `Button.tsx`, `Breadcrumbs.tsx`, `Header.tsx`, `Sidebar.tsx`, `GlobalSearch.tsx`, `NotificationBell.tsx`
- `components/common/skeletons/CardSkeleton.tsx`, `TableSkeleton.tsx`
- `components/appointments/CreateAppointmentDialog.tsx`, `CreateAppointmentForm.tsx`, `UpdateStatusDialog.tsx`, `CancelAppointmentDialog.tsx`, `AppointmentStatusChip.tsx`
- `hooks/useKeyboardShortcuts.ts`, `hooks/useKpis.ts`
- `constants/appointmentTransitions.ts`

---

## 8. Environment Variables

| Variable | Purpose | Default |
|----------|---------|---------|
| `DATABASE_URL` | PostgreSQL connection (Supabase) | Required |
| `REDIS_URL` | Redis connection | `redis://localhost:6379/0` |
| `GROQ_API_KEY` | LLM provider key | None (LLM disabled) |
| `GROQ_MODEL` | LLM model | `qwen/qwen3-1.5b` |
| `TELEGRAM_BOT_TOKEN` | Telegram bot auth | None |
| `TELEGRAM_BOT_NAME` | Telegram bot username | None |
| `WHATSAPP_ACCESS_TOKEN` | WhatsApp API token | None |
| `WHATSAPP_PHONE_NUMBER_ID` | WhatsApp phone ID | None |
| `WHATSAPP_VERIFY_TOKEN` | Webhook verification | `default_verify_token` |
| `ENVIRONMENT` | dev/staging/prod | `development` |
| `APP_DEBUG` | Debug mode | `false` |
| `LOG_JSON` | JSON log format | `false` |
| `WEBHOOK_BASE_URL` | Base URL for webhooks | `http://farburgh.duckdns.org:8000` |
| `DEFAULT_SALON_SLUG` | Default salon | `demo-beauty-palace` |

---

## 9. Database Schema (Key Tables)

| Table | Purpose |
|-------|---------|
| `salons` | Salon info, timezone, language, slug |
| `salon_channels` | Per-salon WhatsApp/Telegram config |
| `salon_services` | Service catalog with prices |
| `salon_notification_contacts` | Who gets salon digests |
| `salon_closures` | Closed dates per salon |
| `customers` | Customer profiles per salon |
| `appointments` | Bookings with status, reference, snapshot |
| `notification_jobs` | Queued notification tasks |
| `users` | Dashboard users (admin/owner/reception) |
| `inbound_messages` | All incoming messages |
| `outbound_messages` | All outgoing messages |

---

## 10. How to Start the App

```bash
# Backend
cd f:\beauty_parlour_chatbot\Beauty_Parlour_chatbot-
f:\beauty_parlour_chatbot\venv\Scripts\uvicorn.exe app.main:app --host 0.0.0.0 --port 8000

# Frontend (separate terminal)
cd f:\beauty_parlour_chatbot\frontend
npm run dev

# View logs
f:\beauty_parlour_chatbot\Beauty_Parlour_chatbot-\view_logs.bat
```

---

## 11. Logging System Status

| Component | Status |
|-----------|--------|
| Request ID middleware (pure ASGI) | ✅ Working |
| Structured logging (all critical paths) | ✅ Working |
| CompactFormatter (app.log — no tracebacks) | ✅ Working |
| error.log (full tracebacks) | ✅ Working |
| Log sanitizer | ✅ Working |
| Exception handler (ServerErrorMiddleware replacement) | ✅ Working |
| Redis error logging | ✅ Working |
| Webhook error logging | ✅ Working |
| Sentry | ❌ Not implemented |
| Frontend structured logging | ❌ Not implemented |

---

## 12. Next Steps (If Starting Fresh)

1. **Read this document** for full context
2. **Start Redis** (currently not running on dev machine — causes 500s on webhooks)
3. **Implement Phase 1** critical fixes (rate limiting, webhook security, availability checking)
4. **Then Phase 2** (Intent Detection Engine — biggest differentiator)
5. **Clean up frontend** dead files
6. **Add Sentry** for production monitoring

---

*End of handoff document.*
