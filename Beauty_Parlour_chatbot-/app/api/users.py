from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import joinedload

from app.api.deps import get_db, get_current_user, require_roles, AuthenticatedUser
from app.db.models.user import User
from app.db.models.salon import Salon
from typing import Optional


router = APIRouter(tags=["users"])


@router.get("/users")
async def list_users(
    salon_id: Optional[UUID] = None,
    role: Optional[str] = None,
    is_active: Optional[bool] = None,
    db=Depends(get_db),
    user: AuthenticatedUser = Depends(require_roles("admin")),
) -> dict:
    """
    List users with optional filtering.

    Admin access only.
    """
    statement = select(User).options(joinedload(User.salon))
    
    # Apply filters
    if salon_id:
        statement = statement.where(User.salon_id == salon_id)
    if role:
        statement = statement.where(User.role == role)
    if is_active is not None:
        statement = statement.where(User.is_active == is_active)
    
    statement = statement.order_by(User.full_name)
    result = await db.execute(statement)
    users = result.scalars().unique().all()
    
    data = [
        {
            "id": str(user.id),
            "email": user.email,
            "full_name": user.full_name,
            "role": user.role.value,
            "salon_id": str(user.salon_id) if user.salon_id else None,
            "salon_name": user.salon.name if user.salon else None,
            "is_active": user.is_active,
            "created_at": user.created_at.isoformat() if user.created_at else None,
        }
        for user in users
    ]
    
    return {"data": data, "total": len(data)}


@router.get("/users/{user_id}")
async def get_user(
    user_id: UUID,
    db=Depends(get_db),
    user: AuthenticatedUser = Depends(require_roles("admin")),
) -> dict:
    """
    Get a single user by ID.
    Admin access only.
    """
    statement = (
        select(User)
        .options(joinedload(User.salon))
        .where(User.id == user_id)
    )
    result = await db.execute(statement)
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    
    return {
        "id": str(user.id),
        "email": user.email,
        "full_name": user.full_name,
        "role": user.role.value,
        "salon_id": str(user.salon_id) if user.salon_id else None,
        "salon_name": user.salon.name if user.salon else None,
        "is_active": user.is_active,
        "created_at": user.created_at.isoformat() if user.created_at else None,
        "updated_at": user.updated_at.isoformat() if user.updated_at else None,
    }


@router.post("/users")
async def create_user(
    email: str = Query(...),
    full_name: str = Query(...),
    role: str = Query(...),
    salon_id: Optional[UUID] = Query(None),
    db=Depends(get_db),
    user: AuthenticatedUser = Depends(require_roles("admin")),
) -> dict:
    """
    Create a new user.

    Admin access only.

    Note: This is a simplified implementation. A full implementation would:
    - Validate role permissions
    - Create Supabase Auth user
    - Send invitation email
    """
    from app.db.models.user import User as UserModel
    from app.core.enums import UserRole
    
    # Validate role
    try:
        role_enum = UserRole(role.lower())
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid role. Must be one of: {[r.value for r in UserRole]}",
        )
    
    # Validate salon_id for non-admin roles
    if role_enum != UserRole.ADMIN and not salon_id:
        raise HTTPException(
            status_code=400,
            detail="Salon ID is required for non-admin users.",
        )
    
    # Check if salon exists
    if salon_id:
        salon_result = await db.execute(select(Salon).where(Salon.id == salon_id))
        if not salon_result.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Salon not found.")
    
    # Check if email already exists
    existing = await db.execute(select(UserModel).where(UserModel.email == email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered.")
    
    # Create user (note: in production, this would also create Supabase Auth user)
    import uuid
    user = UserModel(
        id=uuid.uuid4(),
        email=email,
        full_name=full_name,
        role=role_enum,
        salon_id=salon_id,
        is_active=True,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    
    return {
        "id": str(user.id),
        "email": user.email,
        "full_name": user.full_name,
        "role": user.role.value,
        "salon_id": str(user.salon_id) if user.salon_id else None,
        "is_active": user.is_active,
    }


@router.patch("/users/{user_id}")
async def update_user(
    user_id: UUID,
    is_active: Optional[bool] = Query(None),
    full_name: Optional[str] = Query(None),
    db=Depends(get_db),
    user: AuthenticatedUser = Depends(require_roles("admin")),
) -> dict:
    """
    Update user details.
    Admin access only.
    """
    from app.db.models.user import User as UserModel
    
    statement = select(UserModel).where(UserModel.id == user_id)
    result = await db.execute(statement)
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    
    if is_active is not None:
        user.is_active = is_active
    if full_name is not None:
        user.full_name = full_name
    
    await db.commit()
    await db.refresh(user)
    
    return {
        "id": str(user.id),
        "email": user.email,
        "full_name": user.full_name,
        "role": user.role.value,
        "is_active": user.is_active,
    }


@router.delete("/users/{user_id}")
async def delete_user(
    user_id: UUID,
    db=Depends(get_db),
    user: AuthenticatedUser = Depends(require_roles("admin")),
) -> dict:
    """
    Delete a user.

    Admin access only.

    Note: This only deletes the user record, not the Supabase Auth user.
    """
    from app.db.models.user import User as UserModel
    
    statement = select(UserModel).where(UserModel.id == user_id)
    result = await db.execute(statement)
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    
    await db.delete(user)
    await db.commit()
    
    return {"id": str(user_id), "deleted": True}
