---
name: performance-profile
description: Use when identifying performance bottlenecks. Covers profiling commands for Python/Node, database query analysis, memory leak detection, and optimization strategies.
---

# Performance Profile Skill

Identify and fix performance bottlenecks through systematic profiling and optimization.

## When to Use

- Application is slow or unresponsive
- Database queries taking too long
- Memory usage growing over time
- Before scaling infrastructure
- Optimizing critical paths

## Python Profiling

### cProfile (Built-in)

```bash
# Profile entire script
python -m cProfile -o output.prof script.py

# View results
python -m pstats output.prof
# Then: sort_stats cumtime | print_stats 20

# One-liner
python -m cProfile -s cumtime script.py | head -50
```

```python
# In-code profiling
import cProfile
import pstats

def main():
    # Your code here
    pass

# Profile specific function
profiler = cProfile.Profile()
profiler.enable()
main()
profiler.disable()

# Print stats
stats = pstats.Stats(profiler)
stats.sort_stats('cumulative')
stats.print_stats(20)

# Save for analysis
stats.dump_stats('profile.prof')
```

### line_profiler (Line-by-line)

```bash
# Install
pip install line_profiler

# Add decorator
@profile
def slow_function():
    # Code to profile
    pass

# Run
kernprof -l -v script.py
```

**Output:**
```
Line #      Hits         Time  Per Hit   % Time  Line Contents
==============================================================
     1                                           @profile
     2                                           def slow_function():
     3         1          2.0      2.0      0.1      result = []
     4      1000        150.0      0.2     10.0      for i in range(1000):
     5      1000       1300.0      1.3     89.9          result.append(expensive_op(i))
     6         1          1.0      1.0      0.1      return result
```

### memory_profiler

```bash
# Install
pip install memory_profiler

# Add decorator
@profile
def memory_intensive():
    data = [i for i in range(1000000)]
    return data

# Run
python -m memory_profiler script.py
```

**Output:**
```
Line #    Mem usage    Increment   Line Contents
================================================
     1     38.5 MiB     38.5 MiB   @profile
     2                                         def memory_intensive():
     3     76.2 MiB     37.7 MiB       data = [i for i in range(1000000)]
     4     76.2 MiB      0.0 MiB       return data
```

### py-spy (Production-safe)

```bash
# Install
pip install py-spy

# Profile running process
py-spy top --pid 12345

# Generate flame graph
py-spy record -o profile.svg --pid 12345

# Profile with subprocess
py-spy record -o profile.svg -- python script.py
```

## Node.js Profiling

### Built-in Profiler

```bash
# Generate profile
node --prof app.js

# Process profile
node --prof-process isolate-*.log > profile.txt
```

### Chrome DevTools

```bash
# Start with inspect flag
node --inspect app.js

# Open chrome://inspect in Chrome
# Click "Inspect" to open DevTools
# Use Performance tab to record
```

### clinic.js

```bash
# Install
npm install -g clinic

# Doctor (automatic analysis)
clinic doctor -- node app.js

# Flame graph
clinic flame -- node app.js

# Bubbleprof (async profiling)
clinic bubbleprof -- node app.js
```

### 0x (Flame graphs)

```bash
# Install
npm install -g 0x

# Profile
0x app.js

# Opens flame graph in browser
```

### Memory Leaks

```javascript
// Heap snapshot in code
const v8 = require('v8');
const fs = require('fs');

const snapshot = v8.getHeapSnapshot();
snapshot.pipe(fs.createWriteStream('heap.heapsnapshot'));

// Analyze in Chrome DevTools Memory tab
```

```bash
# With Chrome DevTools
# 1. Open chrome://inspect
# 2. Click "Inspect"
# 3. Memory tab → Take Heap Snapshot
# 4. Compare snapshots to find leaks
```

## Database Query Profiling

### PostgreSQL

```sql
-- Enable query logging
ALTER SYSTEM SET log_min_duration_statement = 100;  -- Log queries >100ms
SELECT pg_reload_conf();

-- Explain query plan
EXPLAIN ANALYZE
SELECT * FROM users WHERE email = 'test@example.com';

-- Look for:
-- - Seq Scan (bad on large tables)
-- - High actual time vs estimated
-- - Nested Loop joins on large datasets

-- Find slow queries from logs
SELECT query, calls, total_time, mean_time
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 10;

-- Check index usage
SELECT schemaname, tablename, indexname, idx_scan
FROM pg_stat_user_indexes
ORDER BY idx_scan ASC;

-- Missing indexes (tables with many seq scans)
SELECT relname, seq_scan, idx_scan
FROM pg_stat_user_tables
WHERE seq_scan > idx_scan
ORDER BY seq_scan DESC;
```

### MySQL

```sql
-- Enable slow query log
SET GLOBAL slow_query_log = 'ON';
SET GLOBAL long_query_time = 1;  -- Log queries >1 second

-- Explain query
EXPLAIN SELECT * FROM users WHERE email = 'test@example.com';

-- Look for:
-- - type: ALL (full table scan - bad)
-- - type: index (index scan - okay)
-- - type: ref/range/const (good)
-- - Extra: Using filesort (bad)
-- - Extra: Using temporary (bad)

-- Show running queries
SHOW PROCESSLIST;

-- Find slow queries
SELECT query, avg_timer_wait, rows_examined, rows_sent
FROM performance_schema.events_statements_summary_by_digest
ORDER BY avg_timer_wait DESC
LIMIT 10;
```

### SQLite

```sql
-- Enable query profiling
.timer on
.explain on

-- Analyze query
EXPLAIN QUERY PLAN
SELECT * FROM users WHERE email = 'test@example.com';

-- Look for:
-- - SCAN TABLE (full scan - bad)
-- - SEARCH TABLE USING INDEX (good)
```

## Web Performance

### Lighthouse CLI

```bash
# Install
npm install -g lighthouse

# Run audit
lighthouse https://example.com --output html --output-path report.html

# With specific categories
lighthouse https://example.com --only-categories=performance,pwa
```

### WebPageTest API

```bash
# Via curl
curl -X POST https://www.webpagetest.org/runtest.php \
  -d "url=https://example.com" \
  -d "f=json" \
  -d "key=YOUR_API_KEY"
```

## Common Optimizations

### Caching

**Python (functools.lru_cache):**
```python
from functools import lru_cache

@lru_cache(maxsize=128)
def expensive_computation(x, y):
    return x ** y

# Manual cache control
expensive_computation.cache_clear()
```

**Python (Redis):**
```python
import redis
import json

r = redis.Redis()

def get_user(user_id):
    key = f"user:{user_id}"
    cached = r.get(key)
    if cached:
        return json.loads(cached)
    
    user = db.query(User).get(user_id)
    r.setex(key, 300, json.dumps(user))  # 5 min TTL
    return user
```

**Node.js (Redis):**
```javascript
import Redis from 'ioredis';
const redis = new Redis();

async function getUser(userId) {
  const key = `user:${userId}`;
  const cached = await redis.get(key);
  if (cached) return JSON.parse(cached);
  
  const user = await db.user.findUnique({ where: { id: userId } });
  await redis.setex(key, 300, JSON.stringify(user));
  return user;
}
```

### Database Indexing

```sql
-- Add index for WHERE clause
CREATE INDEX idx_users_email ON users(email);

-- Composite index for multiple columns
CREATE INDEX idx_orders_status_date ON orders(status, created_at);

-- Partial index for filtered queries
CREATE INDEX idx_orders_pending ON orders(created_at)
WHERE status = 'pending';

-- Covering index (includes all needed columns)
CREATE INDEX idx_users_email_name ON users(email, name);
```

### Lazy Loading

**Python (SQLAlchemy):**
```python
# Eager loading (prevents N+1)
from sqlalchemy.orm import joinedload

users = session.query(User).options(
    joinedload(User.orders)
).all()

# Now user.orders is already loaded
for user in users:
    print(user.orders)  # No additional queries
```

**Node.js (Prisma):**
```javascript
// Eager loading
const users = await prisma.user.findMany({
  include: {
    orders: true,
  },
});

// No N+1 problem
users.forEach(user => {
  console.log(user.orders);  // Already loaded
});
```

### Pagination

```python
# Offset pagination
def get_users(page=1, per_page=20):
    offset = (page - 1) * per_page
    return db.query(User).limit(per_page).offset(offset).all()

# Keyset pagination (better for large datasets)
def get_users(after_id=None, limit=20):
    query = db.query(User)
    if after_id:
        query = query.filter(User.id > after_id)
    return query.limit(limit).all()
```

## Performance Report Template

```markdown
# Performance Audit Report

**Date:** [date]
**Application:** [name]

## Summary

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Page Load | 3.2s | 1.1s | 66% |
| API p95 | 450ms | 120ms | 73% |
| Memory | 512MB | 256MB | 50% |

## Bottlenecks Identified

### 1. N+1 Query Problem

**Location:** `src/services/user_service.py:45`

**Impact:** 500ms → 50ms per request

**Fix:** Added eager loading with joinedload()

### 2. Missing Database Index

**Location:** `users.email` column

**Impact:** 200ms → 5ms for login queries

**Fix:** CREATE INDEX idx_users_email ON users(email)

### 3. Memory Leak in Cache

**Location:** `src/cache.py:22`

**Impact:** Memory grew 100MB/hour

**Fix:** Added TTL and max size to cache

## Recommendations

1. [ ] Add database indexes (estimated 50% improvement)
2. [ ] Implement Redis caching (estimated 70% improvement)
3. [ ] Fix N+1 queries (estimated 80% improvement)
4. [ ] Enable gzip compression
5. [ ] Add CDN for static assets

## Monitoring Setup

- [ ] APM tool installed (DataDog, New Relic, Sentry)
- [ ] Database slow query log enabled
- [ ] Alert thresholds configured
```
