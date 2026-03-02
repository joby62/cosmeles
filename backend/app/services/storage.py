import os, json
import shutil
from uuid import uuid4
from datetime import datetime, timedelta, timezone
from pathlib import Path
from app.settings import settings
from app.constants import ALLOWED_IMAGE_EXTS

def now_iso():
    return datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")

def ensure_dirs():
    os.makedirs(settings.storage_dir, exist_ok=True)
    os.makedirs(os.path.join(settings.storage_dir, "images"), exist_ok=True)
    os.makedirs(os.path.join(settings.storage_dir, "products"), exist_ok=True)
    os.makedirs(os.path.join(settings.storage_dir, "doubao_runs"), exist_ok=True)

def new_id() -> str:
    return str(uuid4())

def _resolve_rel_path(rel_path: str) -> Path:
    base = Path(settings.storage_dir).resolve()
    target = (base / rel_path).resolve()
    if not str(target).startswith(str(base)):
        raise ValueError("Invalid storage path.")
    return target

def save_image(product_id: str, filename: str, content: bytes) -> str:
    ensure_dirs()
    ext = os.path.splitext(filename)[1].lower() or ".jpg"
    if ext not in ALLOWED_IMAGE_EXTS:
        ext = ".jpg"
    rel = f"images/{product_id}{ext}"
    abs_path = _resolve_rel_path(rel)
    with open(abs_path, "wb") as f:
        f.write(content)
    return rel

def save_product_json(product_id: str, doc: dict) -> str:
    ensure_dirs()
    rel = f"products/{product_id}.json"
    abs_path = _resolve_rel_path(rel)
    with open(abs_path, "w", encoding="utf-8") as f:
        json.dump(doc, f, ensure_ascii=False, indent=2)
    return rel

def save_doubao_artifact(product_id: str, stage: str, payload: dict) -> str:
    ensure_dirs()
    safe_stage = "".join(ch for ch in stage if ch.isalnum() or ch in {"-", "_"}).strip("_") or "stage"
    rel = f"doubao_runs/{product_id}/{safe_stage}.json"
    abs_path = _resolve_rel_path(rel)
    abs_path.parent.mkdir(parents=True, exist_ok=True)
    with open(abs_path, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)
    return rel

def load_json(rel_path: str) -> dict:
    abs_path = _resolve_rel_path(rel_path)
    with open(abs_path, "r", encoding="utf-8") as f:
        return json.load(f)

def read_rel_bytes(rel_path: str) -> bytes:
    abs_path = _resolve_rel_path(rel_path)
    with open(abs_path, "rb") as f:
        return f.read()

def save_json_at(rel_path: str, doc: dict) -> None:
    abs_path = _resolve_rel_path(rel_path)
    with open(abs_path, "w", encoding="utf-8") as f:
        json.dump(doc, f, ensure_ascii=False, indent=2)

def remove_rel_path(rel_path: str | None) -> bool:
    if not rel_path:
        return False
    try:
        abs_path = _resolve_rel_path(rel_path)
    except ValueError:
        return False
    if abs_path.exists():
        abs_path.unlink()
        return True
    return False

def remove_rel_dir(rel_path: str | None) -> tuple[int, int]:
    if not rel_path:
        return (0, 0)
    try:
        abs_path = _resolve_rel_path(rel_path)
    except ValueError:
        return (0, 0)
    if not abs_path.exists() or not abs_path.is_dir():
        return (0, 0)

    removed_files = 0
    removed_dirs = 0
    for path in abs_path.rglob("*"):
        if path.is_file():
            removed_files += 1
        elif path.is_dir():
            removed_dirs += 1
    shutil.rmtree(abs_path, ignore_errors=True)
    # include root dir itself
    removed_dirs += 1
    return (removed_files, removed_dirs)

def exists_rel_path(rel_path: str | None) -> bool:
    if not rel_path:
        return False
    try:
        abs_path = _resolve_rel_path(rel_path)
    except ValueError:
        return False
    return abs_path.exists()

def cleanup_doubao_artifacts(days: int | None = None) -> dict:
    ensure_dirs()
    ttl_days = int(days if days is not None else settings.doubao_artifact_ttl_days)
    ttl_days = max(1, ttl_days)
    root = _resolve_rel_path("doubao_runs")
    if not root.exists():
        return {"removed_files": 0, "removed_dirs": 0, "ttl_days": ttl_days}

    cutoff = datetime.now(timezone.utc) - timedelta(days=ttl_days)
    removed_files = 0
    removed_dirs = 0

    # 删除过期文件
    for path in sorted(root.rglob("*"), key=lambda p: len(p.parts), reverse=True):
        try:
            if path.is_file():
                mtime = datetime.fromtimestamp(path.stat().st_mtime, tz=timezone.utc)
                if mtime < cutoff:
                    path.unlink()
                    removed_files += 1
            elif path.is_dir():
                try:
                    path.rmdir()
                    removed_dirs += 1
                except OSError:
                    pass
        except FileNotFoundError:
            continue

    return {"removed_files": removed_files, "removed_dirs": removed_dirs, "ttl_days": ttl_days}
