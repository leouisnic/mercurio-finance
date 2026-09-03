"""Engine e sessão assíncronos do Postgres."""

from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from finance_api.config import DATABASE_URL

engine = create_async_engine(DATABASE_URL)
async_session = async_sessionmaker(engine, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def obter_sessao() -> AsyncGenerator[AsyncSession]:
    async with async_session() as sessao:
        yield sessao
