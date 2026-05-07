# Beauty Parlour Chatbot

A full-stack salon booking and management system for beauty parlours. The project combines a FastAPI backend for chatbot-driven appointment booking with a React dashboard for staff and owners.

## What It Does

- Handles appointment booking through Telegram and WhatsApp webhooks.
- Stores live chat sessions in Redis and persistent salon data in PostgreSQL/Supabase.
- Uses a deterministic booking flow, with Groq LLM support for language localization, free-text understanding, option matching, and date/time extraction fallback.
- Supports multi-tenant salons with per-salon services, channel configuration, notification contacts, and dashboard users.
- Provides a role-based dashboard for `admin`, `salon_owner`, and `reception` users.
- Tracks appointments, services, customers, users, KPIs, revenue trends, appointment analytics, staff utilization, and customer analytics.
- Runs background workers for reminders, cancellation notices, salon digests, and appointment lifecycle updates.

## Tech Stack

### Backend

- FastAPI
- SQLAlchemy 2.x async ORM
- PostgreSQL/Supabase
- Redis
- Alembic migrations
- Groq LLM API
- Telegram and WhatsApp channel adapters

### Frontend

- React 19
- TypeScript
- Vite
- Tailwind CSS v4
- TanStack React Query
- Zustand
- Axios
- Supabase Auth
- Framer Motion / `motion`
- Lucide React icons

## Repository Layout

```text
beauty_parlour_chatbot/
  backend/
    app/
      api/          FastAPI routes for webhooks, appointments, analytics, users, salons, customers
      core/         settings, enums, logging config
      db/           SQLAlchemy session and models
      flows/        rule-based conversation engine and handlers
      llm/          Groq adapter
      messaging/    Telegram and WhatsApp adapters
      middleware/   request ID, timing, rate limiting, security headers, exception handling
      redis/        Redis client and conversation state store
      services/     appointment, tenant, webhook, notification, email, conversation services
      workers/      notification and lifecycle worker processes
    alembic/        Alembic migration setup
    sql/            baseline SQL, demo seed data, verification and legacy migration scripts
    tests/          backend tests
  frontend/
    src/
      components/   shared UI, auth, appointments, analytics, customers, dashboard components
      hooks/        data and UI hooks
      pages/        app routes and dashboard pages
      services/     API clients and Supabase client
      store/        Zustand auth and theme stores
      types/        shared TypeScript types
  start_backend.bat Windows shortcut for starting the backend
```

## Main Backend Endpoints

The API is mounted under `/api/v1`.

- `POST /api/v1/webhooks/telegram/{salon_slug}`
- `GET /api/v1/webhooks/whatsapp/{salon_slug}`
- `POST /api/v1/webhooks/whatsapp/{salon_slug}`
- `GET /api/v1/salons/{salon_slug}/entry-links`
- `GET /api/v1/appointments`
- `POST /api/v1/appointments`
- `PATCH /api/v1/appointments/{appointment_id}/status`
- `POST /api/v1/appointments/{appointment_id}/cancel`
- `GET /api/v1/salons`
- `GET /api/v1/users`
- `GET /api/v1/customers`
- `GET /api/v1/analytics/kpis`
- `GET /api/v1/analytics/revenue/trends`

Health checks:

- `GET /health`
- `GET /health/ready`

FastAPI docs are available at:

```text
http://localhost:8000/docs
```

## Frontend Routes

- `/login`
- `/dashboard`
- `/salon-select`
- `/admin/dashboard`
- `/admin/users`
- `/owner/dashboard`
- `/owner/appointments`
- `/owner/services`
- `/owner/services/new`
- `/reception/dashboard`
- `/customers`
- `/customers/:customerId`
- `/analytics`
- `/reports`

Routes are protected with role checks and Supabase-backed authentication.

## Prerequisites

- Python 3.10+
- Node.js 18+
- PostgreSQL or Supabase PostgreSQL
- Redis
- A Groq API key for LLM-assisted chatbot behavior
- Telegram bot credentials if Telegram is enabled
- WhatsApp Business API credentials if WhatsApp is enabled

## Backend Setup

Create and configure the backend environment:

```powershell
cd backend
copy .env.example .env
```

Important backend variables:

```env
DATABASE_URL=postgresql+asyncpg://...
REDIS_URL=redis://localhost:6379/0
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
SUPABASE_JWT_SECRET=...
GROQ_API_KEY=...
WEBHOOK_BASE_URL=https://your-public-webhook-url
WHATSAPP_VERIFY_TOKEN=...
WHATSAPP_ACCESS_TOKEN=...
WHATSAPP_PHONE_NUMBER_ID=...
TELEGRAM_BOT_NAME=...
```

Install Python dependencies:

```powershell
cd backend
python -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt
```

Apply database setup:

- For a fresh Supabase project, use the scripts in `backend/sql/` and follow `backend/sql/README.md`.
- For schema changes after the baseline, use Alembic from `backend/`.

```powershell
cd backend
alembic upgrade head
```

Start the backend:

```powershell
cd backend
python -m app.run_api
```

Or from the repository root on Windows:

```powershell
.\start_backend.bat
```

The backend runs on `http://localhost:8000` by default.

## Worker Setup

Run background workers separately from the API:

```powershell
cd backend
python -m app.workers.run_pool
```

The worker pool handles notification jobs and appointment lifecycle transitions.

## Frontend Setup

Create and configure the frontend environment:

```powershell
cd frontend
copy .env.example .env
```

Important frontend variables:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=...
VITE_API_URL=http://localhost:8000
```

Install dependencies and run the dashboard:

```powershell
cd frontend
npm install
npm run dev
```

The frontend runs on `http://localhost:3000`.

## Authentication And Roles

The frontend signs users in with Supabase Auth. The backend validates Bearer tokens through the Supabase admin client, then loads the matching dashboard user from the local `users` table.

Supported roles:

- `admin`: platform-level access, salon selection, user management, and admin dashboard routes.
- `salon_owner`: access to salon dashboard, services, appointments, analytics, reports, and own salon data.
- `reception`: access to reception workflows, appointment management, customer records, and permitted salon data.

## Chatbot Flow

The backend resolves the salon from the webhook URL slug, loads or creates the customer, restores conversation state from Redis, runs the flow engine, writes confirmed appointments to PostgreSQL, schedules notification jobs, and sends replies through the original messaging channel.

The booking flow covers:

1. Greeting and main menu
2. Language selection
3. Customer details
4. Marriage type
5. Service selection
6. Sample image preference
7. Appointment date
8. Appointment time
9. Contact details
10. Confirmation
11. Appointment creation

The management flow supports selecting existing appointments and handling appointment changes or cancellations.

## Database Notes

- `backend/sql/schema.sql` is the baseline schema reference.
- `backend/sql/seed_demo.sql` contains demo data.
- `backend/sql/verify_migration.sql` checks applied database objects.
- Alembic manages future migrations from `backend/alembic/`.
- Appointment datetimes are stored as `TIMESTAMPTZ` in UTC and rendered using salon timezones.
- Conversation sessions live in Redis and expire according to `SESSION_TTL_SECONDS`.

## Build And Test Commands

Backend:

```powershell
cd backend
python -m pytest
```

Frontend:

```powershell
cd frontend
npm run build
npm run lint
```

Production-style frontend serving is supported by building `frontend/dist`; when that folder exists, the FastAPI app serves the built SPA for non-API routes.

## More Documentation

- Backend details: `backend/README.md`
- SQL setup: `backend/sql/README.md`
- Alembic playbook: `backend/alembic/README.md`
- Logging notes: `backend/docs/LOGGING.md`
- Future database plan: `backend/docs/FUTURE_DB_PLAN.md`
