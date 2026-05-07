from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, Query, Request
from typing import Dict, Any, List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text, func, extract, case
from sqlalchemy.orm import selectinload

from app.api.deps import get_db, get_current_user, AuthenticatedUser
from app.db.models.appointment import Appointment
from app.db.models.salon import SalonService
from app.core.enums import AppointmentStatus
from app.middleware.rate_limiter import limiter as shared_limiter

router = APIRouter(tags=["analytics"])

# ============================================================================
# Helper Functions
# ============================================================================

def get_salon_filter(user: AuthenticatedUser) -> tuple:
    """Get salon filter based on user role."""
    if user.role == 'admin':
        return None, {}
    return "WHERE salon_id = :salon_id", {"salon_id": user.salon_id}


# ============================================================================
# Basic KPIs Endpoint (Existing)
# ============================================================================

@router.get("/analytics/kpis")
@shared_limiter.limit("200 per minute")
async def get_kpis(
    request: Request,
    db: AsyncSession = Depends(get_db),
    user: AuthenticatedUser = Depends(get_current_user),
) -> Dict[str, Any]:
    """
    Get KPIs for the user's salon.

    Includes real revenue data from appointments.final_price column.
    """
    try:
        # Build salon filter for tenant isolation
        if user.role == 'admin' and not user.salon_id:
            salon_filter = ""
            params = {}
        else:
            salon_filter = "WHERE a.salon_id = :salon_id"
            params = {"salon_id": user.salon_id}

        # Query for real revenue + appointment stats
        query = text(f"""
            SELECT
                COALESCE(SUM(CASE WHEN a.status IN ('completed', 'confirmed', 'pending') THEN a.final_price ELSE 0 END), 0) as total_revenue,
                COUNT(*) as total_appointments,
                COUNT(*) FILTER (WHERE a.appointment_at::date = CURRENT_DATE) as todays_appointments,
                COUNT(*) FILTER (WHERE a.status = 'pending') as pending_appointments,
                COUNT(*) FILTER (WHERE a.status = 'confirmed') as confirmed_appointments,
                COUNT(*) FILTER (WHERE a.status = 'completed') as completed_appointments,
                COUNT(DISTINCT a.customer_id) as unique_customers
            FROM appointments a
            {salon_filter}
        """)

        result = await db.execute(query, params)
        row = result.fetchone()

        # Get revenue by service
        service_query = text(f"""
            SELECT
                ss.name as service_name,
                COUNT(*) as count,
                COALESCE(SUM(a.final_price), 0) as revenue
            FROM appointments a
            JOIN salon_services ss ON a.service_id = ss.id
            {salon_filter}
            GROUP BY ss.name
            ORDER BY revenue DESC
        """)

        service_result = await db.execute(service_query, params)
        service_rows = service_result.fetchall()

        revenue_by_service = [
            {
                "service": row.service_name,
                "count": row.count,
                "revenue": float(row.revenue) if row.revenue else 0
            }
            for row in service_rows
        ]

        return {
            "total_revenue": float(row.total_revenue) if row.total_revenue else 0,
            "total_appointments": row.total_appointments if row else 0,
            "todays_appointments": row.todays_appointments if row else 0,
            "pending_appointments": row.pending_appointments if row else 0,
            "confirmed_appointments": row.confirmed_appointments if row else 0,
            "completed_appointments": row.completed_appointments if row else 0,
            "unique_customers": row.unique_customers if row else 0,
            "revenue_by_service": revenue_by_service,
        }
    except Exception as e:
        print(f"Error in kpis endpoint: {e}")
        import traceback
        traceback.print_exc()
        return {
            "error": str(e),
            "total_revenue": 0,
            "total_appointments": 0,
            "todays_appointments": 0,
            "pending_appointments": 0,
            "confirmed_appointments": 0,
            "completed_appointments": 0,
            "unique_customers": 0,
            "revenue_by_service": [],
        }


# ============================================================================
# Revenue Analytics Endpoints
# ============================================================================

@router.get("/analytics/revenue/trends")
@shared_limiter.limit("200 per minute")
async def get_revenue_trends(
    request: Request,
    days: int = Query(default=30, ge=1, le=365),
    start_date: str | None = Query(default=None),
    end_date: str | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
    user: AuthenticatedUser = Depends(get_current_user),
) -> Dict[str, Any]:
    """
    Daily revenue trends for charting. Accepts either an explicit
    start_date/end_date window (ISO 8601) or a `days` lookback (default 30).

    Revenue uses `a.final_price` and counts statuses (completed, confirmed, pending) —
    matching the kpis endpoint so the numbers are consistent across the dashboard.
    """
    # Resolve date range
    if start_date and end_date:
        try:
            q_start = datetime.fromisoformat(start_date.replace("Z", "+00:00"))
            q_end = datetime.fromisoformat(end_date.replace("Z", "+00:00"))
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid ISO date in start_date / end_date")
    else:
        q_end = datetime.now()
        q_start = q_end - timedelta(days=days)

    # Tenant filter (qualified column to avoid ambiguity in any joined query)
    salon_filter = ""
    params: Dict[str, Any] = {"q_start": q_start, "q_end": q_end}
    if user.role != "admin":
        salon_filter = "AND a.salon_id = :salon_id"
        params["salon_id"] = user.salon_id

    query = text(f"""
        SELECT
            DATE(a.appointment_at) as date,
            COALESCE(SUM(a.final_price), 0) as revenue,
            COUNT(a.id) as appointment_count
        FROM appointments a
        WHERE a.status IN ('completed', 'confirmed', 'pending')
          AND a.appointment_at >= :q_start
          AND a.appointment_at < :q_end
          {salon_filter}
        GROUP BY DATE(a.appointment_at)
        ORDER BY DATE(a.appointment_at) ASC
    """)

    try:
        result = await db.execute(query, params)
        rows = result.fetchall()
    except Exception as e:
        print(f"Error in revenue trends: {e}")
        return {"data": [], "total_revenue": 0, "total_appointments": 0, "error": str(e)}

    return {
        "data": [
            {
                "date": row.date.isoformat(),
                "revenue": float(row.revenue) if row.revenue else 0,
                "appointment_count": row.appointment_count,
            }
            for row in rows
        ],
        "total_revenue": sum(float(row.revenue) if row.revenue else 0 for row in rows),
        "total_appointments": sum(row.appointment_count for row in rows),
    }


@router.get("/analytics/revenue/by-service")
@shared_limiter.limit("200 per minute")
async def get_revenue_by_service(
    request: Request,
    days: int = Query(default=30, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
    user: AuthenticatedUser = Depends(get_current_user),
) -> Dict[str, Any]:
    """Get revenue breakdown by service."""
    try:
        filter_clause, params = get_salon_filter(user)
        
        if filter_clause:
            filter_clause = f"AND {filter_clause.replace('WHERE ', '')}"
        
        query = text(f"""
            SELECT 
                a.service_name_snapshot as service,
                COUNT(a.id) as count,
                COALESCE(SUM(ss.price), 0) as revenue
            FROM appointments a
            LEFT JOIN salon_services ss ON a.service_id = ss.id
            WHERE a.status = 'completed'
              AND a.appointment_at >= :start_date
              {filter_clause}
            GROUP BY a.service_name_snapshot
            ORDER BY revenue DESC
        """)
        
        start_date = datetime.now() - timedelta(days=days)
        result = await db.execute(query, {**params, "start_date": start_date})
        rows = result.fetchall()
        
        return {
            "data": [
                {"service": row.service, "count": row.count, "revenue": float(row.revenue) if row.revenue else 0}
                for row in rows
            ],
        }
    except Exception as e:
        print(f"Error in revenue by service: {e}")
        return {"data": [], "error": str(e)}


# ============================================================================
# Appointment Analytics Endpoints
# ============================================================================

@router.get("/analytics/appointments/by-day-of-week")
@shared_limiter.limit("200 per minute")
async def get_appointments_by_day_of_week(
    request: Request,
    days: int = Query(default=90, ge=7, le=365),
    db: AsyncSession = Depends(get_db),
    user: AuthenticatedUser = Depends(get_current_user),
) -> Dict[str, Any]:
    """Get appointment distribution by day of week."""
    try:
        filter_clause, params = get_salon_filter(user)
        
        if filter_clause:
            filter_clause = f"AND {filter_clause.replace('WHERE ', '')}"
        
        query = text(f"""
            SELECT 
                EXTRACT(DOW FROM appointment_at) as day_num,
                TO_CHAR(appointment_at, 'Day') as day_name,
                COUNT(*) as count
            FROM appointments
            WHERE appointment_at >= :start_date
              {filter_clause}
            GROUP BY EXTRACT(DOW FROM appointment_at), TO_CHAR(appointment_at, 'Day')
            ORDER BY day_num
        """)
        
        start_date = datetime.now() - timedelta(days=days)
        result = await db.execute(query, {**params, "start_date": start_date})
        rows = result.fetchall()
        
        day_order = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
        data = {day: 0 for day in day_order}
        for row in rows:
            day_name = row.day_name.strip()
            data[day_name] = row.count
        
        return {
            "data": [{"day": day, "count": count} for day, count in data.items()],
        }
    except Exception as e:
        print(f"Error in appointments by day: {e}")
        return {"data": [], "error": str(e)}


@router.get("/analytics/appointments/by-hour")
@shared_limiter.limit("200 per minute")
async def get_appointments_by_hour(
    request: Request,
    days: int = Query(default=30, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
    user: AuthenticatedUser = Depends(get_current_user),
) -> Dict[str, Any]:
    """Get appointment distribution by hour of day."""
    try:
        filter_clause, params = get_salon_filter(user)
        
        if filter_clause:
            filter_clause = f"AND {filter_clause.replace('WHERE ', '')}"
        
        query = text(f"""
            SELECT 
                EXTRACT(HOUR FROM appointment_at) as hour,
                COUNT(*) as count
            FROM appointments
            WHERE appointment_at >= :start_date
              {filter_clause}
            GROUP BY EXTRACT(HOUR FROM appointment_at)
            ORDER BY hour
        """)
        
        start_date = datetime.now() - timedelta(days=days)
        result = await db.execute(query, {**params, "start_date": start_date})
        rows = result.fetchall()
        
        # Initialize all hours
        data = {hour: 0 for hour in range(24)}
        for row in rows:
            data[row.hour] = row.count
        
        return {
            "data": [{"hour": hour, "count": count} for hour, count in data.items()],
        }
    except Exception as e:
        print(f"Error in appointments by hour: {e}")
        return {"data": [], "error": str(e)}


@router.get("/analytics/appointments/status-breakdown")
@shared_limiter.limit("200 per minute")
async def get_appointment_status_breakdown(
    request: Request,
    days: int = Query(default=30, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
    user: AuthenticatedUser = Depends(get_current_user),
) -> Dict[str, Any]:
    """Get appointment breakdown by status."""
    try:
        filter_clause, params = get_salon_filter(user)
        
        if filter_clause:
            filter_clause = f"AND {filter_clause.replace('WHERE ', '')}"
        
        query = text(f"""
            SELECT 
                status,
                COUNT(*) as count
            FROM appointments
            WHERE appointment_at >= :start_date
              {filter_clause}
            GROUP BY status
        """)
        
        start_date = datetime.now() - timedelta(days=days)
        result = await db.execute(query, {**params, "start_date": start_date})
        rows = result.fetchall()
        
        return {
            "data": [{"status": row.status, "count": row.count} for row in rows],
        }
    except Exception as e:
        print(f"Error in status breakdown: {e}")
        return {"data": [], "error": str(e)}


@router.get("/analytics/appointments/cancellation-rate")
@shared_limiter.limit("200 per minute")
async def get_cancellation_rate(
    request: Request,
    days: int = Query(default=30, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
    user: AuthenticatedUser = Depends(get_current_user),
) -> Dict[str, Any]:
    """Get cancellation rate analytics."""
    try:
        filter_clause, params = get_salon_filter(user)
        
        if filter_clause:
            filter_clause = f"AND {filter_clause.replace('WHERE ', '')}"
        
        query = text(f"""
            SELECT 
                COUNT(*) as total,
                COUNT(*) FILTER (WHERE status LIKE 'cancelled%') as cancelled,
                COUNT(*) FILTER (WHERE status = 'no_show') as no_shows
            FROM appointments
            WHERE appointment_at >= :start_date
              {filter_clause}
        """)
        
        start_date = datetime.now() - timedelta(days=days)
        result = await db.execute(query, {**params, "start_date": start_date})
        row = result.fetchone()
        
        total = row.total or 0
        cancelled = row.cancelled or 0
        no_shows = row.no_shows or 0
        
        cancellation_rate = (cancelled / total * 100) if total > 0 else 0
        no_show_rate = (no_shows / total * 100) if total > 0 else 0
        
        return {
            "total_appointments": total,
            "cancelled": cancelled,
            "no_shows": no_shows,
            "cancellation_rate": round(cancellation_rate, 2),
            "no_show_rate": round(no_show_rate, 2),
        }
    except Exception as e:
        print(f"Error in cancellation rate: {e}")
        return {"total_appointments": 0, "cancelled": 0, "no_shows": 0, "cancellation_rate": 0, "no_show_rate": 0, "error": str(e)}


# ============================================================================
# Staff Analytics Endpoints
# ============================================================================

@router.get("/analytics/staff/utilization")
@shared_limiter.limit("200 per minute")
async def get_staff_utilization(
    request: Request,
    days: int = Query(default=30, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
    user: AuthenticatedUser = Depends(get_current_user),
) -> Dict[str, Any]:
    """Get staff utilization metrics."""
    try:
        filter_clause, params = get_salon_filter(user)
        
        if filter_clause:
            filter_clause = f"AND {filter_clause.replace('WHERE ', '')}"
        
        # Get staff utilization from appointments
        # Changed RIGHT JOIN to INNER JOIN + added salon_id filter on users
        # to prevent leaking user data from other salons
        query = text(f"""
            SELECT
                u.full_name,
                u.id as user_id,
                COUNT(a.id) as appointment_count,
                COALESCE(SUM(ss.price), 0) as revenue_generated
            FROM appointments a
            LEFT JOIN salon_services ss ON a.service_id = ss.id
            INNER JOIN users u ON u.salon_id = a.salon_id
            WHERE a.appointment_at >= :start_date
              {filter_clause}
            GROUP BY u.full_name, u.id
            ORDER BY appointment_count DESC
        """)
        
        start_date = datetime.now() - timedelta(days=days)
        result = await db.execute(query, {**params, "start_date": start_date})
        rows = result.fetchall()
        
        return {
            "data": [
                {
                    "user_id": str(row.user_id),
                    "name": row.full_name or "Unnamed Staff",
                    "appointment_count": row.appointment_count,
                    "revenue_generated": float(row.revenue_generated) if row.revenue_generated else 0,
                }
                for row in rows
            ],
        }
    except Exception as e:
        print(f"Error in staff utilization: {e}")
        return {"data": [], "error": str(e)}


# ============================================================================
# Customer Analytics Endpoints
# ============================================================================

@router.get("/analytics/customers/new-vs-repeat")
@shared_limiter.limit("200 per minute")
async def get_new_vs_repeat_customers(
    request: Request,
    days: int = Query(default=30, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
    user: AuthenticatedUser = Depends(get_current_user),
) -> Dict[str, Any]:
    """Get new vs repeat customer analytics."""
    try:
        filter_clause, params = get_salon_filter(user)
        
        if filter_clause:
            filter_clause = f"AND {filter_clause.replace('WHERE ', '')}"
        
        # Get customers who had their first appointment in the period (new)
        # vs customers who had appointments before the period (repeat)
        query = text(f"""
            WITH customer_first_visit AS (
                SELECT 
                    customer_id,
                    MIN(appointment_at) as first_visit
                FROM appointments
                {filter_clause.replace('AND ', 'WHERE ', 1) if filter_clause else ''}
                GROUP BY customer_id
            )
            SELECT 
                COUNT(*) FILTER (WHERE first_visit >= :start_date) as new_customers,
                COUNT(*) FILTER (WHERE first_visit < :start_date) as repeat_customers
            FROM customer_first_visit
        """)
        
        start_date = datetime.now() - timedelta(days=days)
        result = await db.execute(query, {**params, "start_date": start_date})
        row = result.fetchone()
        
        return {
            "new_customers": row.new_customers or 0,
            "repeat_customers": row.repeat_customers or 0,
        }
    except Exception as e:
        print(f"Error in new vs repeat: {e}")
        return {"new_customers": 0, "repeat_customers": 0, "error": str(e)}


@router.get("/analytics/customers/lifetime-value-distribution")
@shared_limiter.limit("200 per minute")
async def get_lifetime_value_distribution(
    request: Request,
    db: AsyncSession = Depends(get_db),
    user: AuthenticatedUser = Depends(get_current_user),
) -> Dict[str, Any]:
    """Get customer lifetime value distribution."""
    try:
        filter_clause, params = get_salon_filter(user)
        
        if filter_clause:
            filter_clause = f"AND {filter_clause.replace('WHERE ', '')}"
        
        query = text(f"""
            WITH customer_ltv AS (
                SELECT 
                    c.id as customer_id,
                    COUNT(a.id) as total_visits,
                    COALESCE(SUM(ss.price), 0) as total_spent
                FROM customers c
                LEFT JOIN appointments a ON c.id = a.customer_id AND a.status = 'completed'
                LEFT JOIN salon_services ss ON a.service_id = ss.id
                {filter_clause.replace('AND ', 'WHERE ', 1) if filter_clause else 'WHERE c.salon_id = c.salon_id'}
                GROUP BY c.id
            )
            SELECT 
                COUNT(*) FILTER (WHERE total_spent = 0) as zero_value,
                COUNT(*) FILTER (WHERE total_spent > 0 AND total_spent < 100) as low_value,
                COUNT(*) FILTER (WHERE total_spent >= 100 AND total_spent < 500) as medium_value,
                COUNT(*) FILTER (WHERE total_spent >= 500 AND total_spent < 1000) as high_value,
                COUNT(*) FILTER (WHERE total_spent >= 1000) as premium_value
            FROM customer_ltv
        """)
        
        result = await db.execute(query, params)
        row = result.fetchone()
        
        return {
            "data": [
                {"range": "$0", "count": row.zero_value or 0},
                {"range": "$1-$99", "count": row.low_value or 0},
                {"range": "$100-$499", "count": row.medium_value or 0},
                {"range": "$500-$999", "count": row.high_value or 0},
                {"range": "$1000+", "count": row.premium_value or 0},
            ],
        }
    except Exception as e:
        print(f"Error in LTV distribution: {e}")
        return {"data": [], "error": str(e)}
