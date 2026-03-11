import os
from collections.abc import AsyncGenerator
from dotenv import load_dotenv
from sqlalchemy.ext.asyncio import (AsyncSession, async_sessionmaker,create_async_engine)
from sqlalchemy import text
from sqlalchemy.orm import declarative_base

load_dotenv()

DATABASE_URL =  os.getenv("DATABASE_URL")

engine = create_async_engine(DATABASE_URL,connect_args={
        "prepared_statement_cache_size": 0,
        "statement_cache_size": 0
    }, pool_pre_ping=True)

async_session_maker = async_sessionmaker(engine, expire_on_commit=False )
Base = declarative_base()

async def create_db():
    async with engine.begin() as conn:
        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector;"))
        await conn.run_sync(Base.metadata.create_all)

async def get_async_session() -> AsyncGenerator[AsyncSession, None]:
    async with async_session_maker() as session:
        yield session