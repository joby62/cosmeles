import os, json
from uuid import uuid4
from datetime import datetime
from pathlib import Path
from app.settings import settings
from app.constants import ALLOWED_IMAGE_EXTS

def now_iso():
    return datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")

def ensure_dirs():
    os.makedirs(settings.storage_dir, exist_ok=True)
    os.makedirs(os.path.join(settings.storage_dir, "images"), exist_ok=True)
    os.makedirs(os.path.join(settings.storage_dir, "products"), exist_ok=True)

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

def load_json(rel_path: str) -> dict:
    abs_path = _resolve_rel_path(rel_path)
    with open(abs_path, "r", encoding="utf-8") as f:
        return json.load(f)

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

def exists_rel_path(rel_path: str | None) -> bool:
    if not rel_path:
        return False
    try:
        abs_path = _resolve_rel_path(rel_path)
    except ValueError:
        return False
    return abs_path.exists()
