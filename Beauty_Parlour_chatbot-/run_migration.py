import asyncio
import asyncpg
from dotenv import dotenv_values
import os

async def run_sql_file(conn, filepath):
    print(f"Executing {filepath}...")
    with open(filepath, 'r', encoding='utf-8') as f:
        sql = f.read()
    await conn.execute(sql)
    print(f"Finished {filepath}.")

async def main():
    config = dotenv_values(".env")
    db_url = config.get("DATABASE_URL")
    if not db_url:
        print("DATABASE_URL not found in .env")
        return
    
    # asyncpg doesn't support the +asyncpg prefix
    db_url = db_url.replace("postgresql+asyncpg://", "postgresql://")
    
    print(f"Connecting to {db_url}...")
    try:
        conn = await asyncpg.connect(db_url)
        await run_sql_file(conn, "sql/migration_v2.sql")
        await run_sql_file(conn, "sql/seed_demo.sql")
        await conn.close()
        print("Successfully ran migrations and seed data.")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(main())
