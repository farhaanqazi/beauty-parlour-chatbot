---
name: fastapi-patterns
description: Use when building FastAPI applications. Covers project structure, routers, dependency injection, Pydantic models, async patterns, and best practices.
---

# FastAPI Patterns Skill

Build production-ready FastAPI applications with proper structure, dependency injection, and async patterns.

## When to Use

- Creating a new FastAPI API from scratch
- Adding routers and endpoints
- Implementing authentication and authorization
- Setting up dependency injection
- Handling async database operations

## Project Structure

```
myapp/
├── app/
│   ├── __init__.py
│   ├── main.py           # FastAPI app instance
│   ├── config.py         # Settings and config
│   ├── database.py       # DB connection
│   ├── dependencies.py   # Shared dependencies
│   ├── models/           # SQLAlchemy/ORM models
│   │   ├── __init__.py
│   │   ├── user.py
│   │   └── order.py
│   ├── schemas/          # Pydantic schemas
│   │   ├── __init__.py
│   │   ├── user.py
│   │   └── order.py
│   ├── routers/          # API routers
│   │   ├── __init__.py
│   │   ├── users.py
│   │   ├── orders.py
│   │   └── auth.py
│   ├── services/         # Business logic
│   │   ├── __init__.py
│   │   ├── user_service.py
│   │   └── email_service.py
│   └── utils/            # Utilities
│       ├── __init__.py
│       ├── security.py
│       └── helpers.py
├── tests/
│   ├── __init__.py
│   ├── conftest.py
│   ├── test_users.py
│   └── test_orders.py
├── alembic/              # Database migrations
├── .env
├── requirements.txt
└── main.py               # Entry point
```

## Basic FastAPI App

```python
# app/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import users, orders, auth
from app.config import settings

app = FastAPI(
    title=settings.APP_NAME,
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(users.router, prefix="/api/users", tags=["users"])
app.include_router(orders.router, prefix="/api/orders", tags=["orders"])
app.include_router(auth.router, prefix="/api/auth", tags=["auth"])

@app.get("/health")
async def health_check():
    return {"status": "healthy"}
```

## Pydantic Schemas

```python
# app/schemas/user.py
from pydantic import BaseModel, EmailStr, Field, validator
from datetime import datetime
from typing import Optional

class UserBase(BaseModel):
    email: EmailStr
    name: str = Field(..., min_length=1, max_length=100)
    
    @validator('name')
    def name_alphanumeric(cls, v):
        if not v.replace(' ', '').isalnum():
            raise ValueError('Name must be alphanumeric')
        return v

class UserCreate(UserBase):
    password: str = Field(..., min_length=8)

class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    name: Optional[str] = None

class UserResponse(UserBase):
    id: int
    created_at: datetime
    is_active: bool
    
    class Config:
        from_attributes = True

class UserInDB(UserResponse):
    password_hash: str
```

## Router with CRUD

```python
# app/routers/users.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from app.schemas.user import UserCreate, UserResponse, UserUpdate
from app.services.user_service import UserService

router = APIRouter()

@router.post("/", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(user_data: UserCreate, db: Session = Depends(get_db)):
    """Create a new user."""
    service = UserService(db)
    return service.create_user(user_data)

@router.get("/", response_model=List[UserResponse])
async def list_users(skip: int = 0, limit: int = 20, db: Session = Depends(get_db)):
    """List users with pagination."""
    service = UserService(db)
    return service.get_users(skip=skip, limit=limit)

@router.get("/{user_id}", response_model=UserResponse)
async def get_user(user_id: int, db: Session = Depends(get_db)):
    """Get a specific user."""
    service = UserService(db)
    user = service.get_user(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

@router.put("/{user_id}", response_model=UserResponse)
async def update_user(user_id: int, user_data: UserUpdate, db: Session = Depends(get_db)):
    """Update a user."""
    service = UserService(db)
    user = service.update_user(user_id, user_data)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(user_id: int, db: Session = Depends(get_db)):
    """Delete a user."""
    service = UserService(db)
    if not service.delete_user(user_id):
        raise HTTPException(status_code=404, detail="User not found")
```

## Dependency Injection

```python
# app/dependencies.py
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from typing import Optional

from app.database import get_db
from app.services.user_service import UserService

security = HTTPBearer()

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
):
    """Get current authenticated user from JWT token."""
    token = credentials.credentials
    service = UserService(db)
    user = service.verify_token(token)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user

async def get_current_active_user(
    current_user = Depends(get_current_user)
):
    """Get current active user."""
    if not current_user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    return current_user

async def get_current_admin_user(
    current_user = Depends(get_current_user)
):
    """Get current admin user."""
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    return current_user
```

## Using Dependencies

```python
# app/routers/orders.py
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from app.dependencies import get_current_user
from app.schemas.order import OrderCreate, OrderResponse
from app.services.order_service import OrderService

router = APIRouter()

@router.post("/", response_model=OrderResponse)
async def create_order(
    order_data: OrderCreate,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Create order for current user."""
    service = OrderService(db)
    return service.create_order(order_data, user_id=current_user.id)

@router.get("/my-orders", response_model=List[OrderResponse])
async def get_my_orders(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Get current user's orders."""
    service = OrderService(db)
    return service.get_orders_by_user(current_user.id)
```

## Async Database (SQLAlchemy 2.0)

```python
# app/database.py
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import declarative_base
from app.config import settings

engine = create_async_engine(settings.DATABASE_URL, echo=True)
AsyncSessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
Base = declarative_base()

async def get_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
```

```python
# app/services/user_service.py
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional

from app.models.user import User
from app.schemas.user import UserCreate, UserUpdate

class UserService:
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def get_user(self, user_id: int) -> Optional[User]:
        result = await self.db.execute(
            select(User).where(User.id == user_id)
        )
        return result.scalar_one_or_none()
    
    async def get_users(self, skip: int = 0, limit: int = 20) -> List[User]:
        result = await self.db.execute(
            select(User).offset(skip).limit(limit)
        )
        return result.scalars().all()
    
    async def create_user(self, user_data: UserCreate) -> User:
        user = User(**user_data.dict())
        self.db.add(user)
        await self.db.flush()
        await self.db.refresh(user)
        return user
```

## Background Tasks

```python
from fastapi import BackgroundTasks, Depends
from fastapi_mail import MessageSchema

async def send_welcome_email(user_email: str, user_name: str):
    """Send welcome email in background."""
    # Email sending logic
    pass

@router.post("/", response_model=UserResponse)
async def create_user(
    user_data: UserCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """Create user and send welcome email."""
    service = UserService(db)
    user = service.create_user(user_data)
    
    # Add email to background tasks
    background_tasks.add_task(send_welcome_email, user.email, user.name)
    
    return user
```

## Error Handling

```python
from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError

app = FastAPI()

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "error": {
                "code": "VALIDATION_ERROR",
                "message": "Invalid request data",
                "details": exc.errors()
            }
        }
    )

@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "error": {
                "code": "INTERNAL_ERROR",
                "message": "An unexpected error occurred"
            }
        }
    )
```

## Testing

```python
# tests/test_users.py
import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_create_user():
    response = client.post(
        "/api/users/",
        json={"email": "test@example.com", "name": "Test", "password": "password123"}
    )
    assert response.status_code == 201
    data = response.json()
    assert data["email"] == "test@example.com"
    assert "id" in data

def test_get_user():
    response = client.get("/api/users/1")
    assert response.status_code == 200
    data = response.json()
    assert "email" in data
    assert "name" in data

@pytest.mark.asyncio
async def test_list_users(async_client):
    response = await async_client.get("/api/users/")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
```

## Checklist

- [ ] Project structure organized
- [ ] Pydantic schemas for validation
- [ ] Dependency injection for auth
- [ ] Async database operations
- [ ] Error handlers defined
- [ ] Tests written
- [ ] CORS configured
- [ ] Documentation accessible at /docs
