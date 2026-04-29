import asyncio
import asyncpg
from dotenv import dotenv_values
from urllib.parse import urlparse, urlunparse


def normalize_url_for_asyncpg(db_url: str) -> str:
    db_url = db_url.strip()
    if db_url.startswith("postgresql+asyncpg://"):
        return "postgresql://" + db_url.split("://", 1)[1]
    if db_url.startswith("postgres://"):
        return "postgresql://" + db_url.split("://", 1)[1]
    return db_url


def mask_database_url(db_url: str) -> str:
    parsed = urlparse(db_url)
    if not parsed.password:
        return db_url

    username = parsed.username or ""
    host = parsed.hostname or ""
    port = f":{parsed.port}" if parsed.port else ""
    netloc = f"{username}:***@{host}{port}"
    return urlunparse(parsed._replace(netloc=netloc))

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
    
    db_url = normalize_url_for_asyncpg(db_url)
    
    print(f"Connecting to {mask_database_url(db_url)}...")
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
