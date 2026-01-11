"""Session and engine helpers."""

from __future__ import annotations

from contextlib import contextmanager
from typing import Generator

from sqlalchemy import Engine, create_engine
from sqlalchemy.orm import Session, sessionmaker

from dipdetector import config

_ENGINE: Engine | None = None
_SessionLocal: sessionmaker[Session] | None = None


def configure_engine(database_url: str) -> None:
    """Override the global engine/sessionmaker (useful for tests)."""
    global _ENGINE, _SessionLocal
    _ENGINE = create_engine(database_url, future=True)
    _SessionLocal = sessionmaker(bind=_ENGINE, expire_on_commit=False)


def get_engine() -> Engine:
    global _ENGINE, _SessionLocal
    if _ENGINE is None:
        database_url = config.get_database_url()
        _ENGINE = create_engine(database_url, future=True)
        _SessionLocal = sessionmaker(bind=_ENGINE, expire_on_commit=False)
    return _ENGINE


def get_sessionmaker() -> sessionmaker[Session]:
    if _SessionLocal is None:
        get_engine()
    assert _SessionLocal is not None
    return _SessionLocal


@contextmanager
def get_session() -> Generator[Session, None, None]:
    SessionLocal = get_sessionmaker()
    session = SessionLocal()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()
