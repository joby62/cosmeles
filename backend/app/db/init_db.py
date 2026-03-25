# backend/app/db/init_db.py
import os

from sqlalchemy import inspect, text

from app.db.models import (
    POSTGRESQL_PHASE_24,
    POSTGRESQL_PHASE_25,
    MOBILE_USER_STATE_STRUCTURED_TABLES,
    Base,
)
from app.db.session import engine
from app.settings import settings


SCHEMA_PATCHERS: tuple[str, ...] = (
    "mobile_selection_sessions",
    "mobile_selection_result_index",
    "mobile_compare_session_index",
)


def _ensure_mobile_selection_schema() -> None:
    inspector = inspect(engine)
    if "mobile_selection_sessions" not in inspector.get_table_names():
        return

    columns = {item["name"] for item in inspector.get_columns("mobile_selection_sessions")}
    statements: list[str] = []
    if "owner_type" not in columns:
        statements.append(
            "ALTER TABLE mobile_selection_sessions "
            "ADD COLUMN owner_type VARCHAR(32) NOT NULL DEFAULT 'device'"
        )
    if "owner_id" not in columns:
        # Legacy rows are isolated by marking owner_id as 'legacy' instead of exposing to all devices.
        statements.append(
            "ALTER TABLE mobile_selection_sessions "
            "ADD COLUMN owner_id VARCHAR(128) NOT NULL DEFAULT 'legacy'"
        )
    if "deleted_at" not in columns:
        statements.append("ALTER TABLE mobile_selection_sessions ADD COLUMN deleted_at VARCHAR(32)")
    if "deleted_by" not in columns:
        statements.append("ALTER TABLE mobile_selection_sessions ADD COLUMN deleted_by TEXT")
    if "is_pinned" not in columns:
        statements.append(
            "ALTER TABLE mobile_selection_sessions "
            "ADD COLUMN is_pinned BOOLEAN NOT NULL DEFAULT 0"
        )
    if "pinned_at" not in columns:
        statements.append("ALTER TABLE mobile_selection_sessions ADD COLUMN pinned_at VARCHAR(32)")

    indexes = [
        "CREATE INDEX IF NOT EXISTS ix_mobile_selection_sessions_owner_type "
        "ON mobile_selection_sessions (owner_type)",
        "CREATE INDEX IF NOT EXISTS ix_mobile_selection_sessions_owner_id "
        "ON mobile_selection_sessions (owner_id)",
        "CREATE INDEX IF NOT EXISTS ix_mobile_selection_sessions_deleted_at "
        "ON mobile_selection_sessions (deleted_at)",
        "CREATE INDEX IF NOT EXISTS ix_mobile_selection_sessions_is_pinned "
        "ON mobile_selection_sessions (is_pinned)",
        "CREATE INDEX IF NOT EXISTS ix_mobile_selection_sessions_pinned_at "
        "ON mobile_selection_sessions (pinned_at)",
        "CREATE INDEX IF NOT EXISTS ix_mobile_selection_sessions_owner_scope "
        "ON mobile_selection_sessions (owner_type, owner_id, created_at)",
        "CREATE INDEX IF NOT EXISTS ix_mobile_selection_sessions_owner_pinned_scope "
        "ON mobile_selection_sessions (owner_type, owner_id, is_pinned, pinned_at, created_at)",
    ]

    with engine.begin() as conn:
        for stmt in statements:
            conn.execute(text(stmt))
        for stmt in indexes:
            conn.execute(text(stmt))


def _ensure_mobile_selection_result_schema() -> None:
    inspector = inspect(engine)
    if "mobile_selection_result_index" not in inspector.get_table_names():
        return

    columns = {item["name"] for item in inspector.get_columns("mobile_selection_result_index")}
    statements: list[str] = []
    if "fingerprint" not in columns:
        statements.append("ALTER TABLE mobile_selection_result_index ADD COLUMN fingerprint VARCHAR(64)")
    if "published_payload_json" not in columns:
        statements.append("ALTER TABLE mobile_selection_result_index ADD COLUMN published_payload_json TEXT")
    if "fixed_contract_json" not in columns:
        statements.append("ALTER TABLE mobile_selection_result_index ADD COLUMN fixed_contract_json TEXT")
    if "artifact_manifest_json" not in columns:
        statements.append("ALTER TABLE mobile_selection_result_index ADD COLUMN artifact_manifest_json TEXT")
    if "payload_backend" not in columns:
        statements.append(
            "ALTER TABLE mobile_selection_result_index "
            "ADD COLUMN payload_backend VARCHAR(32) NOT NULL DEFAULT 'postgres_payload'"
        )

    indexes = [
        "CREATE INDEX IF NOT EXISTS ix_mobile_selection_result_index_fingerprint "
        "ON mobile_selection_result_index (fingerprint)",
        "CREATE INDEX IF NOT EXISTS ix_mobile_selection_result_index_payload_backend "
        "ON mobile_selection_result_index (payload_backend)",
    ]

    with engine.begin() as conn:
        for stmt in statements:
            conn.execute(text(stmt))
        for stmt in indexes:
            conn.execute(text(stmt))


def _ensure_mobile_compare_session_schema() -> None:
    inspector = inspect(engine)
    if "mobile_compare_session_index" not in inspector.get_table_names():
        return

    columns = {item["name"] for item in inspector.get_columns("mobile_compare_session_index")}
    statements: list[str] = []
    if "job_version" not in columns:
        statements.append("ALTER TABLE mobile_compare_session_index ADD COLUMN job_version VARCHAR(32)")
    if "execution_backend" not in columns:
        statements.append("ALTER TABLE mobile_compare_session_index ADD COLUMN execution_backend VARCHAR(32)")
    if "job_payload_json" not in columns:
        statements.append("ALTER TABLE mobile_compare_session_index ADD COLUMN job_payload_json TEXT")

    indexes = [
        "CREATE INDEX IF NOT EXISTS ix_mobile_compare_session_execution_scope "
        "ON mobile_compare_session_index (status, stage, updated_at)",
    ]

    with engine.begin() as conn:
        for stmt in statements:
            conn.execute(text(stmt))
        for stmt in indexes:
            conn.execute(text(stmt))


def init_db() -> None:
    """
    Ensure storage dirs exist and create DB tables on the active engine (idempotent).
    """
    os.makedirs(settings.storage_dir, exist_ok=True)
    os.makedirs(settings.user_storage_dir, exist_ok=True)
    os.makedirs(os.path.join(settings.storage_dir, "images"), exist_ok=True)
    os.makedirs(os.path.join(settings.storage_dir, "products"), exist_ok=True)
    os.makedirs(os.path.join(settings.storage_dir, "doubao_runs"), exist_ok=True)
    os.makedirs(os.path.join(settings.storage_dir, "tmp_uploads"), exist_ok=True)
    os.makedirs(os.path.join(settings.storage_dir, "ingredients"), exist_ok=True)
    os.makedirs(os.path.join(settings.storage_dir, "route_mappings"), exist_ok=True)
    os.makedirs(os.path.join(settings.storage_dir, "product_profiles"), exist_ok=True)
    os.makedirs(os.path.join(settings.storage_dir, "selection_results"), exist_ok=True)
    os.makedirs(os.path.join(settings.storage_dir, "selection_results", "published"), exist_ok=True)
    os.makedirs(os.path.join(settings.storage_dir, "selection_results", "published_versions"), exist_ok=True)
    os.makedirs(os.path.join(settings.storage_dir, "selection_results", "raw"), exist_ok=True)
    os.makedirs(os.path.join(settings.user_storage_dir, "images"), exist_ok=True)
    os.makedirs(os.path.join(settings.user_storage_dir, "uploads"), exist_ok=True)
    os.makedirs(os.path.join(settings.user_storage_dir, "products"), exist_ok=True)
    os.makedirs(os.path.join(settings.user_storage_dir, "route_mappings"), exist_ok=True)
    os.makedirs(os.path.join(settings.user_storage_dir, "product_profiles"), exist_ok=True)
    os.makedirs(os.path.join(settings.user_storage_dir, "doubao_runs"), exist_ok=True)
    os.makedirs(os.path.join(settings.user_storage_dir, "compare_results"), exist_ok=True)

    # Create tables if not exist
    Base.metadata.create_all(bind=engine)
    _ensure_mobile_selection_schema()
    _ensure_mobile_selection_result_schema()
    _ensure_mobile_compare_session_schema()


def describe_init_db_contract() -> dict:
    active_engine_driver = str(getattr(getattr(engine, "url", None), "drivername", "unknown") or "unknown")
    active_engine_driver = active_engine_driver.split("+", 1)[0] or "unknown"
    return {
        "phase": POSTGRESQL_PHASE_24,
        "bootstrap": {
            "storage_dirs_ensured": True,
            "metadata_create_all_bind": "active_engine",
            "active_engine_driver": active_engine_driver,
            "schema_patchers": list(SCHEMA_PATCHERS),
        },
        "phase_24_target": {
            "phase": POSTGRESQL_PHASE_24,
            "bootstrap_engine_driver": "postgresql",
            "metadata_create_all_contract": "unchanged",
            "schema_patchers_contract": "unchanged",
            "pg_only_online_truth_table_group": list(MOBILE_USER_STATE_STRUCTURED_TABLES),
        },
        "phase_24_scope": {
            "pg_only_online_truth_cutover": "completed",
            "phase_25_locked_phase": POSTGRESQL_PHASE_25,
        },
        "phase_25_scope": {
            "sqlite_closure_truth": "in_execution",
            "production_profile_no_sqlite_online_truth": True,
            "single_node_profile_role": "dev_or_emergency_fallback",
            "startup_and_readyz_phase_gate_required": True,
        },
    }


def main() -> None:
    init_db()
    print("DB initialized.")


if __name__ == "__main__":
    main()
