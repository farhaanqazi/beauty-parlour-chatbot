# FastAPI Patterns Skill - Beauty Parlour Chatbot

**Purpose:** FastAPI best practices tailored for the beauty parlour chatbot backend.

---

## 🎯 When to Use

- Creating new API endpoints
- Refactoring existing routes
- Designing request/response schemas
- Implementing middleware
- Error handling patterns

---

## 📋 Core Patterns

### 1. Async Endpoint Pattern

```python
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List

router = APIRouter()

@router.get("/appointments", response_model=List[AppointmentSchema])
async def get_appointments(
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get all appointments with pagination.
    
    - **skip**: Number of records to skip
    - **limit**: Maximum number of records to return
    - **current_user**: Authenticated user
    """
    appointments = await appointment_service.get_all(
        db=db, skip=skip, limit=limit, user_id=current_user.id
    )
    return appointments
```

**Key Points:**
- Always use `async def` for endpoints
- Use `Depends` for dependency injection
- Add docstrings with parameter descriptions
- Use `response_model` for type safety
- Inject database session via dependency

---

### 2. Error Handling Pattern

```python
from fastapi import HTTPException, status
from pydantic import BaseModel

class ErrorResponse(BaseModel):
    detail: str
    error_code: str
    context: dict | None = None

@router.post("/appointments", response_model=AppointmentSchema)
async def create_appointment(
    appointment: AppointmentCreate,
    db: AsyncSession = Depends(get_db)
):
    try:
        return await appointment_service.create(db, appointment)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
            headers={"X-Error-Code": "INVALID_INPUT"}
        )
    except DoesNotExistError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
            headers={"X-Error-Code": "RESOURCE_NOT_FOUND"}
        )
    except Exception as e:
        logger.exception("Unexpected error creating appointment")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error",
            headers={"X-Error-Code": "INTERNAL_ERROR"}
        )
```

**Key Points:**
- Catch specific exceptions first
- Log unexpected errors with `logger.exception()`
- Use custom error codes in headers
- Don't expose internal error details
- Use appropriate HTTP status codes

---

### 3. Pydantic v2 Schema Pattern

```python
from pydantic import BaseModel, Field, field_validator, ConfigDict
from datetime import datetime, date
from typing import Optional, Literal

class AppointmentBase(BaseModel):
    service_id: int = Field(..., gt=0, description="Service ID must be positive")
    appointment_date: date = Field(..., description="Date of appointment")
    appointment_time: str = Field(..., pattern=r"^([01]\d|2[0-3]):[0-5]\d$")
    customer_name: str = Field(..., min_length=2, max_length=100)
    customer_phone: str = Field(..., pattern=r"^\+?[\d\s-]{10,}$")
    notes: Optional[str] = Field(None, max_length=500)
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "service_id": 1,
                "appointment_date": "2026-03-26",
                "appointment_time": "14:30",
                "customer_name": "Fatima Ahmed",
                "customer_phone": "+960 123-4567",
                "notes": "First visit"
            }
        }
    )
    
    @field_validator("appointment_date")
    @classmethod
    def validate_date_not_in_past(cls, v: date) -> date:
        if v < date.today():
            raise ValueError("Appointment date cannot be in the past")
        return v

class AppointmentCreate(AppointmentBase):
    """Schema for creating a new appointment."""
    salon_id: int = Field(..., gt=0)
    channel_id: int = Field(..., gt=0)

class AppointmentResponse(AppointmentBase):
    """Schema for appointment response."""
    id: int
    status: Literal["pending", "confirmed", "completed", "cancelled"]
    created_at: datetime
    updated_at: datetime
    
    model_config = ConfigDict(from_attributes=True)
```

**Key Points:**
- Use `Field()` for validation constraints
- Add `description` for API documentation
- Use `field_validator` for custom validation
- Include `model_config` with examples
- Separate Create/Update/Response schemas
- Use `from_attributes=True` for ORM mode

---

### 4. Dependency Injection Pattern

```python
from functools import lru_cache
from typing import AsyncGenerator

class Settings(BaseSettings):
    database_url: str
    redis_url: str
    groq_api_key: str
    jwt_secret: str
    
    model_config = ConfigDict(env_file=".env")

@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()

async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Get database session."""
    async with session_local() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()

async def get_redis() -> AsyncGenerator[Redis, None]:
    """Get Redis client."""
    client = await aioredis.from_url(settings.redis_url)
    try:
        yield client
    finally:
        await client.close()

# Usage in endpoint
@router.get("/health")
async def health_check(
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis),
    settings: Settings = Depends(get_settings)
):
    return {
        "database": "connected",
        "redis": "connected",
        "environment": "production" if settings.database_url.startswith("postgresql://") else "development"
    }
```

**Key Points:**
- Use `lru_cache()` for singleton dependencies
- Use `AsyncGenerator` for resources needing cleanup
- Handle commit/rollback in database dependency
- Close connections in `finally` block

---

### 5. Router Organization Pattern

```python
# app/api/router.py
from fastapi import APIRouter
from . import appointments, users, salons, analytics, webhooks

api_router = APIRouter()

api_router.include_router(appointments.router, prefix="/appointments", tags=["appointments"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(salons.router, prefix="/salons", tags=["salons"])
api_router.include_router(analytics.router, prefix="/analytics", tags=["analytics"])
api_router.include_router(webhooks.router, prefix="/webhooks", tags=["webhooks"])
```

**Key Points:**
- Group related endpoints in modules
- Use `tags` for Swagger UI organization
- Centralize router registration
- Use consistent prefix naming

---

### 6. Authentication Pattern

```python
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import jwt

security = HTTPBearer()

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    settings: Settings = Depends(get_settings)
) -> User:
    """Get current authenticated user from JWT token."""
    token = credentials.credentials
    
    try:
        payload = jwt.decode(
            token, 
            settings.jwt_secret, 
            algorithms=["HS256"],
            options={"verify_exp": True}
        )
        user_id = payload.get("sub")
        if user_id is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token"
            )
        return await get_user_by_id(user_id)
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token expired"
        )
    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token"
        )

# Usage
@router.get("/me", response_model=UserResponse)
async def get_current_user_profile(
    current_user: User = Depends(get_current_user)
):
    return current_user
```

**Key Points:**
- Use `HTTPBearer` for token auth
- Validate token expiration
- Return 401 for auth failures
- Extract user info from token payload

---

### 7. Pagination Pattern

```python
from typing import Generic, TypeVar

T = TypeVar("T")

class PaginationParams(BaseModel):
    skip: int = Field(0, ge=0)
    limit: int = Field(100, ge=1, le=1000)

class PaginatedResponse(BaseModel, Generic[T]):
    items: List[T]
    total: int
    skip: int
    limit: int
    has_more: bool
    
    @classmethod
    def create(cls, items: List[T], total: int, skip: int, limit: int) -> "PaginatedResponse":
        return cls(
            items=items,
            total=total,
            skip=skip,
            limit=limit,
            has_more=(skip + limit) < total
        )

@router.get("/appointments", response_model=PaginatedResponse[AppointmentResponse])
async def list_appointments(
    pagination: PaginationParams = Depends(),
    db: AsyncSession = Depends(get_db)
):
    items, total = await appointment_service.get_paginated(
        db=db, 
        skip=pagination.skip, 
        limit=pagination.limit
    )
    return PaginatedResponse.create(
        items=items,
        total=total,
        skip=pagination.skip,
        limit=pagination.limit
    )
```

**Key Points:**
- Generic pagination response
- Validate pagination parameters
- Include `has_more` flag
- Consistent pagination interface

---

### 8. Background Tasks Pattern

```python
from fastapi import BackgroundTasks

async def send_email_notification(appointment_id: int):
    """Background task to send email."""
    appointment = await get_appointment(appointment_id)
    # Send email logic here
    logger.info(f"Email sent for appointment {appointment_id}")

@router.post("/appointments", response_model=AppointmentResponse)
async def create_appointment(
    appointment: AppointmentCreate,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db)
):
    new_appointment = await appointment_service.create(db, appointment)
    
    # Add background task
    background_tasks.add_task(
        send_email_notification,
        new_appointment.id
    )
    
    return new_appointment
```

**Key Points:**
- Use `BackgroundTasks` for non-critical work
- Don't await background tasks
- Pass required parameters to task function
- Log task completion

---

## ✅ Checklist

Before committing API code:

- [ ] All endpoints use `async def`
- [ ] Proper dependency injection with `Depends()`
- [ ] Pydantic schemas for request/response
- [ ] Error handling with appropriate status codes
- [ ] Docstrings with parameter descriptions
- [ ] Type hints throughout
- [ ] Database session properly managed
- [ ] Authentication/authorization where needed
- [ ] Input validation in schemas
- [ ] Examples in schema `model_config`

---

## 🚫 Anti-Patterns

### ❌ Don't: Synchronous endpoints
```python
# BAD
@router.get("/appointments")
def get_appointments():  # Should be async
    appointments = db.query(Appointment).all()  # Blocking call
    return appointments
```

### ✅ Do: Async endpoints
```python
# GOOD
@router.get("/appointments")
async def get_appointments(db: AsyncSession = Depends(get_db)):
    appointments = await db.execute(select(Appointment))
    return appointments.scalars().all()
```

### ❌ Don't: Raw SQL without parameterization
```python
# BAD - SQL injection risk
@router.get("/appointments/{id}")
async def get_appointment(id: int, db: AsyncSession):
    result = await db.execute(f"SELECT * FROM appointments WHERE id = {id}")
    return result.fetchone()
```

### ✅ Do: ORM or parameterized queries
```python
# GOOD
@router.get("/appointments/{id}")
async def get_appointment(id: int, db: AsyncSession):
    result = await db.execute(
        select(Appointment).where(Appointment.id == id)
    )
    return result.scalar_one_or_none()
```

### ❌ Don't: Expose internal errors
```python
# BAD
@router.post("/appointments")
async def create(appointment: AppointmentCreate):
    try:
        return await service.create(appointment)
    except Exception as e:
        return {"error": str(e), "traceback": traceback.format_exc()}
```

### ✅ Do: Generic error messages
```python
# GOOD
@router.post("/appointments")
async def create(appointment: AppointmentCreate):
    try:
        return await service.create(appointment)
    except Exception as e:
        logger.exception("Error creating appointment")
        raise HTTPException(
            status_code=500,
            detail="Internal server error"
        )
```

---

## 📚 Resources

- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [Pydantic v2 Documentation](https://docs.pydantic.dev/latest/)
- [SQLAlchemy 2.0 Documentation](https://docs.sqlalchemy.org/en/20/)
- Project backend: `Beauty_Parlour_chatbot-/app/`

---

**Last Updated:** 2026-03-25  
**Version:** 1.0.0
