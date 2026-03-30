from fastapi import APIRouter, Depends
from typing import Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text, func
from app.api.deps import get_db, get_current_user, AuthenticatedUser

router = APIRouter(tags=["analytics"])

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
