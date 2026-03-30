---
name: sql-query-builder
description: Use when writing SQL queries — SELECT, JOIN, subqueries, aggregations. Includes query optimization, parameterization for safety, and N+1 detection.
---

# SQL Query Builder Skill

Write safe, efficient SQL queries with proper parameterization and optimization.

## When to Use

- Writing complex SELECT queries with JOINs
- Building parameterized queries (prevent SQL injection)
- Optimizing slow queries
- Detecting and fixing N+1 query problems
- Writing aggregations and window functions

## Basic Query Patterns

### SELECT with Filtering

```sql
-- Basic query with WHERE
SELECT id, email, name, created_at
FROM users
WHERE status = 'active'
  AND created_at >= '2025-01-01'
ORDER BY created_at DESC
LIMIT 20;
```

### JOINs

```sql
-- INNER JOIN: only matching records
SELECT 
    u.id,
    u.name,
    o.id AS order_id,
    o.total_cents,
    o.created_at
FROM users u
INNER JOIN orders o ON u.id = o.user_id
WHERE o.status = 'completed'
ORDER BY o.created_at DESC;

-- LEFT JOIN: all users, even without orders
SELECT 
    u.id,
    u.name,
    COUNT(o.id) AS order_count,
    COALESCE(SUM(o.total_cents), 0) AS total_spent
FROM users u
LEFT JOIN orders o ON u.id = o.user_id
GROUP BY u.id, u.name
HAVING COUNT(o.id) > 0
ORDER BY total_spent DESC;
```

### Subqueries

```sql
-- Subquery in WHERE
SELECT *
FROM users
WHERE id IN (
    SELECT user_id 
    FROM orders 
    WHERE total_cents > 10000
);

-- Subquery in SELECT
SELECT 
    u.id,
    u.name,
    (SELECT COUNT(*) FROM orders WHERE user_id = u.id) AS order_count
FROM users u;

-- CTE (Common Table Expression) - preferred for complex queries
WITH high_value_orders AS (
    SELECT user_id, SUM(total_cents) AS total
    FROM orders
    GROUP BY user_id
    HAVING SUM(total_cents) > 10000
)
SELECT u.*, hvo.total
FROM users u
JOIN high_value_orders hvo ON u.id = hvo.user_id;
```

### Aggregations

```sql
-- GROUP BY with aggregations
SELECT 
    DATE_TRUNC('month', created_at) AS month,
    COUNT(*) AS order_count,
    SUM(total_cents) AS revenue,
    AVG(total_cents) AS avg_order_value
FROM orders
WHERE created_at >= '2025-01-01'
GROUP BY DATE_TRUNC('month', created_at)
ORDER BY month;

-- Window functions
SELECT 
    u.id,
    u.name,
    o.total_cents,
    RANK() OVER (PARTITION BY u.id ORDER BY o.total_cents DESC) AS order_rank,
    SUM(o.total_cents) OVER (PARTITION BY u.id) AS user_lifetime_value
FROM users u
JOIN orders o ON u.id = o.user_id;
```

## Parameterized Queries (Prevent SQL Injection)

### Python (psycopg2)

```python
# ❌ BAD: SQL injection vulnerability
user_id = request.get('id')
cursor.execute(f"SELECT * FROM users WHERE id = {user_id}")

# ✅ GOOD: Parameterized query
user_id = request.get('id')
cursor.execute("SELECT * FROM users WHERE id = %s", (user_id,))

# ✅ GOOD: With multiple parameters
cursor.execute("""
    SELECT * FROM orders 
    WHERE user_id = %s AND status = %s
""", (user_id, 'pending'))
```

### Python (SQLAlchemy)

```python
# ✅ GOOD: Parameterized with SQLAlchemy
from sqlalchemy import text

stmt = text("SELECT * FROM users WHERE email = :email")
result = session.execute(stmt, {"email": email})
```

### Node.js (pg)

```javascript
// ❌ BAD: SQL injection
const userId = req.query.id;
await client.query(`SELECT * FROM users WHERE id = ${userId}`);

// ✅ GOOD: Parameterized
const userId = req.query.id;
await client.query('SELECT * FROM users WHERE id = $1', [userId]);

// ✅ GOOD: Multiple parameters
await client.query(`
    SELECT * FROM orders 
    WHERE user_id = $1 AND status = $2
`, [userId, 'pending']);
```

### Node.js (Prisma)

```javascript
// ✅ GOOD: Prisma handles parameterization
const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { orders: true }
});
```

## N+1 Query Problem

### What is N+1?

N+1 happens when you:
1. Fetch N records (1 query)
2. Then fetch related data for each record (N queries)

```python
# ❌ BAD: N+1 problem
users = db.query("SELECT * FROM users")
for user in users:
    # One query per user!
    orders = db.query(f"SELECT * FROM orders WHERE user_id = {user.id}")
    print(f"{user.name} has {len(orders)} orders")

# Total queries: 1 + N (where N = number of users)
```

### Fix with JOIN

```python
# ✅ GOOD: Single query with JOIN
users_with_orders = db.query("""
    SELECT u.*, COUNT(o.id) AS order_count
    FROM users u
    LEFT JOIN orders o ON u.id = o.user_id
    GROUP BY u.id
""")
for row in users_with_orders:
    print(f"{row.name} has {row.order_count} orders")

# Total queries: 1
```

### Fix with Eager Loading (SQLAlchemy)

```python
# ✅ GOOD: Eager loading with joinedload
from sqlalchemy.orm import joinedload

users = session.query(User).options(
    joinedload(User.orders)
).all()

for user in users:
    print(f"{user.name} has {len(user.orders)} orders")

# Total queries: 1 (with JOIN) or 2 (separate queries, batched)
```

### Fix with IN Clause

```python
# ✅ GOOD: Batch loading
users = db.query("SELECT * FROM users")
user_ids = [u.id for u in users]

# Single query for all orders
orders = db.query("""
    SELECT * FROM orders WHERE user_id = ANY(%s)
""", (user_ids,))

# Group by user_id in application
orders_by_user = {}
for order in orders:
    orders_by_user.setdefault(order.user_id, []).append(order)

for user in users:
    user_orders = orders_by_user.get(user.id, [])
    print(f"{user.name} has {len(user_orders)} orders")

# Total queries: 2
```

## Query Optimization

### Use EXPLAIN ANALYZE

```sql
-- See query execution plan
EXPLAIN ANALYZE
SELECT * FROM users WHERE email = 'test@example.com';

-- Output shows:
-- - Seq Scan vs Index Scan
-- - Actual time in ms
-- - Rows estimated vs actual
```

### Add Indexes

```sql
-- Index for WHERE clause
CREATE INDEX idx_users_email ON users(email);

-- Index for JOIN
CREATE INDEX idx_orders_user_id ON orders(user_id);

-- Composite index for multiple columns
CREATE INDEX idx_orders_status_date ON orders(status, created_at);

-- Partial index (only for specific condition)
CREATE INDEX idx_orders_pending ON orders(created_at) 
WHERE status = 'pending';
```

### Avoid SELECT *

```sql
-- ❌ BAD: Fetches all columns, including unused ones
SELECT * FROM users;

-- ✅ GOOD: Only fetch needed columns
SELECT id, email, name FROM users;
```

### Use LIMIT for Large Tables

```sql
-- Always limit results for exploration
SELECT * FROM large_table LIMIT 100;
```

## Common Query Patterns

### Pagination

```sql
-- Offset-based pagination
SELECT * FROM products
ORDER BY created_at DESC
LIMIT 20 OFFSET 40;  -- Page 3 (0-indexed)

-- Keyset pagination (more efficient for large offsets)
SELECT * FROM products
WHERE created_at < '2025-01-01'
ORDER BY created_at DESC
LIMIT 20;
```

### Upsert (Insert or Update)

```sql
-- PostgreSQL
INSERT INTO users (id, email, name)
VALUES (1, 'test@example.com', 'Test')
ON CONFLICT (id) DO UPDATE
SET email = EXCLUDED.email,
    name = EXCLUDED.name,
    updated_at = CURRENT_TIMESTAMP;

-- MySQL
INSERT INTO users (id, email, name)
VALUES (1, 'test@example.com', 'Test')
ON DUPLICATE KEY UPDATE
    email = VALUES(email),
    name = VALUES(name),
    updated_at = CURRENT_TIMESTAMP;
```

### Soft Delete

```sql
-- Mark as deleted
UPDATE users SET deleted_at = CURRENT_TIMESTAMP WHERE id = 1;

-- Query only active records
SELECT * FROM users WHERE deleted_at IS NULL;

-- Include deleted in count
SELECT 
    COUNT(*) AS total,
    COUNT(deleted_at) AS deleted,
    COUNT(*) - COUNT(deleted_at) AS active
FROM users;
```

## Query Checklist

- [ ] Using parameterized queries (no string interpolation)
- [ ] Indexes on WHERE, JOIN, and ORDER BY columns
- [ ] No SELECT * (explicit column list)
- [ ] LIMIT for large result sets
- [ ] EXPLAIN ANALYZE for slow queries
- [ ] No N+1 pattern (use JOIN or batch loading)
- [ ] Transactions for multi-statement operations
