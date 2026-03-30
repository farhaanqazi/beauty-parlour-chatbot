<div align="center">
  <h1>💇‍♀️ AI-Powered Salon & Beauty Parlour Chatbot</h1>
  <p>A full-stack, end-to-end salon management solution powered by intelligent AI chatbots, real-time analytics, and a beautiful Dark Craft UI.</p>
</div>

---

## 📖 Overview

The **Salon-chatbot** project is a comprehensive operational platform tailored for Modern Beauty Parlours and Salons. It removes the friction of manual appointment booking and empowers salon owners by bridging the gap between automated customer outreach and deep administrative control. 

This platform leverages Large Language Models (LLMs) to natively integrate with messaging channels (like WhatsApp and Telegram), providing customers with a 24/7 intelligent receptionist to book, reschedule, or cancel appointments. Meanwhile, salon owners receive a state-of-the-art interactive analytical dashboard to track their revenue, staff capacity, and daily bookings.

## 🚀 Key Features

### 🤖 Intelligent Chatbot Integration
- **Omni-Channel Support:** natively handles WhatsApp and Telegram chatbot webhooks.
- **LLM-Driven Conversations:** Uses natural language processing to converse with clients natively, schedule services, answer operational questions, and seamlessly map intentions to concrete appointments.
- **Context-Aware Memory:** Retains conversation histories to provide personalized follow-ups.

### 📊 Real-Time Administrative Dashboard
- **'Dark Craft' Premium Aesthetics:** Designed with a stunning, modern dark-mode-first aesthetic heavily relying on sleek Tailwind gradients, glassmorphism, and Lucide React micro-animations.
- **Live KPI Tracking:** Instant visibility into Today's Bookings, Expected Revenues, and Current Capacity.
- **Role-Based Access Control (RBAC):** Distinct application routing and data boundaries for `admins`, `salon_owners`, and `reception` accounts—all safely enforced by the backend API and protected frontend routes.

### 🛠️ Robust Technical Foundation
- **Scalable Asynchronous Architecture:** Built exclusively with asynchronous Python components utilizing Pydantic models for bulletproof validation.
- **Database Modularity:** Architecturally decoupled mappings through PostgreSQL endpoints capable of routing millions of historical appointments without N+1 query lag.

---

## 💻 Tech Stack

### Frontend Components
- **Framework:** React 19 bundled with [Vite](https://vitejs.dev/) for lightning-speed HMR.
- **Styling Mechanism:** Tailwind CSS (`@tailwindcss/vite`) utilizing custom aesthetic tokens.
- **State Management:** [Zustand](https://github.com/pmndrs/zustand) for global persistent authentication state bridging seamlessly with `localStorage`.
- **Data Fetching:** [TanStack React Query](https://tanstack.com/query/latest) mapping flawlessly onto Axios instances with integrated authentication interceptors.
- **Animations:** Framer Motion bindings overlaying Lucide React icons.

### Backend Elements
- **API Framework:** Contextual [FastAPI](https://fastapi.tiangolo.com/) setup with automatic Swagger UI documentation.
- **Database ORM:** [SQLAlchemy 2.0](https://www.sqlalchemy.org/) integrating asyncpg database sessions linked securely via Pydantic schema validation.
- **Database Engine & Auth:** Secure PostgreSQL hosting & JWT Authentication handled natively by [Supabase](https://supabase.com/).

---

## 📂 Architecture & Directory Structure

```text
Salon-chatbot/
├── app/                  # FastAPI Backend application logic
│   ├── api/             # HTTP endpoints and routing maps (Appointments, Analytics, Users)
│   ├── core/            # Environment configurations (settings, enums, exceptions)
│   ├── db/              # SQLAlchemy mapped models & asynchronous session definitions
│   └── services/        # Abstraction logic decoupling database processes from routing
│
└── frontend/             # Root Vite React application directory
    ├── src/
    │   ├── components/  # Isolated, dynamic React elements based on the Dark Craft framework
    │   ├── hooks/       # React Query hooks bridging TanStack and standard APIs
    │   ├── pages/       # Next-Gen top-level route pillars (LoginRedesigned, DashboardRedesigned)
    │   ├── services/    # Pure TypeScript API Axios interactions natively unpacking Pagination
    │   └── store/       # Zustand State Managers (specifically authStore mapping to Supabase tokens)
```

---

## ⚙️ Installation & Local Setup

### 1. Prerequisites
- Python 3.10+
- Node.js 18+ (npm or bun)
- A Supabase Project (PostgreSQL instance)

### 2. Environment Configurations
Rename the `.env.example` file in the root directory to `.env` and fill out your PostgreSQL API keys.

Do the same inside the `/frontend` directory by generating an `.env.local` containing:
```properties
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_API_URL=http://localhost:8000
```

### 3. Firing up the Backend
```bash
# From the project root simply activate the python environment and run:
start_backend.bat
```
*(This automatically boots the Uvicorn workers and exposes the Swagger API Documentation to `http://127.0.0.1:8000/docs`)*

### 4. Mounting the Dashboard
```bash
cd frontend
npm install
npm run dev
```
Navigate to `http://localhost:3000` to interact with the frontend.
