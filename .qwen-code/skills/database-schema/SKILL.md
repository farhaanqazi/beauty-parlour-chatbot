---
name: database-schema
description: Use when designing or documenting database schemas for PostgreSQL, MySQL, or similar relational databases. Handles table design, relationships, migrations, and schema documentation.
---

# Database Schema Skill

Design and document relational database schemas with proper normalization, indexing, and migrations.

## When to Use

- Designing a new database from scratch
- Adding tables or modifying existing schema
- Creating migration files
- Documenting schema for team reference
- Reviewing schema for best practices

## Schema Design Process

### Step 1: Identify Entities

List the core entities in your system:

```
Example: E-commerce platform
- Users
- Products
- Orders
- OrderItems
- Categories
```

### Step 2: Define Tables with Relationships

For each entity, define:
- Primary key (usually `id` SERIAL/UUID)
- Core attributes with types
- Foreign keys for relationships
- Timestamps (`created_at`, `updated_at`)

```sql
-- Example: Users table
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Example: Orders with foreign key
CREATE TABLE orders (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(50) DEFAULT 'pending',
    total_cents INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Step 3: Add Indexes

Index columns used in:
- WHERE clauses
- JOIN conditions
- ORDER BY clauses
- Foreign keys (for JOIN performance)

```sql
-- Index for frequent lookups
CREATE INDEX idx_users_email ON users(email);

-- Index for foreign key (improves JOIN performance)
CREATE INDEX idx_orders_user_id ON orders(user_id);

-- Composite index for common query pattern
CREATE INDEX idx_orders_status_created ON orders(status, created_at);
```

### Step 4: Create Migration Files

Use a migration tool (Prisma, Alembic, Knex, etc.):

```bash
# Prisma example
npx prisma migrate dev --name create_users_table

# Alembic (Python) example
alembic revision -m "create_users_table"
```

```sql
-- Migration file: 001_create_users_table.sql
-- Up
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_email ON users(email);

-- Down
DROP INDEX idx_users_email;
DROP TABLE users;
```

## Schema Documentation Template

Create `SCHEMA.md`:

```markdown
# Database Schema

## Entity Relationship Diagram

```
users (1) ──< (N) orders
orders (1) ──< (N) order_items
products (1) ──< (N) order_items
categories (1) ──< (N) products
```

## Tables

### users

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | Auto-increment ID |
| email | VARCHAR(255) | UNIQUE, NOT NULL | User email for login |
| password_hash | VARCHAR(255) | NOT NULL | Bcrypt hash |
| created_at | TIMESTAMP | DEFAULT now() | Record creation time |

### orders

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | Auto-increment ID |
| user_id | INTEGER | FK → users.id | Customer |
| status | VARCHAR(50) | DEFAULT 'pending' | Order status |
| total_cents | INTEGER | NOT NULL | Total in cents |

## Indexes

| Table | Index | Columns | Purpose |
|-------|-------|---------|---------|
| users | idx_users_email | email | Fast login lookups |
| orders | idx_orders_user_id | user_id | User order history |
```

## Common Patterns

### Soft Delete Pattern

```sql
ALTER TABLE users ADD COLUMN deleted_at TIMESTAMP;

-- Query only active records
SELECT * FROM users WHERE deleted_at IS NULL;

-- "Delete" a record
UPDATE users SET deleted_at = CURRENT_TIMESTAMP WHERE id = 1;
```

### Polymorphic Association

```sql
CREATE TABLE comments (
    id SERIAL PRIMARY KEY,
    commentable_id INTEGER NOT NULL,
    commentable_type VARCHAR(50) NOT NULL,  -- 'post', 'video', etc.
    body TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Audit Trail

```sql
ALTER TABLE orders ADD COLUMN created_by INTEGER REFERENCES users(id);
ALTER TABLE orders ADD COLUMN modified_by INTEGER REFERENCES users(id);
ALTER TABLE orders ADD COLUMN modified_at TIMESTAMP;
```

## Normalization Checklist

- [ ] Each table has a primary key
- [ ] No repeating groups (1NF)
- [ ] All non-key columns depend on the whole key (2NF)
- [ ] No transitive dependencies (3NF)
- [ ] Foreign keys have indexes
- [ ] Timestamps on all tables
- [ ] Soft delete where needed

## Example: Full Schema

```sql
-- E-commerce schema

CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    parent_id INTEGER REFERENCES categories(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE products (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price_cents INTEGER NOT NULL,
    category_id INTEGER REFERENCES categories(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE orders (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(50) DEFAULT 'pending',
    total_cents INTEGER NOT NULL,
    shipping_address JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE order_items (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(id),
    quantity INTEGER NOT NULL,
    unit_price_cents INTEGER NOT NULL
);

-- Indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_orders_user ON orders(user_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_order_items_order ON order_items(order_id);
CREATE INDEX idx_order_items_product ON order_items(product_id);
```
