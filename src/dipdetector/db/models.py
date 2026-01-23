"""SQLAlchemy models."""

from __future__ import annotations

from datetime import date, datetime

from sqlalchemy import (
    BigInteger,
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Index,
    JSON,
    Numeric,
    String,
    UniqueConstraint,
    desc,
    func,
    text,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class Ticker(Base):
    __tablename__ = "tickers"

    id: Mapped[int] = mapped_column(primary_key=True)
    symbol: Mapped[str] = mapped_column(String(16), unique=True, nullable=False)
    name: Mapped[str | None] = mapped_column(String(128))
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("true"))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    prices: Mapped[list["DailyPrice"]] = relationship(back_populates="ticker")
    signals: Mapped[list["Signal"]] = relationship(back_populates="ticker")
    alerts: Mapped[list["Alert"]] = relationship(back_populates="ticker")


class DailyPrice(Base):
    __tablename__ = "daily_prices"
    __table_args__ = (
        UniqueConstraint("ticker_id", "date", "source", name="uq_daily_prices_ticker_date_source"),
        Index("ix_daily_prices_ticker_date_desc", "ticker_id", desc("date")),
        Index("ix_daily_prices_date", "date"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    ticker_id: Mapped[int] = mapped_column(ForeignKey("tickers.id"), nullable=False)
    date: Mapped[datetime.date] = mapped_column(Date, nullable=False)
    # Numeric keeps price precision consistent across providers.
    open: Mapped[float] = mapped_column(Numeric(12, 4), nullable=False)
    high: Mapped[float] = mapped_column(Numeric(12, 4), nullable=False)
    low: Mapped[float] = mapped_column(Numeric(12, 4), nullable=False)
    close: Mapped[float] = mapped_column(Numeric(12, 4), nullable=False)
    volume: Mapped[int | None] = mapped_column(BigInteger)
    source: Mapped[str] = mapped_column(String(32), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    ticker: Mapped[Ticker] = relationship(back_populates="prices")


class Signal(Base):
    __tablename__ = "signals"
    __table_args__ = (
        UniqueConstraint("ticker_id", "date", "rule", name="uq_signals_ticker_date_rule"),
        Index("ix_signals_date", "date"),
        Index("ix_signals_ticker_date", "ticker_id", "date"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    ticker_id: Mapped[int] = mapped_column(ForeignKey("tickers.id"), nullable=False)
    date: Mapped[datetime.date] = mapped_column(Date, nullable=False)
    rule: Mapped[str] = mapped_column(String(32), nullable=False)
    value: Mapped[float] = mapped_column(Numeric(12, 4), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    ticker: Mapped[Ticker] = relationship(back_populates="signals")


class Alert(Base):
    __tablename__ = "alerts"
    __table_args__ = (
        UniqueConstraint("ticker_id", "date", "rule", name="uq_alerts_ticker_date_rule"),
        Index("ix_alerts_date", "date"),
        Index("ix_alerts_ticker_date", "ticker_id", "date"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    ticker_id: Mapped[int] = mapped_column(ForeignKey("tickers.id"), nullable=False)
    date: Mapped[datetime.date] = mapped_column(Date, nullable=False)
    rule: Mapped[str] = mapped_column(String(32), nullable=False)
    magnitude: Mapped[float] = mapped_column(Numeric(12, 4), nullable=False)
    threshold: Mapped[float] = mapped_column(Numeric(12, 4), nullable=False)
    details_json: Mapped[dict | None] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    ticker: Mapped[Ticker] = relationship(back_populates="alerts")


class AIOverview(Base):
    __tablename__ = "ai_overviews"
    __table_args__ = (
        UniqueConstraint("symbol", "asof", name="uq_ai_overviews_symbol_asof"),
        Index("ix_ai_overviews_symbol", "symbol"),
        Index("ix_ai_overviews_asof", "asof"),
        Index("ix_ai_overviews_created_at", "created_at"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    symbol: Mapped[str] = mapped_column(String(16), nullable=False)
    asof: Mapped[date] = mapped_column(Date, nullable=False)
    overview_json: Mapped[dict] = mapped_column(JSON, nullable=False)
    model_id: Mapped[str | None] = mapped_column(String(128))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
