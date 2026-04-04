# 🚀 CI/CD Implementation Plan
## Beauty Parlour Chatbot - Production Readiness Roadmap

**Current Status:** ~70-75% Production Ready  
**Target Status:** 95%+ Production Ready  
**Estimated Implementation Time:** 2-3 weeks

---

## 📋 Executive Summary

This plan addresses the **critical CI/CD gap** identified in the production readiness assessment. Implementing this roadmap will provide:

- ✅ Automated testing on every commit
- ✅ Containerized deployments with Docker
- ✅ Staging and production environments
- ✅ Automated deployments via GitHub Actions
- ✅ Quality gates (linting, type checking, tests)
- ✅ Rollback capabilities

---

## 🎯 Phase 1: Foundation (Week 1)

### 1.1 Docker Containerization 🔴 **CRITICAL**

**Goal:** Create consistent, reproducible environments for local development and production.

#### Files to Create:

```
f:\beauty_parlour_chatbot\
├── Dockerfile.backend          # Backend API container
├── Dockerfile.frontend         # Frontend React container
├── docker-compose.yml          # Local development orchestration
├── docker-compose.prod.yml     # Production orchestration
└── .dockerignore               # Docker ignore rules
```

#### Dockerfile.backend Specification:
```dockerfile
# Multi-stage build for Python FastAPI backend
- Stage 1: Builder (install dependencies)
- Stage 2: Production (minimal runtime image)
- Python 3.10+ slim base image
- Non-root user for security
- Health check endpoint integration
- Environment variable configuration
```

#### Dockerfile.frontend Specification:
```dockerfile
# Multi-stage build for React 19 + Vite frontend
- Stage 1: Builder (Node.js 18+)
- Stage 2: Nginx/Apache static file server
- Environment variable injection at build time
- Gzip/Brotli compression enabled
```

#### docker-compose.yml (Development):
```yaml
Services:
  - backend: FastAPI on port 8000
  - frontend: Vite dev server on port 3000
  - redis: Redis for sessions
  - db: PostgreSQL (optional, if not using Supabase)
  - ngrok: Tunnel for webhook testing
```

#### docker-compose.prod.yml (Production):
```yaml
Services:
  - backend: Uvicorn workers with Gunicorn
  - frontend: Nginx serving built assets
  - redis: Persistent Redis
  - traefik: Reverse proxy with Let's Encrypt
```

---

### 1.2 GitHub Actions Workflows 🔴 **CRITICAL**

**Goal:** Automated CI pipeline for quality assurance.

#### Files to Create:

```
f:\beauty_parlour_chatbot\.github\
└── workflows\
    ├── ci.yml                  # Main CI pipeline
    ├── cd-staging.yml          # Deploy to staging
    ├── cd-production.yml       # Deploy to production
    ├── docker-build.yml        # Docker image building
    └── security-scan.yml       # Dependency security scanning
```

#### ci.yml Pipeline Stages:

```yaml
Name: CI Pipeline
On: [push, pull_request]

Jobs:
  1. lint-backend:
     - Python: ruff, black, mypy
     - Fail on errors
     
  2. lint-frontend:
     - ESLint, TypeScript check
     - Fail on errors
     
  3. test-backend:
     - pytest with coverage
     - Minimum 70% coverage required
     
  4. test-frontend:
     - vitest/jest tests
     - Component testing
     
  5. build-backend:
     - Docker build verification
     
  6. build-frontend:
     - npm run build verification
     
  7. security-scan:
     - pip-audit for Python
     - npm audit for Node.js
```

---

### 1.3 Test Suite Expansion 🔴 **CRITICAL**

**Goal:** Increase test coverage from ~5% to 70%+.

#### Current State:
- ✅ 1 test file: `test_telegram_webhook.py`
- ❌ No API endpoint tests
- ❌ No service layer tests
- ❌ No database integration tests
- ❌ No frontend component tests

#### Test Files to Create:

**Backend Tests:**
```
Beauty_Parlour_chatbot-\tests\
├── __init__.py
├── conftest.py                 # Pytest fixtures and configuration
├── test_api\
│   ├── __init__.py
│   ├── test_appointments.py
│   ├── test_users.py
│   ├── test_analytics.py
│   ├── test_webhooks.py
│   └── test_health.py
├── test_services\
│   ├── __init__.py
│   ├── test_webhook_service.py
│   ├── test_conversation_service.py
│   ├── test_appointment_service.py
│   └── test_llm_service.py
├── test_flows\
│   ├── __init__.py
│   ├── test_booking_flow.py
│   ├── test_reschedule_flow.py
│   └── test_cancel_flow.py
├── test_db\
│   ├── __init__.py
│   └── test_models.py
└── test_workers\
    └── test_notification_worker.py
```

**Frontend Tests:**
```
frontend\
├── src\
│   ├── components\
│   │   └── __tests__\
│   │       ├── AppointmentForm.test.tsx
│   │       ├── Dashboard.test.tsx
│   │       └── Login.test.tsx
│   └── services\
│       └── __tests__\
│           └── api.test.ts
└── vitest.config.ts
```

#### Testing Dependencies to Add:

**Backend (requirements-test.txt):**
```txt
pytest==8.0.0
pytest-asyncio==0.23.0
pytest-cov==4.1.0
pytest-mock==3.12.0
httpx==0.28.1
faker==21.0.0
```

**Frontend (package.json devDependencies):**
```json
{
  "vitest": "^1.0.0",
  "@testing-library/react": "^14.0.0",
  "@testing-library/jest-dom": "^6.0.0",
  "@testing-library/user-event": "^14.0.0",
  "jsdom": "^23.0.0",
  "@vitest/coverage-v8": "^1.0.0"
}
```

---

## 🎯 Phase 2: Deployment Infrastructure (Week 2)

### 2.1 Environment Configuration 🔴 **CRITICAL**

**Goal:** Secure, separated environments for development, staging, and production.

#### Files to Create:

```
f:\beauty_parlour_chatbot\
├── .env.example              # ✅ Already exists
├── .env.example              # Template for all environments
├── .env.development          # Local development (git-ignored)
├── .env.staging              # Staging environment (git-ignored)
├── .env.production           # Production environment (git-ignored)
└── .github\
    └── environments\
        ├── staging.yml       # Staging environment config
        └── production.yml    # Production environment config
```

#### GitHub Environments Setup:

1. **Staging Environment:**
   - Auto-deploy on merge to `develop` branch
   - Separate Supabase project (or schema)
   - Test Groq/Telegram/WhatsApp integrations
   - Required reviewers: None

2. **Production Environment:**
   - Manual approval required
   - Production Supabase project
   - Real API keys
   - Required reviewers: 1-2 team members

---

### 2.2 Database Migrations 🟠 **HIGH**

**Goal:** Safe, versioned database schema changes.

#### Files to Create:

```
Beauty_Parlour_chatbot-\
├── alembic\
│   ├── versions\
│   │   ├── 001_initial_schema.py
│   │   └── (future migrations)
│   ├── env.py
│   └── script.py.mako
├── alembic.ini
└── run_migration.py          # ✅ Already exists
```

#### Migration Strategy:

```bash
# Development
alembic upgrade head

# Production (via CI/CD)
- Pre-deployment migration check
- Backup database
- Run migrations
- Deploy application
- Health check verification
```

#### Dependencies to Add:
```txt
alembic==1.13.0
```

---

### 2.3 Monitoring & Logging 🟠 **HIGH**

**Goal:** Observability for production issues.

#### Files to Create:

```
Beauty_Parlour_chatbot-\app\
├── core\
│   └── logging_config.py     # Structured logging setup
└── services\
    └── monitoring.py         # Metrics collection
```

#### Logging Configuration:
```python
# Structured JSON logging
{
  "timestamp": "2026-03-31T12:00:00Z",
  "level": "ERROR",
  "service": "backend",
  "message": "Webhook processing failed",
  "context": {
    "user_id": "12345",
    "channel": "telegram"
  }
}
```

#### Monitoring Integrations:

| Tool | Purpose | Priority |
|------|---------|----------|
| **Sentry** | Error tracking | 🟠 High |
| **Prometheus** | Metrics collection | 🟡 Medium |
| **Grafana** | Dashboards | 🟡 Medium |
| **Health Checks** | Uptime monitoring | 🟠 High |

#### Sentry Setup:
```bash
pip install sentry-sdk[fastapi]
```

```python
# app/core/sentry_config.py
import sentry_sdk
from sentry_sdk.integrations.fastapi import FastApiIntegration

sentry_sdk.init(
    dsn=os.getenv("SENTRY_DSN"),
    integrations=[FastApiIntegration()],
    traces_sample_rate=0.1,
    environment=os.getenv("ENVIRONMENT", "development")
)
```

---

### 2.4 Rate Limiting & Security 🟠 **HIGH**

**Goal:** Protect API from abuse and attacks.

#### Files to Create:

```
Beauty_Parlour_chatbot-\app\
├── api\
│   └── middleware\
│       ├── __init__.py
│       ├── rate_limiter.py
│       └── security.py
└── core\
    └── security_config.py
```

#### Rate Limiting Strategy:

```python
# Using slowapi or fastapi-limiter
from slowapi import SlowAPI, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

limiter = SlowAPI(storage_key=functools.partial(get_redis_storage, redis_url))

# Apply to webhook endpoints (most vulnerable)
@router.post("/webhooks/telegram")
@limiter.limit("100/minute")
async def telegram_webhook(request: Request):
    ...
```

#### Rate Limits by Endpoint:

| Endpoint | Limit | Reason |
|----------|-------|--------|
| `/api/v1/webhooks/*` | 100/min | External API calls |
| `/api/v1/auth/*` | 10/min | Prevent brute force |
| `/api/v1/appointments` | 60/min | Normal user activity |
| `/api/v1/analytics` | 30/min | Heavy queries |

---

## 🎯 Phase 3: Deployment & Operations (Week 3)

### 3.1 Deployment Workflows 🟠 **HIGH**

**Goal:** One-click deployments with rollback capability.

#### cd-staging.yml:
```yaml
Name: Deploy to Staging
On:
  push:
    branches: [develop]

Jobs:
  deploy-staging:
    - Build Docker images
    - Push to GitHub Container Registry
    - Deploy to staging server (SSH/Action)
    - Run database migrations
    - Health check verification
    - Notify Slack/Teams on success/failure
```

#### cd-production.yml:
```yaml
Name: Deploy to Production
On:
  workflow_dispatch:  # Manual trigger
  push:
    branches: [main]

Jobs:
  deploy-production:
    environment: production
    - Manual approval required
    - Build Docker images
    - Push to GitHub Container Registry
    - Deploy to production server
    - Run database migrations
    - Health check verification
    - Create GitHub release tag
    - Notify team on success/failure
```

---

### 3.2 Backup & Recovery 🟡 **MEDIUM**

**Goal:** Data safety and disaster recovery.

#### Files to Create:

```
f:\beauty_parlour_chatbot\
├── scripts\
│   ├── backup-db.sh
│   ├── restore-db.sh
│   └── backup-redis.sh
└── docs\
    └── DISASTER_RECOVERY.md
```

#### Backup Strategy:

| Data | Frequency | Retention | Method |
|------|-----------|-----------|--------|
| PostgreSQL | Daily | 30 days | Supabase automatic + manual |
| Redis | Hourly | 7 days | RDB snapshots |
| Logs | Continuous | 90 days | Log aggregation service |

---

### 3.3 Documentation Updates 🟡 **MEDIUM**

**Goal:** Clear operational runbooks.

#### Files to Create:

```
f:\beauty_parlour_chatbot\docs\
├── DEPLOYMENT.md           # Step-by-step deployment guide
├── OPERATIONS.md           # Daily operations checklist
├── TROUBLESHOOTING.md      # Common issues and solutions
├── API_RATE_LIMITS.md      # Rate limiting documentation
└── SECURITY.md             # Security best practices
```

#### DEPLOYMENT.md Contents:
```markdown
# Deployment Guide

## Prerequisites
- GitHub account with repo access
- Supabase project credentials
- Groq API key
- Telegram/WhatsApp bot tokens

## First-Time Setup
1. Fork/clone repository
2. Configure GitHub environments
3. Set up Supabase database
4. Configure environment secrets
5. Run initial deployment

## Routine Deployment
1. Create pull request
2. CI pipeline runs automatically
3. Merge to develop → staging deploy
4. Test in staging
5. Merge to main → production deploy (with approval)
```

---

## 📊 Implementation Timeline

| Week | Phase | Deliverables |
|------|-------|--------------|
| **Week 1** | Foundation | Docker files, GitHub Actions CI, Test suite structure |
| **Week 2** | Infrastructure | Environment configs, Alembic migrations, Monitoring, Rate limiting |
| **Week 3** | Operations | CD workflows, Backup scripts, Documentation |

---

## 🔧 Technology Stack Summary

### CI/CD Tools
| Tool | Purpose | Cost |
|------|---------|------|
| **GitHub Actions** | CI/CD pipelines | Free (2000 min/month) |
| **GitHub Container Registry** | Docker image storage | Free (500MB) |

### Containerization
| Tool | Purpose |
|------|---------|
| **Docker** | Container runtime |
| **docker-compose** | Local orchestration |
| **Traefik** | Production reverse proxy |

### Testing
| Tool | Purpose |
|------|---------|
| **pytest** | Backend testing |
| **vitest** | Frontend testing |
| **pytest-cov** | Coverage reporting |

### Monitoring
| Tool | Purpose | Cost |
|------|---------|------|
| **Sentry** | Error tracking | Free (5K errors/month) |
| **Health Checks** | Uptime monitoring | Free tier available |

---

## ✅ Success Criteria

### Phase 1 Completion:
- [ ] Docker containers build and run successfully
- [ ] CI pipeline runs on every push
- [ ] Test coverage reaches 40%+
- [ ] All linting passes

### Phase 2 Completion:
- [ ] Staging environment deployed automatically
- [ ] Database migrations versioned and automated
- [ ] Structured logging implemented
- [ ] Rate limiting active on webhooks
- [ ] Sentry error tracking active

### Phase 3 Completion:
- [ ] Production deployments with manual approval
- [ ] Backup scripts tested and documented
- [ ] Test coverage reaches 70%+
- [ ] All documentation complete
- [ ] Team trained on new workflows

---

## 🚨 Risk Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| **Breaking changes in migrations** | High | Always test on staging first, backup before production |
| **Docker image bloat** | Medium | Use multi-stage builds, minimal base images |
| **CI/CD pipeline failures** | Medium | Maintain manual deployment fallback |
| **Secrets exposure** | Critical | Use GitHub Secrets, never commit .env files |
| **Rate limiting false positives** | Medium | Monitor and adjust limits based on usage patterns |

---

## 📈 Next Steps

1. **Immediate (Today):**
   - Review and approve this plan
   - Prioritize which phases to implement first

2. **Short-term (This Week):**
   - Create Docker configuration (Phase 1.1)
   - Set up basic CI pipeline (Phase 1.2)

3. **Medium-term (Next 2 Weeks):**
   - Expand test coverage (Phase 1.3)
   - Implement monitoring (Phase 2.3)

4. **Long-term (Next Month):**
   - Complete all phases
   - Achieve 95%+ production readiness

---

## 🎯 Recommendation

**Start with Phase 1.1 (Docker)** as it provides immediate value:
- Consistent local development environment
- Foundation for automated deployments
- Solves the "works on my machine" problem

Would you like me to proceed with implementing any specific phase? I can:

1. ✨ **Create Docker configuration** (highest priority)
2. 🧪 **Set up GitHub Actions CI pipeline**
3. 📝 **Expand test suite structure**
4. 🔒 **Implement rate limiting**
5. 📊 **Add monitoring/logging**

Let me know which you'd like to tackle first!
