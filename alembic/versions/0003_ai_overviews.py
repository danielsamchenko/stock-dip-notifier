"""Add AI overviews cache table.

Revision ID: 0003_ai_overviews
Revises: 0002_signals_alerts
Create Date: 2026-01-23
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "0003_ai_overviews"
down_revision = "0002_signals_alerts"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "ai_overviews",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("symbol", sa.String(length=16), nullable=False),
        sa.Column("asof", sa.Date(), nullable=False),
        sa.Column("overview_json", sa.JSON(), nullable=False),
        sa.Column("model_id", sa.String(length=128), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.UniqueConstraint("symbol", "asof", name="uq_ai_overviews_symbol_asof"),
    )
    op.create_index("ix_ai_overviews_symbol", "ai_overviews", ["symbol"])
    op.create_index("ix_ai_overviews_asof", "ai_overviews", ["asof"])
    op.create_index("ix_ai_overviews_created_at", "ai_overviews", ["created_at"])


def downgrade() -> None:
    op.drop_index("ix_ai_overviews_created_at", table_name="ai_overviews")
    op.drop_index("ix_ai_overviews_asof", table_name="ai_overviews")
    op.drop_index("ix_ai_overviews_symbol", table_name="ai_overviews")
    op.drop_table("ai_overviews")
