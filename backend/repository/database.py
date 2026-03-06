import os
import urllib
from collections.abc import AsyncGenerator

from dotenv import load_dotenv
load_dotenv()

from sqlalchemy.ext.asyncio import (AsyncSession, async_sessionmaker, create_async_engine)
from sqlalchemy.orm import declarative_base

password = urllib.parse.quote_plus(os.getenv("DB_PASSWORD"))
user = os.getenv("DB_USER")
db = os.getenv("DB_NAME")

DATABASE_URL = f"postgresql+asyncpg://{user}:{password}@db:5432/{db}"

engine = create_async_engine(DATABASE_URL)
async_session_maker = async_sessionmaker(engine, expire_on_commit=False )
Base = declarative_base()

async def create_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

async def get_async_session() -> AsyncGenerator[AsyncSession, None]:
    async with async_session_maker() as session:
        yield session
