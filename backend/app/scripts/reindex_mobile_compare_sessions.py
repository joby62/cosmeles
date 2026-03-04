import argparse
import json

from app.db.init_db import init_db
from app.db.session import SessionLocal
from app.routes.mobile import (
    _backfill_mobile_compare_session_index_from_storage,
    _ensure_mobile_compare_index_tables,
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Backfill mobile compare session index from storage doubao_runs.")
    parser.add_argument("--limit", type=int, default=5000, help="Maximum run directories to scan.")
    parser.add_argument(
        "--only-missing",
        action="store_true",
        default=True,
        help="Only backfill compare_ids missing from index table (default: true).",
    )
    parser.add_argument(
        "--all",
        dest="only_missing",
        action="store_false",
        help="Reindex all compare_ids with compare artifacts, including existing rows.",
    )
    parser.add_argument("--dry-run", action="store_true", help="Scan and report without writing DB.")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    init_db()
    with SessionLocal() as db:
        _ensure_mobile_compare_index_tables(db)
        result = _backfill_mobile_compare_session_index_from_storage(
            db=db,
            limit=max(1, int(args.limit)),
            only_missing=bool(args.only_missing),
            dry_run=bool(args.dry_run),
        )
    print(json.dumps({"status": "ok", **result}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
