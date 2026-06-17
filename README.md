# Beauty Parlour Management System & AI Chatbot

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
![Python](https://img.shields.io/badge/Python-3.10+-0377cc.svg?logo=python&logoColor=white)
![React](https://img.shields.io/badge/React-19-20232A.svg?logo=react&logoColor=61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-007ACC.svg?logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-B73BA5.svg?logo=vite&logoColor=FFD62E)
![Tailwind](https://img.shields.io/badge/Tailwind-v4-38B2AC.svg?logo=tailwind-css&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-009688.svg?logo=fastapi&logoColor=white)
![Database](https://img.shields.io/badge/Database-PostgreSQL-316192.svg?logo=postgresql&logoColor=white)
![Deploy](https://img.shields.io/badge/Deploy-Supabase-3ECF8E.svg?logo=supabase&logoColor=white)
![Redis](https://img.shields.io/badge/Cache-Redis-DC382D.svg?logo=redis&logoColor=white)
![Groq](https://img.shields.io/badge/LLM-Groq-f55036.svg)

**A next-generation full-stack salon booking and management platform powered by LLMs.**

---

## 📖 Overview

The **Beauty Parlour Chatbot** is an all-in-one salon management ecosystem designed for modern beauty parlours. It features a **Groq LLM-powered chatbot** that autonomously handles appointment bookings through **Telegram** and **WhatsApp** webhooks, paired with a sleek **React dashboard** for staff, receptionists, and salon owners to manage daily operations.

From natural language understanding and multi-tenant support, to advanced analytics and role-based access, this system dramatically reduces administrative overhead and ensures a seamless customer booking experience.

## ✨ Key Features

- 🤖 **AI-Powered Chatbot**: Utilizes Groq LLM for language localization, free-text understanding, date/time extraction, and deterministic appointment scheduling.
- 📱 **Multi-Channel Integration**: Supports seamless booking flows through Telegram and WhatsApp webhooks.
- 🏢 **Multi-Tenant Architecture**: Robust support for multiple salons, allowing per-salon services, unique channels, notifications, and tailored dashboard experiences.
- 🔐 **Role-Based Access Control (RBAC)**: Distinct permissions for `admin`, `salon_owner`, and `reception` workflows powered by Supabase Auth.
- 📊 **Advanced Analytics Dashboard**: Track live appointments, staff utilization, revenue trends, customer KPIs, and service popularity in real-time.
- 🔄 **Real-Time State Management**: Chat sessions are persisted in Redis, while salon data is reliably stored in PostgreSQL/Supabase.
- ⚡ **Background Processing**: Dedicated workers handle automated reminders, cancellation notices, salon digests, and lifecycle state transitions.

## 🛠️ Tech Stack

### Frontend
- **Framework**: React 19 + TypeScript + Vite
- **Styling**: Tailwind CSS v4, Framer Motion
- **State Management**: Zustand, TanStack React Query
- **Authentication**: Supabase Auth
- **Icons**: Lucide React
- **Network**: Axios

### Backend
- **Framework**: FastAPI (Python 3.10+)
- **Database**: PostgreSQL (via Supabase), SQLAlchemy 2.x Async ORM, Alembic Migrations
- **Cache & Session**: Redis
- **AI / LLM**: Groq API
- **Channels**: Telegram & WhatsApp Business API adapters

---

## 📂 Repository Layout

```text
beauty_parlour_chatbot/
├── backend/                  # FastAPI Application
│   ├── alembic/              # Database migration configuration
│   ├── app/
│   │   ├── api/              # Route definitions (webhooks, appointments, users)
│   │   ├── core/             # Configuration & security settings
│   │   ├── db/               # SQLAlchemy models and session management
│   │   ├── flows/            # Conversational state machine
│   │   ├── llm/              # Groq adapter logic
│   │   ├── messaging/        # Telegram & WhatsApp adapters
│   │   ├── middleware/       # Rate limiting, security, request ID tracking
│   │   ├── redis/            # Redis connection pooling & session management
│   │   ├── services/         # Core business logic
│   │   └── workers/          # Background tasks for notifications
│   ├── sql/                  # Baseline schema and demo seed scripts
│   └── tests/                # Pytest suites
│
├── frontend/                 # React SPA Dashboard
│   └── src/
│       ├── components/       # Reusable UI elements & views
│       ├── hooks/            # Custom React hooks (Data & UI)
│       ├── pages/            # Dashboard routes
│       ├── services/         # API clients
│       ├── store/            # Zustand stores
│       └── types/            # Global TypeScript interfaces
│
└── start_backend.bat         # Quickstart script for Windows
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js**: v18+
- **Python**: v3.10+
- **Database**: PostgreSQL / Supabase project
- **Cache**: Redis server
- **APIs**: Groq API Key, Telegram Bot Credentials, WhatsApp Business API credentials

### 1. Backend Setup

Configure your environment variables:

```powershell
cd backend
copy .env.example .env
```

*Update `.env` with your `DATABASE_URL`, `REDIS_URL`, `SUPABASE_URL`, `GROQ_API_KEY`, and Webhook details.*

Create a virtual environment and install dependencies:

```powershell
python -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt
```

Run database migrations:

```powershell
alembic upgrade head
```

Start the API server:

```powershell
# Standard start
python -m app.run_api

# Or use the provided script from root
..\start_backend.bat
```

*The API will be available at `http://localhost:8000/docs`.*

Start the Background Worker Pool (in a separate terminal):

```powershell
cd backend
.\venv\Scripts\activate
python -m app.workers.run_pool
```

### 2. Frontend Setup

Configure your environment variables:

```powershell
cd frontend
copy .env.example .env
```

*Update `.env` with `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and `VITE_API_URL`.*

Install and start the dashboard:

```powershell
npm install
npm run dev
```

*The dashboard will be available at `http://localhost:3000`.*

---

## 🔐 Authentication & Roles

Authentication is backed by **Supabase Auth**.

- `admin`: Full platform control. Can manage salons, users, and global settings.
- `salon_owner`: Complete access to their specific salon's appointments, services, analytics, and staff.
- `reception`: Access to daily appointment workflows, customer records, and front-desk management for assigned salons.

---

## 🤖 Chatbot Architecture

The backend handles natural conversation states efficiently:
1. Validates webhook origin (WhatsApp/Telegram).
2. Identifies user and loads conversational state from **Redis**.
3. Evaluates intent using the **Groq LLM** combined with a deterministic state machine.
4. Walks the user through the booking process (Language → Customer Details → Service → Date/Time → Confirmation).
5. Persists the final appointment into **PostgreSQL** and schedules reminder jobs.

---

## 📜 License

Distributed under the MIT License. See `LICENSE` for more information.
