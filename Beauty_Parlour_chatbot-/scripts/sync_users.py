"""
Fix missing user profiles by syncing Supabase Auth users to the local users table.
"""
import sys
import os

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.core.config import get_settings
from app.db.session import SessionLocal
from supabase import create_client

settings = get_settings()

# Initialize Supabase client (admin key required)
supabase = create_client(settings.supabase_url, settings.supabase_service_role_key)

db = SessionLocal()

try:
    # Get all users from Supabase Auth
    auth_users_response = supabase.auth.admin.list_users()
    auth_users = auth_users_response.users if hasattr(auth_users_response, 'users') else []
    
    print(f"Found {len(auth_users)} users in Supabase Auth")
    
    for auth_user in auth_users:
        email = auth_user.email
        auth_uuid = auth_user.id
        
        # Check if user already exists in local table
        existing = db.execute(
            "SELECT id FROM users WHERE id = :uuid",
            {"uuid": auth_uuid}
        ).fetchone()
        
        if existing:
            print(f"✓ {email} - already exists in users table")
            continue
        
        # Determine role from email or metadata
        role = "salon_owner"  # Default
        if "admin" in email:
            role = "admin"
        elif "reception" in email:
            role = "reception"
        
        # Get salon_id for demo salon
        salon = db.execute(
            "SELECT id FROM salons WHERE slug = 'demo-beauty-palace'"
        ).fetchone()
        
        salon_id = salon.id if salon else None
        
        # Insert user into local table
        db.execute(
            """
            INSERT INTO users (id, email, full_name, role, salon_id, is_active)
            VALUES (:uuid, :email, :name, :role, :salon_id, TRUE)
            ON CONFLICT (id) DO NOTHING
            """,
            {
                "uuid": auth_uuid,
                "email": email,
                "name": email.split("@")[0].title(),
                "role": role,
                "salon_id": salon_id,
            }
        )
        db.commit()
        print(f"✓ Created user profile: {email} (role: {role})")
    
    print("\n✅ All user profiles synced!")
    
except Exception as e:
    print(f"❌ Error: {e}")
    import traceback
    traceback.print_exc()
finally:
    db.close()
