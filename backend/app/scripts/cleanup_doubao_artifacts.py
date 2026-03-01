import argparse
import json

from app.services.storage import cleanup_doubao_artifacts


def main():
    parser = argparse.ArgumentParser(description="Cleanup stale doubao pipeline artifact files.")
    parser.add_argument("--days", type=int, default=14, help="Remove files older than N days.")
    args = parser.parse_args()

    result = cleanup_doubao_artifacts(days=args.days)
    print(json.dumps({"status": "ok", **result}, ensure_ascii=False))


if __name__ == "__main__":
    main()
