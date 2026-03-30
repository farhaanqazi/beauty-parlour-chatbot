---
name: docker
description: Use when containerizing applications with Docker. Creates Dockerfile, docker-compose.yml, and .dockerignore for Node.js, Python, FastAPI, and other common stacks.
---

# Docker Skill

Containerize applications with production-ready Docker configurations.

## When to Use

- Containerizing a new application
- Setting up local development with Docker Compose
- Creating multi-stage builds for smaller images
- Debugging container issues
- Optimizing Docker images

## Dockerfile Patterns

### Node.js Application

```dockerfile
# Production-optimized Node.js Dockerfile
FROM node:20-alpine AS base

# Install dependencies (cached layer)
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --only=production

# Build stage (if needed)
FROM base AS builder
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
COPY . .
RUN npm run build

# Production image
FROM base AS runner
WORKDIR /app

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nodejs

# Copy files
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./

# Set ownership
RUN chown -R nodejs:nodejs /app

USER nodejs

EXPOSE 3000

CMD ["node", "dist/index.js"]
```

### Python Application

```dockerfile
# Production Python Dockerfile
FROM python:3.11-slim AS base

# Install dependencies
FROM base AS deps
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir --user -r requirements.txt

# Build stage (if needed)
FROM base AS builder
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir --user -r requirements.txt
COPY . .

# Production image
FROM base AS runner
WORKDIR /app

# Create non-root user
RUN useradd --create-home --shell /bin/bash appuser

# Copy files
COPY --from=deps /root/.local /home/appuser/.local
COPY --from=builder /app .

# Set environment
ENV PATH=/home/appuser/.local/bin:$PATH
RUN chown -R appuser:appuser /app

USER appuser

EXPOSE 8000

CMD ["python", "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### FastAPI Application

```dockerfile
# FastAPI with Uvicorn
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application
COPY . .

# Create non-root user
RUN useradd --create-home --shell /bin/bash appuser
RUN chown -R appuser:appuser /app
USER appuser

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "4"]
```

### Next.js Application

```dockerfile
# Next.js with standalone output
FROM node:20-alpine AS base

# Install dependencies
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

# Build
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# Production
FROM base AS runner
WORKDIR /app

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nodejs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nodejs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nodejs:nodejs /app/.next/static ./.next/static

USER nodejs

EXPOSE 3000

ENV NODE_ENV=production
ENV PORT=3000

CMD ["node", "server.js"]
```

## Docker Compose Patterns

### Node.js + PostgreSQL

```yaml
version: '3.8'

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=postgresql://postgres:postgres@db:5432/myapp
      - NODE_ENV=development
    volumes:
      - .:/app
      - /app/node_modules
    depends_on:
      db:
        condition: service_healthy
    command: npm run dev

  db:
    image: postgres:15-alpine
    volumes:
      - postgres_data:/var/lib/postgresql/data
    environment:
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=postgres
      - POSTGRES_DB=myapp
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  postgres_data:
```

### Python + Redis + PostgreSQL

```yaml
version: '3.8'

services:
  api:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "8000:8000"
    environment:
      - DATABASE_URL=postgresql://postgres:postgres@db:5432/myapp
      - REDIS_URL=redis://redis:6379/0
    volumes:
      - .:/app
    depends_on:
      - db
      - redis
    command: uvicorn main:app --reload --host 0.0.0.0 --port 8000

  db:
    image: postgres:15-alpine
    volumes:
      - postgres_data:/var/lib/postgresql/data
    environment:
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=postgres
      - POSTGRES_DB=myapp

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data
    ports:
      - "6379:6379"

  worker:
    build:
      context: .
      dockerfile: Dockerfile
    environment:
      - DATABASE_URL=postgresql://postgres:postgres@db:5432/myapp
      - REDIS_URL=redis://redis:6379/0
    depends_on:
      - db
      - redis
    command: python -m rq worker

volumes:
  postgres_data:
  redis_data:
```

### Full Stack (Next.js + API + DB)

```yaml
version: '3.8'

services:
  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    environment:
      - NEXT_PUBLIC_API_URL=http://localhost:8000
    depends_on:
      - backend

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    ports:
      - "8000:8000"
    environment:
      - DATABASE_URL=postgresql://postgres:postgres@db:5432/myapp
    depends_on:
      - db

  db:
    image: postgres:15-alpine
    volumes:
      - postgres_data:/var/lib/postgresql/data
    environment:
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=postgres
      - POSTGRES_DB=myapp

volumes:
  postgres_data:
```

## .dockerignore Templates

### Node.js .dockerignore

```
node_modules
npm-debug.log
.git
.gitignore
README.md
.env
.env.local
.env.*.local
dist
build
coverage
.nyc_output
.vscode
.idea
*.md
.DS_Store
```

### Python .dockerignore

```
__pycache__
*.py[cod]
*$py.class
*.so
.Python
env/
venv/
.venv/
ENV/
build/
develop-eggs/
dist/
downloads/
eggs/
.eggs/
lib/
lib64/
parts/
sdist/
var/
wheels/
*.egg-info/
.installed.cfg
*.egg
.git
.gitignore
.env
.env.local
*.md
.DS_Store
```

## Docker Best Practices

### 1. Use Multi-Stage Builds

```dockerfile
# Bad: Large image with build tools
FROM python:3.11
COPY . .
RUN pip install -r requirements.txt
CMD ["python", "app.py"]

# Good: Small production image
FROM python:3.11-slim AS builder
COPY requirements.txt .
RUN pip install --user -r requirements.txt

FROM python:3.11-slim
COPY --from=builder /root/.local /root/.local
COPY . .
CMD ["python", "app.py"]
```

### 2. Layer Caching

```dockerfile
# Bad: Copies everything, invalidates cache
COPY . .
RUN pip install -r requirements.txt

# Good: Copy requirements first, cache dependencies
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY . .
```

### 3. Don't Run as Root

```dockerfile
# Bad: Runs as root
CMD ["python", "app.py"]

# Good: Non-root user
RUN useradd --create-home --shell /bin/bash appuser
USER appuser
CMD ["python", "app.py"]
```

### 4. Use .dockerignore

Always use `.dockerignore` to exclude:
- `node_modules/` or `__pycache__/`
- `.git/`
- `.env` files
- Build artifacts

### 5. Health Checks

```dockerfile
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1
```

## Common Commands

```bash
# Build image
docker build -t myapp .

# Run container
docker run -p 3000:3000 myapp

# Run with environment
docker run -p 3000:3000 -e NODE_ENV=production myapp

# Interactive shell
docker exec -it <container_id> sh

# View logs
docker logs -f <container_id>

# Docker Compose
docker-compose up          # Start services
docker-compose up -d       # Start in background
docker-compose down        # Stop services
docker-compose logs -f     # View logs
docker-compose build       # Rebuild images
```
