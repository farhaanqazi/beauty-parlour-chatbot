---
name: security-audit
description: Use when scanning codebases for security vulnerabilities. Covers OWASP Top 10, exposed secrets, SQL injection, XSS, insecure dependencies, and authentication issues.
---

# Security Audit Skill

Scan codebases for security vulnerabilities and implement secure coding practices.

## When to Use

- Before production deployment
- After adding new dependencies
- During code review for security-sensitive changes
- Setting up security scanning in CI/CD
- Responding to security incidents

## Security Checklist

### 1. Exposed Secrets

**Scan for hardcoded secrets:**

```bash
# Search for common secret patterns
grep -r "password\s*=\s*['\"]" src/ --include="*.py" --include="*.js" --include="*.ts"
grep -r "api_key\s*=\s*['\"]" src/
grep -r "secret\s*=\s*['\"]" src/
grep -r "AWS_SECRET" src/
grep -r "PRIVATE_KEY" src/
```

**❌ Bad:**
```python
# Hardcoded credentials
DATABASE_URL = "postgresql://admin:password123@localhost/mydb"
API_KEY = "sk_live_abc123xyz"
JWT_SECRET = "my-super-secret-key"
```

**✅ Good:**
```python
# Environment variables
import os
DATABASE_URL = os.getenv('DATABASE_URL')
API_KEY = os.getenv('STRIPE_API_KEY')
JWT_SECRET = os.getenv('JWT_SECRET')
```

**✅ Good:**
```javascript
// Node.js with validation
const { cleanEnv, str } = require('envalid');

const env = cleanEnv(process.env, {
  DATABASE_URL: str(),
  JWT_SECRET: str({ minLength: 32 }),
});
```

### 2. SQL Injection

**❌ Bad:**
```python
# String interpolation - VULNERABLE
user_id = request.get('id')
cursor.execute(f"SELECT * FROM users WHERE id = {user_id}")

# Format string - VULNERABLE
query = "SELECT * FROM users WHERE email = '%s'" % email
cursor.execute(query)
```

**✅ Good:**
```python
# Parameterized query
user_id = request.get('id')
cursor.execute("SELECT * FROM users WHERE id = %s", (user_id,))

# SQLAlchemy ORM - safe
user = session.query(User).filter(User.id == user_id).first()
```

**❌ Bad:**
```javascript
// String interpolation - VULNERABLE
const userId = req.query.id;
await client.query(`SELECT * FROM users WHERE id = ${userId}`);
```

**✅ Good:**
```javascript
// Parameterized query
const userId = req.query.id;
await client.query('SELECT * FROM users WHERE id = $1', [userId]);

// Prisma ORM - safe
const user = await prisma.user.findUnique({ where: { id: userId } });
```

### 3. Cross-Site Scripting (XSS)

**❌ Bad:**
```javascript
// Dangerous innerHTML
element.innerHTML = userInput;

// Dangerous dangerouslySetInnerHTML
<div dangerouslySetInnerHTML={{ __html: userContent }} />
```

**✅ Good:**
```javascript
// Safe text content
element.textContent = userInput;

// React automatically escapes
<div>{userContent}</div>

// If HTML is needed, sanitize first
import DOMPurify from 'dompurify';
<div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(userContent) }} />
```

**Server-side sanitization:**
```python
# Python with bleach
import bleach
clean_html = bleach.clean(user_input, tags=['p', 'br', 'strong'])
```

### 4. Authentication Issues

**Weak password hashing:**

**❌ Bad:**
```python
# MD5/SHA1 - broken for passwords
hashlib.md5(password.encode()).hexdigest()
hashlib.sha1(password.encode()).hexdigest()
```

**✅ Good:**
```python
# bcrypt or argon2
import bcrypt
password_hash = bcrypt.hashpw(password.encode(), bcrypt.gensalt(rounds=12))

# Or with passlib
from passlib.context import CryptContext
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
password_hash = pwd_context.hash(password)
```

**Missing rate limiting:**

**❌ Bad:**
```python
# No rate limiting on login
@app.post('/login')
async def login(credentials):
    user = authenticate(credentials)
    return generate_token(user)
```

**✅ Good:**
```python
# Rate limiting
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)

@app.post('/login')
@limiter.limit("5/minute")
async def login(request, credentials):
    user = authenticate(credentials)
    return generate_token(user)
```

### 5. Insecure Direct Object Reference (IDOR)

**❌ Bad:**
```python
# No authorization check
@app.get('/orders/{order_id}')
async def get_order(order_id: int):
    order = db.query(Order).filter(Order.id == order_id).first()
    return order  # Any user can access any order!
```

**✅ Good:**
```python
# Check ownership
@app.get('/orders/{order_id}')
async def get_order(order_id: int, current_user = Depends(get_current_user)):
    order = db.query(Order).filter(
        Order.id == order_id,
        Order.user_id == current_user.id
    ).first()
    if not order:
        raise HTTPException(status_code=404)
    return order
```

### 6. Security Headers

**Missing security headers:**

**✅ Good (Express):**
```javascript
import helmet from 'helmet';

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
}));
```

**✅ Good (FastAPI):**
```python
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware

@app.middleware("http")
async def add_security_headers(request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response
```

### 7. Dependency Vulnerabilities

**Scan for vulnerable dependencies:**

```bash
# npm
npm audit
npm audit fix

# Python
pip install safety
safety check

# Or with pip-audit
pip install pip-audit
pip-audit

# GitHub Dependabot
# Enable in repository settings
```

**❌ Bad:**
```json
{
  "dependencies": {
    "lodash": "4.17.10"  // Known vulnerabilities
  }
}
```

**✅ Good:**
```json
{
  "dependencies": {
    "lodash": "^4.17.21"  // Latest secure version
  }
}
```

## OWASP Top 10 Checklist

| # | Vulnerability | Check |
|---|---------------|-------|
| A01 | Broken Access Control | Are authorization checks on every protected endpoint? |
| A02 | Cryptographic Failures | Are secrets hashed with bcrypt/argon2? Is TLS enforced? |
| A03 | Injection | Are all queries parameterized? Is input validated? |
| A04 | Insecure Design | Is there threat modeling? Are security patterns used? |
| A05 | Security Misconfiguration | Are debug modes off in production? Are headers set? |
| A06 | Vulnerable Components | Are dependencies up to date? Is `npm audit` clean? |
| A07 | Auth Failures | Is MFA available? Are passwords hashed properly? |
| A08 | Data Integrity | Are critical operations logged? Is tampering detected? |
| A09 | Logging Failures | Are security events logged? Are logs protected? |
| A10 | SSRF | Are URLs validated before fetching? Is network segmented? |

## Automated Security Scanning

### SAST (Static Analysis)

```bash
# Python - Bandit
pip install bandit
bandit -r src/

# JavaScript - ESLint security plugin
npm install eslint-plugin-security
# Add to .eslintrc: plugins: ['security']

# Multi-language - Semgrep
semgrep --config auto src/
```

### DAST (Dynamic Analysis)

```bash
# OWASP ZAP (requires running application)
# Run via Docker:
docker run -t owasp/zap2docker-stable zap-baseline.py -t http://localhost:3000
```

### Pre-commit Hooks

```yaml
# .pre-commit-config.yaml
repos:
  - repo: https://github.com/PyCQA/bandit
    rev: 1.7.5
    hooks:
      - id: bandit
        args: ["-r", "src/"]
  
  - repo: https://github.com/returntocorp/semgrep
    rev: v1.40.0
    hooks:
      - id: semgrep
        args: ["--config", "auto"]
```

## Security Report Template

```markdown
# Security Audit Report

**Date:** [date]
**Auditor:** [name]
**Scope:** [files/components audited]

## Summary

| Severity | Count | Status |
|----------|-------|--------|
| Critical | 0 | - |
| High | 0 | - |
| Medium | 0 | - |
| Low | 0 | - |

## Findings

### [Finding Title]

**Severity:** High/Medium/Low

**Location:** `src/file.py:line`

**Description:**
[What the vulnerability is]

**Impact:**
[What an attacker could do]

**Recommendation:**
[How to fix]

**Code Fix:**
```diff
- vulnerable_code
+ secure_code
```

## Passed Checks

- [x] No hardcoded secrets
- [x] All SQL queries parameterized
- [x] Password hashing with bcrypt
- [x] Rate limiting on auth endpoints
- [x] Security headers configured
- [x] Dependencies up to date

## Next Steps

1. [ ] Fix high-severity findings
2. [ ] Schedule follow-up audit
3. [ ] Add automated scanning to CI
```
