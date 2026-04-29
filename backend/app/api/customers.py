from __future__ import annotations

from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, get_current_user, AuthenticatedUser
from app.db.models.customer import Customer
from app.db.models.appointment import Appointment
from app.core.enums import AppointmentStatus

router = APIRouter(tags=["customers"])


@router.get("/customers/{customer_id}")
async def get_customer(
    customer_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: AuthenticatedUser = Depends(get_current_user),
) -> dict:
    """
    Get customer profile by ID.
    
    Returns customer details including lifetime metrics (total visits, total spent).
    Requires authentication. Users can only access customers from their salon.
    """
    # Fetch customer with basic info
    statement = select(Customer).where(Customer.id == customer_id)
    result = await db.execute(statement)
    customer = result.scalar_one_or_none()
    
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found.")
    
    # Check tenant isolation - user can only access customers from their salon
    # Admin users can access all customers
    if current_user.role != 'admin' and str(customer.salon_id) != current_user.salon_id:
        raise HTTPException(status_code=403, detail="Access denied.")
    
    # Calculate lifetime metrics
    appointments_stmt = select(
        func.count(Appointment.id).label('total_visits'),
    ).where(
        Appointment.customer_id == customer_id,
        Appointment.status.in_(['completed', 'confirmed', 'pending'])
    )
    appointments_result = await db.execute(appointments_stmt)
    total_visits = appointments_result.scalar() or 0
    
    # Calculate total spent from completed appointments
    # Join with salon_services to get the price
    from app.db.models.salon import SalonService
    revenue_stmt = (
        select(func.sum(SalonService.price))
        .select_from(Appointment)
        .join(SalonService, Appointment.service_id == SalonService.id)
        .where(
            Appointment.customer_id == customer_id,
            Appointment.status == 'completed'
        )
    )
    revenue_result = await db.execute(revenue_stmt)
    total_spent = revenue_result.scalar() or 0.0
    
    # Get favorite services (most booked)
    favorite_services_stmt = (
        select(Appointment.service_name_snapshot, func.count(Appointment.id).label('count'))
        .where(
            Appointment.customer_id == customer_id,
            Appointment.status == 'completed',
            Appointment.service_name_snapshot.isnot(None)
        )
        .group_by(Appointment.service_name_snapshot)
        .order_by(func.count(Appointment.id).desc())
        .limit(5)
    )
    favorite_services_result = await db.execute(favorite_services_stmt)
    favorite_services = [
        {"service": row.service_name_snapshot, "count": row.count}
        for row in favorite_services_result.fetchall()
    ]
    
    # Get last visit date
    last_visit_stmt = (
        select(func.max(Appointment.appointment_at))
        .where(
            Appointment.customer_id == customer_id,
            Appointment.status == 'completed'
        )
    )
    last_visit_result = await db.execute(last_visit_stmt)
    last_visit = last_visit_result.scalar()
    
    return {
        "id": str(customer.id),
        "salon_id": str(customer.salon_id),
        "display_name": customer.display_name,
        "phone_number": customer.phone_number,
        "email": customer.email,
        "telegram_chat_id": customer.telegram_chat_id,
        "channel": customer.channel.value if hasattr(customer.channel, 'value') else str(customer.channel),
        "preferred_language": customer.preferred_language,
        "external_user_id": customer.external_user_id,
        "created_at": customer.created_at.isoformat() if customer.created_at else None,
        "metrics": {
            "total_visits": total_visits,
            "total_spent": total_spent,
            "last_visit": last_visit.isoformat() if last_visit else None,
            "favorite_services": favorite_services,
        }
    }


@router.get("/customers/{customer_id}/appointments")
async def get_customer_appointments(
    customer_id: UUID,
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: AuthenticatedUser = Depends(get_current_user),
) -> dict:
    """
    Get customer's appointment history.
    
    Returns paginated list of appointments for the customer.
    Includes service details and staff information if available.
    """
    # First verify customer exists and user has access
    customer_stmt = select(Customer).where(Customer.id == customer_id)
    customer_result = await db.execute(customer_stmt)
    customer = customer_result.scalar_one_or_none()
    
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found.")
    
    # Check tenant isolation
    if current_user.role != 'admin' and str(customer.salon_id) != current_user.salon_id:
        raise HTTPException(status_code=403, detail="Access denied.")
    
    # Fetch appointments with related data
    statement = (
        select(Appointment)
        .where(Appointment.customer_id == customer_id)
        .order_by(Appointment.appointment_at.desc())
        .offset(offset)
        .limit(limit)
    )
    result = await db.execute(statement)
    appointments = result.scalars().all()
    
    # Get total count for pagination
    count_stmt = select(func.count(Appointment.id)).where(Appointment.customer_id == customer_id)
    count_result = await db.execute(count_stmt)
    total = count_result.scalar() or 0
    
    return {
        "data": [
            {
                "id": str(apt.id),
                "booking_reference": apt.booking_reference,
                "status": apt.status.value if hasattr(apt.status, 'value') else str(apt.status),
                "service_name": apt.service_name_snapshot,
                "appointment_at": apt.appointment_at.isoformat(),
                "confirmed_at": apt.confirmed_at.isoformat() if apt.confirmed_at else None,
                "cancelled_at": apt.cancelled_at.isoformat() if apt.cancelled_at else None,
                "cancellation_reason": apt.cancellation_reason,
                "notes": apt.notes,
                "created_at": apt.created_at.isoformat() if apt.created_at else None,
            }
            for apt in appointments
        ],
        "total": total,
        "page": (offset // limit) + 1 if limit > 0 else 1,
        "page_size": limit,
    }


@router.get("/customers")
async def list_customers(
    salon_id: str | None = Query(None),
    search: str | None = Query(None),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: AuthenticatedUser = Depends(get_current_user),
) -> dict:
    """
    List customers with optional filtering.
    
    Supports filtering by salon_id and search by name/phone.
    Admin users can see all customers or filter by salon_id.
    """
    # Build query
    statement = select(Customer)
    
    # Apply salon filter (tenant isolation)
    if current_user.role != 'admin':
        # Non-admin users can only see customers from their salon
        statement = statement.where(Customer.salon_id == UUID(current_user.salon_id))
    elif salon_id:
        # Admin can filter by specific salon
        statement = statement.where(Customer.salon_id == salon_id)
    
    # Apply search filter
    if search:
        search_filter = (
            (Customer.display_name.ilike(f"%{search}%")) |
            (Customer.phone_number.ilike(f"%{search}%"))
        )
        statement = statement.where(search_filter)
    
    # Get total count before pagination
    count_stmt = select(func.count(Customer.id)).select_from(statement.subquery())
    count_result = await db.execute(count_stmt)
    total = count_result.scalar() or 0
    
    # Apply pagination
    statement = statement.order_by(Customer.display_name.nullsfirst()).offset(offset).limit(limit)
    result = await db.execute(statement)
    customers = result.scalars().all()
    
    return {
        "data": [
            {
                "id": str(cust.id),
                "display_name": cust.display_name,
                "phone_number": cust.phone_number,
                "email": cust.email,
                "channel": cust.channel.value if hasattr(cust.channel, 'value') else str(cust.channel),
                "created_at": cust.created_at.isoformat() if cust.created_at else None,
            }
            for cust in customers
        ],
        "total": total,
        "page": (offset // limit) + 1 if limit > 0 else 1,
        "page_size": limit,
    }
