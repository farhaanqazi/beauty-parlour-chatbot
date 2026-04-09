from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, Query
from typing import Dict, Any, List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text, func, extract, case
from sqlalchemy.orm import selectinload

from app.api.deps import get_db, get_current_user, AuthenticatedUser
from app.db.models.appointment import Appointment
from app.db.models.salon import SalonService
from app.core.enums import AppointmentStatus

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
async def get_kpis(
    db: AsyncSession = Depends(get_db),
    user: AuthenticatedUser = Depends(get_current_user),
) -> Dict[str, Any]:
    """
    Get KPIs for the user's salon.

    Requires authentication. Returns salon-specific metrics based on user's salon_id.
    Admin users can see system-wide metrics.
    """
    try:
        # Test database connection first
        result = await db.execute(text("SELECT 1"))
        print(f"Database connection OK for user: {user.email}")

        # For admin users, return system-wide metrics
        # For salon_owner/reception, return salon-specific metrics
        if user.role == 'admin':
            query = text("""
                SELECT
                    (SELECT COUNT(*) FROM salons) as total_salons,
                    (SELECT COUNT(*) FROM users) as total_users,
                    (SELECT COUNT(*) FROM appointments WHERE appointment_at::date = CURRENT_DATE) as todays_appointments,
                    (SELECT COUNT(*) FROM appointments WHERE status = 'pending') as pending_appointments,
                    (SELECT COUNT(*) FROM appointments WHERE status = 'confirmed') as confirmed_appointments,
                    (SELECT COUNT(*) FROM appointments WHERE status = 'completed') as completed_appointments,
                    (SELECT COUNT(*) FROM appointments WHERE status = 'no_show') as no_shows
            """)
        else:
            # Salon-specific metrics (tenant isolation)
            query = text("""
                SELECT
                    1 as total_salons,
                    (SELECT COUNT(*) FROM users WHERE salon_id = :salon_id) as total_users,
                    (SELECT COUNT(*) FROM appointments
                     WHERE salon_id = :salon_id AND appointment_at::date = CURRENT_DATE) as todays_appointments,
                    (SELECT COUNT(*) FROM appointments
                     WHERE salon_id = :salon_id AND status = 'pending') as pending_appointments,
                    (SELECT COUNT(*) FROM appointments
                     WHERE salon_id = :salon_id AND status = 'confirmed') as confirmed_appointments,
                    (SELECT COUNT(*) FROM appointments
                     WHERE salon_id = :salon_id AND status = 'completed') as completed_appointments,
                    (SELECT COUNT(*) FROM appointments
                     WHERE salon_id = :salon_id AND status = 'no_show') as no_shows
            """)

        result = await db.execute(query, {"salon_id": user.salon_id})
        row = result.fetchone()

        return {
            "total_salons": row.total_salons if row else 0,
            "total_users": row.total_users if row else 0,
            "todays_appointments": row.todays_appointments if row else 0,
            "pending_appointments": row.pending_appointments if row else 0,
            "confirmed_appointments": row.confirmed_appointments if row else 0,
            "completed_appointments": row.completed_appointments if row else 0,
            "no_shows": row.no_shows if row else 0
        }
    except Exception as e:
        print(f"Error in kpis endpoint: {e}")
        import traceback
        traceback.print_exc()
        return {
            "error": str(e),
            "total_salons": 0,
            "total_users": 0,
            "todays_appointments": 0,
            "pending_appointments": 0,
            "confirmed_appointments": 0,
            "completed_appointments": 0,
            "no_shows": 0
        }


# ============================================================================
# Revenue Analytics Endpoints
# ============================================================================

@router.get("/analytics/revenue/trends")
async def get_revenue_trends(
    days: int = Query(default=30, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
    user: AuthenticatedUser = Depends(get_current_user),
) -> Dict[str, Any]:
    """
    Get revenue trends over the specified period.
    Returns daily revenue data for charting.
    """
    try:
        filter_clause, params = get_salon_filter(user)
        
        if filter_clause:
            filter_clause = f"AND {filter_clause.replace('WHERE ', '')}"
        
        query = text(f"""
            SELECT 
                DATE(a.appointment_at) as date,
                COALESCE(SUM(ss.price), 0) as revenue,
                COUNT(a.id) as appointment_count
            FROM appointments a
            LEFT JOIN salon_services ss ON a.service_id = ss.id
            WHERE a.status = 'completed'
              AND a.appointment_at >= :start_date
              {filter_clause}
            GROUP BY DATE(a.appointment_at)
            ORDER BY DATE(a.appointment_at) ASC
        """)
        
        start_date = datetime.now() - timedelta(days=days)
        result = await db.execute(query, {**params, "start_date": start_date})
        rows = result.fetchall()
        
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
    except Exception as e:
        print(f"Error in revenue trends: {e}")
        return {"data": [], "total_revenue": 0, "total_appointments": 0, "error": str(e)}


@router.get("/analytics/revenue/by-service")
async def get_revenue_by_service(
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
async def get_appointments_by_day_of_week(
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
async def get_appointments_by_hour(
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
async def get_appointment_status_breakdown(
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
async def get_cancellation_rate(
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
async def get_staff_utilization(
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
async def get_new_vs_repeat_customers(
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
async def get_lifetime_value_distribution(
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
