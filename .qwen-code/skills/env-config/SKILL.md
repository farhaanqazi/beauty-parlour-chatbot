---
name: env-config
description: Use when setting up environment variables, .env files, and configuration management. Handles validation, secrets management, and config patterns for Node.js and Python.
---

# Environment Config Skill

Manage environment variables, .env files, and configuration with proper validation and secrets handling.

## When to Use

- Setting up a new project's configuration
- Managing different environments (dev, staging, prod)
- Validating required environment variables
- Handling secrets securely
- Creating configuration patterns for teams

## .env File Structure

### Basic .env

```bash
# .env
DATABASE_URL=postgresql://user:password@localhost:5432/mydb
REDIS_URL=redis://localhost:6379/0
PORT=3000
NODE_ENV=development

# API Keys
STRIPE_SECRET_KEY=sk_test_abc123
SENDGRID_API_KEY=SG.abc123

# Feature Flags
ENABLE_NEW_UI=true
MAX_UPLOAD_SIZE=10485760
```

### Environment-Specific Files

```
.env                # Default values (committed to git)
.env.local          # Local overrides (not committed)
.env.development    # Development-specific
.env.staging        # Staging-specific
.env.production     # Production-specific
```

### .env.example Template

```bash
# .env.example (commit this, not .env)

# Database
DATABASE_URL=postgresql://localhost:5432/mydb

# Server
PORT=3000
NODE_ENV=development

# API Keys (get from https://dashboard.stripe.com)
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx

# Email (get from SendGrid dashboard)
SENDGRID_API_KEY=SG.xxx
FROM_EMAIL=noreply@example.com

# JWT
JWT_SECRET=generate-with-openssl-rand-base64-32

# Feature Flags
ENABLE_NEW_UI=false
```

## Loading Environment Variables

### Node.js (dotenv)

```javascript
// Install: npm install dotenv
require('dotenv').config();

// Or with path
require('dotenv').config({ path: '.env.local' });

// Access
const port = process.env.PORT;
const dbUrl = process.env.DATABASE_URL;

// With defaults
const port = process.env.PORT || 3000;
const nodeEnv = process.env.NODE_ENV || 'development';
```

### Node.js (dotenv-flow for environment-specific)

```javascript
// Install: npm install dotenv-flow
require('dotenv-flow').config();

// Loads in order:
// 1. .env (defaults)
// 2. .env.local (local overrides)
// 3. .env.development (or .env.production based on NODE_ENV)
```

### Python (python-dotenv)

```python
# Install: pip install python-dotenv
from dotenv import load_dotenv
import os

load_dotenv()  # Loads .env from current directory
# Or specify path
load_dotenv('.env.local')

# Access
port = os.getenv('PORT', '3000')
db_url = os.getenv('DATABASE_URL')
debug = os.getenv('DEBUG', 'False').lower() == 'true'
```

### Python (decouple for type conversion)

```python
# Install: pip install python-decouple
from decouple import config, Csv

# With type conversion
PORT = config('PORT', default=3000, cast=int)
DEBUG = config('DEBUG', default=False, cast=bool)
ALLOWED_HOSTS = config('ALLOWED_HOSTS', cast=Csv())

# Required variables (raises if missing)
SECRET_KEY = config('SECRET_KEY')  # Raises if not set
```

## Environment Validation

### Node.js (envalid)

```javascript
// Install: npm install envalid
const { str, num, bool, url, cleanEnv } = require('envalid');

const env = cleanEnv(process.env, {
    PORT: num({ default: 3000 }),
    NODE_ENV: str({ choices: ['development', 'production', 'test'] }),
    DATABASE_URL: url(),
    JWT_SECRET: str({ minLength: 32 }),
    STRIPE_SECRET_KEY: str(),
    ENABLE_NEW_UI: bool({ default: false }),
    MAX_UPLOAD_SIZE: num({ default: 10485760 }),
});

// Access validated env
const port = env.PORT;
const dbUrl = env.DATABASE_URL;

// Will throw if validation fails
```

### Python (pydantic settings)

```python
# Install: pip install pydantic-settings
from pydantic_settings import BaseSettings
from pydantic import Field, HttpUrl, field_validator
from typing import Literal

class Settings(BaseSettings):
    # Server
    PORT: int = 3000
    NODE_ENV: Literal['development', 'production', 'test'] = 'development'
    
    # Database
    DATABASE_URL: str
    
    # Secrets
    JWT_SECRET: str = Field(..., min_length=32)
    STRIPE_SECRET_KEY: str
    
    # Feature flags
    ENABLE_NEW_UI: bool = False
    MAX_UPLOAD_SIZE: int = 10485760
    
    @field_validator('DATABASE_URL')
    @classmethod
    def validate_db_url(cls, v):
        if not v.startswith('postgresql://'):
            raise ValueError('DATABASE_URL must be postgresql://')
        return v
    
    class Config:
        env_file = '.env'
        env_file_encoding = 'utf-8'

# Load settings
settings = Settings()

# Access
print(settings.PORT)
print(settings.DATABASE_URL)
```

### Simple Validation Script

```javascript
// scripts/validate-env.js
const required = [
    'DATABASE_URL',
    'JWT_SECRET',
    'STRIPE_SECRET_KEY',
];

const missing = required.filter(key => !process.env[key]);

if (missing.length > 0) {
    console.error('Missing required environment variables:');
    missing.forEach(key => console.error(`  - ${key}`));
    process.exit(1);
}

console.log('✓ All environment variables present');
```

## Configuration Patterns

### Node.js Config Module

```javascript
// config/index.js
const { cleanEnv, str, num, bool } = require('envalid');

const env = cleanEnv(process.env, {
    PORT: num({ default: 3000 }),
    NODE_ENV: str({ choices: ['development', 'production', 'test'], default: 'development' }),
    DATABASE_URL: str(),
    JWT_SECRET: str({ minLength: 32 }),
    STRIPE_SECRET_KEY: str(),
    LOG_LEVEL: str({ choices: ['debug', 'info', 'warn', 'error'], default: 'info' }),
});

const config = {
    port: env.PORT,
    nodeEnv: env.NODE_ENV,
    isDevelopment: env.NODE_ENV === 'development',
    isProduction: env.NODE_ENV === 'production',
    database: {
        url: env.DATABASE_URL,
        pool: {
            min: 2,
            max: env.isProduction ? 20 : 5,
        },
    },
    jwt: {
        secret: env.JWT_SECRET,
        expiresIn: '7d',
    },
    stripe: {
        secretKey: env.STRIPE_SECRET_KEY,
        webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
    },
    logging: {
        level: env.LOG_LEVEL,
    },
};

module.exports = config;
```

### Python Config Module

```python
# config.py
from pydantic_settings import BaseSettings
from typing import Optional
import os

class DatabaseSettings(BaseSettings):
    url: str
    pool_size: int = 5
    
    class Config:
        env_prefix = 'DB_'

class Settings(BaseSettings):
    # App
    app_name: str = "My App"
    debug: bool = False
    secret_key: str
    
    # Server
    host: str = "0.0.0.0"
    port: int = 8000
    
    # Database
    db: DatabaseSettings = DatabaseSettings()
    
    # External services
    stripe_key: Optional[str] = None
    
    class Config:
        env_file = '.env'

settings = Settings()
```

## Secrets Management

### Never Commit Secrets

```bash
# .gitignore
.env
.env.local
.env.*.local
secrets/
*.pem
*.key
```

### Use Environment-Specific Secrets

```bash
# Development
# .env.development
STRIPE_SECRET_KEY=sk_test_abc123

# Production
# Set via deployment (Heroku, Vercel, AWS, etc.)
# Or use .env.production (never commit!)
STRIPE_SECRET_KEY=sk_live_xyz789
```

### Generate Secure Secrets

```bash
# Generate JWT secret
openssl rand -base64 32

# Generate API key
openssl rand -hex 32

# Python
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

## Deployment Configuration

### Docker

```dockerfile
# Don't bake secrets into image
# Pass at runtime
docker run -e DATABASE_URL=postgresql://... -e JWT_SECRET=... myapp
```

### Docker Compose

```yaml
services:
  app:
    image: myapp
    env_file:
      - .env.production
    environment:
      - NODE_ENV=production
```

### GitHub Actions

```yaml
# .github/workflows/deploy.yml
jobs:
  deploy:
    steps:
      - uses: actions/checkout@v3
      - name: Deploy
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
          JWT_SECRET: ${{ secrets.JWT_SECRET }}
        run: ./deploy.sh
```

## Checklist

- [ ] .env.example committed to repo
- [ ] .env in .gitignore
- [ ] All required variables documented
- [ ] Validation in place (envalid/pydantic)
- [ ] Different configs for dev/staging/prod
- [ ] Secrets not hardcoded
- [ ] Secure secret generation
- [ ] Config module for centralized access
