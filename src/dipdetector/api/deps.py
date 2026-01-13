"""API dependencies."""

from __future__ import annotations

from collections.abc import Generator

from sqlalchemy.orm import Session

from dipdetector.db.session import get_session


def get_db_session() -> Generator[Session, None, None]:
    """Yield a database session with commit/rollback safety."""
    with get_session() as session:
        yield session
