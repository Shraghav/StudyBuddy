import os
from collections.abc import AsyncGenerator

from dotenv import load_dotenv
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import declarative_base

load_dotenv()
load_dotenv("backend/.env")

# Step 1: Initialize database engine with disabled prepared statement cache for PgBouncer/Supabase
DATABASE_URL =  os.getenv("DATABASE_URL") or ""

engine = create_async_engine(DATABASE_URL,connect_args={
        "prepared_statement_cache_size": 0,
        "statement_cache_size": 0
    }, pool_pre_ping=True)

# Step 2: Configure session factory with non-expiring commits
async_session_maker = async_sessionmaker(engine, expire_on_commit=False )
Base = declarative_base()

async def create_db():
    # Step 1: Open an asynchronous transaction on the database engine
    async with engine.begin() as conn:
        # Step 2: Enable pgvector extension if not already present
        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector;"))
        # Step 3: Create all declared database tables from metadata
        await conn.run_sync(Base.metadata.create_all)

async def get_async_session() -> AsyncGenerator[AsyncSession, None]:
    # Step 1: Instantiate an asynchronous session from the connection pool
    async with async_session_maker() as session:
        # Step 2: Yield the active session to the FastAPI dependency caller
        yield session