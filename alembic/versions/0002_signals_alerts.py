"""Add signals and alerts tables.

Revision ID: 0002_signals_alerts
Revises: 0001_initial
Create Date: 2024-01-02 00:00:00

"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "0002_signals_alerts"
down_revision = "0001_initial"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "signals",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("ticker_id", sa.Integer(), sa.ForeignKey("tickers.id"), nullable=False),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("rule", sa.String(length=32), nullable=False),
        sa.Column("value", sa.Numeric(12, 4), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.UniqueConstraint(
            "ticker_id",
            "date",
            "rule",
            name="uq_signals_ticker_date_rule",
        ),
    )
    op.create_index("ix_signals_date", "signals", ["date"])
    op.create_index("ix_signals_ticker_date", "signals", ["ticker_id", "date"])

    op.create_table(
        "alerts",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("ticker_id", sa.Integer(), sa.ForeignKey("tickers.id"), nullable=False),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("rule", sa.String(length=32), nullable=False),
        sa.Column("magnitude", sa.Numeric(12, 4), nullable=False),
        sa.Column("threshold", sa.Numeric(12, 4), nullable=False),
        sa.Column("details_json", sa.JSON(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.UniqueConstraint(
            "ticker_id",
            "date",
            "rule",
            name="uq_alerts_ticker_date_rule",
        ),
    )
    op.create_index("ix_alerts_date", "alerts", ["date"])
    op.create_index("ix_alerts_ticker_date", "alerts", ["ticker_id", "date"])


def downgrade() -> None:
    op.drop_index("ix_alerts_ticker_date", table_name="alerts")
    op.drop_index("ix_alerts_date", table_name="alerts")
    op.drop_table("alerts")
    op.drop_index("ix_signals_ticker_date", table_name="signals")
    op.drop_index("ix_signals_date", table_name="signals")
    op.drop_table("signals")
