import os, json
from uuid import uuid4
from datetime import datetime
from app.settings import settings

def now_iso():
    return datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")

def ensure_dirs():
    os.makedirs(settings.storage_dir, exist_ok=True)
    os.makedirs(os.path.join(settings.storage_dir, "images"), exist_ok=True)
    os.makedirs(os.path.join(settings.storage_dir, "products"), exist_ok=True)

def new_id() -> str:
    return str(uuid4())

def save_image(product_id: str, filename: str, content: bytes) -> str:
    ensure_dirs()
    ext = os.path.splitext(filename)[1].lower() or ".jpg"
    rel = f"images/{product_id}{ext}"
    abs_path = os.path.join(settings.storage_dir, rel)
    with open(abs_path, "wb") as f:
        f.write(content)
    return rel

def save_product_json(product_id: str, doc: dict) -> str:
    ensure_dirs()
    rel = f"products/{product_id}.json"
    abs_path = os.path.join(settings.storage_dir, rel)
    with open(abs_path, "w", encoding="utf-8") as f:
        json.dump(doc, f, ensure_ascii=False, indent=2)
    return rel

def load_json(rel_path: str) -> dict:
    abs_path = os.path.join(settings.storage_dir, rel_path)
    with open(abs_path, "r", encoding="utf-8") as f:
        return json.load(f)
