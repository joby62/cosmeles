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

def remove_product_images(product_id: str, image_path: str | None = None) -> tuple[int, list[str]]:
    """
    删除产品主图 + 同 trace_id 的图片变体（例如 .jpg/.png/.webp）。
    返回 (删除数量, 删除的相对路径列表)。
    """
    ensure_dirs()
    removed_paths: list[str] = []

    if image_path and remove_rel_path(image_path):
        removed_paths.append(image_path.lstrip("/"))

    images_root = _resolve_rel_path("images")
    base = Path(settings.storage_dir).resolve()
    prefix = f"{product_id}."

    for path in images_root.iterdir():
        if not path.is_file():
            continue
        name = path.name
        if not name.startswith(prefix):
            continue
        try:
            path.unlink()
            rel = path.resolve().relative_to(base).as_posix()
            if rel not in removed_paths:
                removed_paths.append(rel)
        except FileNotFoundError:
            continue

    return (len(removed_paths), removed_paths)

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


def cleanup_orphan_images(
    *,
    keep_product_ids: set[str],
    keep_image_paths: set[str],
    min_age_minutes: int = 120,
    dry_run: bool = True,
    max_delete: int = 500,
) -> dict:
    """
    清理 images 目录中不被产品索引引用的孤儿图片。
    为防止误删上传中的图片，默认只清理超过 min_age_minutes 的文件。
    """
    ensure_dirs()
    base = Path(settings.storage_dir).resolve()
    images_root = _resolve_rel_path("images")
    min_age_minutes = max(0, int(min_age_minutes))
    max_delete = max(1, min(5000, int(max_delete)))
    cutoff = datetime.now(timezone.utc) - timedelta(minutes=min_age_minutes)

    normalized_keep_paths: set[str] = set()
    for item in keep_image_paths:
        value = str(item or "").strip().lstrip("/")
        if value:
            normalized_keep_paths.add(value)

    scanned = 0
    kept = 0
    orphan_paths: list[str] = []
    deleted_paths: list[str] = []

    for path in sorted(images_root.rglob("*")):
        if not path.is_file():
            continue
        scanned += 1
        rel = path.resolve().relative_to(base).as_posix()
        stem = path.stem
        mtime = datetime.fromtimestamp(path.stat().st_mtime, tz=timezone.utc)

        is_referenced_path = rel in normalized_keep_paths
        is_referenced_product = stem in keep_product_ids
        is_too_new = mtime >= cutoff
        if is_referenced_path or is_referenced_product or is_too_new:
            kept += 1
            continue

        orphan_paths.append(rel)
        if dry_run:
            continue
        if len(deleted_paths) >= max_delete:
            continue
        try:
            path.unlink()
            deleted_paths.append(rel)
        except FileNotFoundError:
            continue

    return {
        "status": "ok",
        "dry_run": bool(dry_run),
        "min_age_minutes": min_age_minutes,
        "max_delete": max_delete,
        "scanned_images": scanned,
        "kept_images": kept,
        "orphan_images": len(orphan_paths),
        "deleted_images": len(deleted_paths),
        "orphan_paths": orphan_paths[:200],
        "deleted_paths": deleted_paths[:200],
    }


def cleanup_orphan_storage(
    *,
    keep_product_ids: set[str],
    keep_image_paths: set[str],
    min_age_minutes: int = 120,
    dry_run: bool = True,
    max_delete: int = 500,
) -> dict:
    """
    一次性清理：
    1) images 下无产品引用的孤儿图片
    2) doubao_runs 下无产品对应 trace_id 的孤儿目录
    """
    image_result = cleanup_orphan_images(
        keep_product_ids=keep_product_ids,
        keep_image_paths=keep_image_paths,
        min_age_minutes=min_age_minutes,
        dry_run=dry_run,
        max_delete=max_delete,
    )

    ensure_dirs()
    base = Path(settings.storage_dir).resolve()
    runs_root = _resolve_rel_path("doubao_runs")
    min_age_minutes = max(0, int(min_age_minutes))
    max_delete = max(1, min(5000, int(max_delete)))
    cutoff = datetime.now(timezone.utc) - timedelta(minutes=min_age_minutes)

    scanned_runs = 0
    kept_runs = 0
    orphan_run_dirs: list[str] = []
    deleted_run_dirs: list[str] = []
    deleted_run_files = 0

    for path in sorted(runs_root.iterdir()):
        if not path.is_dir():
            continue
        scanned_runs += 1
        trace_id = path.name
        try:
            mtime = datetime.fromtimestamp(path.stat().st_mtime, tz=timezone.utc)
        except FileNotFoundError:
            continue

        is_referenced_product = trace_id in keep_product_ids
        is_too_new = mtime >= cutoff
        if is_referenced_product or is_too_new:
            kept_runs += 1
            continue

        rel = path.resolve().relative_to(base).as_posix()
        orphan_run_dirs.append(rel)
        if dry_run:
            continue
        if len(deleted_run_dirs) >= max_delete:
            continue
        file_count = 0
        for child in path.rglob("*"):
            if child.is_file():
                file_count += 1
        shutil.rmtree(path, ignore_errors=True)
        deleted_run_dirs.append(rel)
        deleted_run_files += file_count

    return {
        "status": "ok",
        "dry_run": bool(dry_run),
        "min_age_minutes": min_age_minutes,
        "max_delete": max_delete,
        "images": image_result,
        "runs": {
            "scanned_runs": scanned_runs,
            "kept_runs": kept_runs,
            "orphan_runs": len(orphan_run_dirs),
            "deleted_runs": len(deleted_run_dirs),
            "deleted_run_files": deleted_run_files,
            "orphan_run_dirs": orphan_run_dirs[:200],
            "deleted_run_dirs": deleted_run_dirs[:200],
        },
    }
