import os
import httpx
import uuid
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

load_dotenv('.env')
load_dotenv('../.env')

DATABASE_URL = os.getenv('DATABASE_URL')
SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_SERVICE_ROLE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY')

if not all([DATABASE_URL, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY]):
    print("Missing required environment variables (DATABASE_URL, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)")
    exit(1)

sync_url = DATABASE_URL.replace('postgresql+asyncpg://', 'postgresql://')
engine = create_engine(sync_url)

def create_owners():
    with engine.connect() as conn:
        # 1. Get all salons
        result = conn.execute(text("SELECT id, name, slug FROM salons"))
        salons = result.fetchall()
        
        # 2. Get existing owners
        result = conn.execute(text("SELECT salon_id FROM users WHERE role = 'salon_owner'"))
        existing_owner_salon_ids = {row[0] for row in result.fetchall()}
        
        print(f"Processing {len(salons)} salons...")
        
        for salon_id, salon_name, salon_slug in salons:
            if salon_id in existing_owner_salon_ids:
                print(f" - {salon_name}: Already has an owner. Skipping.")
                continue
            
            email = f"owner@{salon_slug}.com"
            password = "owner123" # Default password
            
            print(f" - {salon_name}: Creating owner ({email})...")
            
            # 3. Create user in Supabase Auth using Admin API
            # https://supabase.com/docs/guides/auth/auth-helpers/admin-api
            auth_url = f"{SUPABASE_URL}/auth/v1/admin/users"
            headers = {
                "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
                "apikey": SUPABASE_SERVICE_ROLE_KEY,
                "Content-Type": "application/json"
            }
            payload = {
                "email": email,
                "password": password,
                "email_confirm": True,
                "user_metadata": {"full_name": f"{salon_name} Owner"}
            }
            
            try:
                response = httpx.post(auth_url, json=payload, headers=headers)
                if response.status_code == 201:
                    user_data = response.json()
                    user_id = user_data['id']
                    
                    # 4. Insert into users table
                    conn.execute(text("""
                        INSERT INTO users (id, email, full_name, role, salon_id, is_active)
                        VALUES (:id, :email, :full_name, 'salon_owner', :salon_id, TRUE)
                    """), {
                        "id": user_id,
                        "email": email,
                        "full_name": f"{salon_name} Owner",
                        "salon_id": salon_id
                    })
                    conn.commit()
                    print(f"   Successfully created owner for {salon_name}. User ID: {user_id}")
                elif response.status_code == 400 and "already been registered" in response.text:
                    # User might exist in Auth but not in our users table (orphaned)
                    # We could try to link it, but for now just skip.
                    print(f"   Warning: Auth user {email} already exists but is not linked to this salon.")
                else:
                    print(f"   Failed to create Auth user: {response.status_code} - {response.text}")
            except Exception as e:
                print(f"   Error: {str(e)}")

if __name__ == "__main__":
    create_owners()
