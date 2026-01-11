"""Initial tables.

Revision ID: 0001_initial
Revises: None
Create Date: 2024-01-01 00:00:00

"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "0001_initial"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "tickers",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("symbol", sa.String(length=16), nullable=False, unique=True),
        sa.Column("name", sa.String(length=128), nullable=True),
        sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )

    op.create_table(
        "daily_prices",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("ticker_id", sa.Integer(), sa.ForeignKey("tickers.id"), nullable=False),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("open", sa.Numeric(12, 4), nullable=False),
        sa.Column("high", sa.Numeric(12, 4), nullable=False),
        sa.Column("low", sa.Numeric(12, 4), nullable=False),
        sa.Column("close", sa.Numeric(12, 4), nullable=False),
        sa.Column("volume", sa.BigInteger(), nullable=True),
        sa.Column("source", sa.String(length=32), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.UniqueConstraint(
            "ticker_id",
            "date",
            "source",
            name="uq_daily_prices_ticker_date_source",
        ),
    )

    op.create_index(
        "ix_daily_prices_ticker_date_desc",
        "daily_prices",
        ["ticker_id", sa.desc("date")],
    )
    op.create_index("ix_daily_prices_date", "daily_prices", ["date"])


def downgrade() -> None:
    op.drop_index("ix_daily_prices_date", table_name="daily_prices")
    op.drop_index("ix_daily_prices_ticker_date_desc", table_name="daily_prices")
    op.drop_table("daily_prices")
    op.drop_table("tickers")
