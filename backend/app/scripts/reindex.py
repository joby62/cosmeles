import json
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Optional
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.init_db import init_db
from app.db.models import ProductIndex
from app.db.session import SessionLocal
from app.settings import settings


def _now_iso() -> str:
    return datetime.utcnow().isoformat(timespec="seconds")


def _pick(d: Dict[str, Any], keys: list[str], default: Any = None) -> Any:
    for k in keys:
        if k in d and d[k] not in (None, ""):
            return d[k]
    return default


def _normalize_rel(path: str) -> str:
    return path.replace("\\", "/").lstrip("/")

def _as_storage_rel(path: str | Path) -> str:
    p = Path(path)
    base = Path(settings.storage_dir).resolve()
    if p.is_absolute():
        try:
            return p.resolve().relative_to(base).as_posix()
        except ValueError:
            return p.name
    return _normalize_rel(str(p))


def _guess_image_path(json_file: Path) -> Optional[str]:
    # Try same stem under storage/images
    images_dir = Path(settings.storage_dir) / "images"
    for ext in [".jpg", ".jpeg", ".png", ".webp"]:
        cand = images_dir / (json_file.stem + ext)
        if cand.exists():
            return f"images/{cand.name}"
    return None


def upsert_one(db: Session, json_file: Path) -> None:
    data: Dict[str, Any] = json.loads(json_file.read_text(encoding="utf-8"))

    # basic fields with flexible key mapping
    product = data.get("product") if isinstance(data.get("product"), dict) else {}
    summary = data.get("summary") if isinstance(data.get("summary"), dict) else {}

    category = _pick(product or data, ["category", "cat", "type"], default="shampoo")
    brand = _pick(product or data, ["brand", "maker"], default="")
    name = _pick(product or data, ["name", "title"], default=json_file.stem)
    one_sentence = _pick(summary or data, ["one_sentence", "slogan", "subtitle", "desc_short"], default="")

    tags = _pick(data, ["tags", "tags_json"], default=[])
    if isinstance(tags, str):
        # allow "a,b,c"
        tags = [t.strip() for t in tags.split(",") if t.strip()]
    tags_json = json.dumps(tags, ensure_ascii=False)

    # image_path: from json fields or guess
    evidence = data.get("evidence") if isinstance(data.get("evidence"), dict) else {}
    image_path = _pick(evidence or data, ["image_path", "image", "cover", "img"], default=None)
    if image_path:
        image_path = _as_storage_rel(str(image_path))
        if image_path.startswith("storage/"):
            image_path = image_path[len("storage/") :]
    else:
        g = _guess_image_path(json_file)
        image_path = g or ""

    json_path = _as_storage_rel(json_file)
    if json_path.startswith("storage/"):
        json_path = json_path[len("storage/") :]

    product_id = _pick(data, ["id", "product_id"], default=json_file.stem) or str(uuid4())

    # upsert by id first, then json_path as fallback
    existing = db.get(ProductIndex, product_id)
    if not existing:
        existing = db.execute(select(ProductIndex).where(ProductIndex.json_path == json_path)).scalars().first()
    if existing:
        existing.id = existing.id or product_id
        existing.category = category
        existing.brand = brand
        existing.name = name
        existing.one_sentence = one_sentence
        existing.tags_json = tags_json
        existing.image_path = image_path
        existing.created_at = existing.created_at or _now_iso()
    else:
        row = ProductIndex(
            id=product_id,
            category=category,
            brand=brand,
            name=name,
            one_sentence=one_sentence,
            tags_json=tags_json,
            image_path=image_path,
            json_path=json_path,
            created_at=_now_iso(),
        )
        db.add(row)


def main() -> None:
    init_db()

    products_dir = Path(settings.storage_dir) / "products"
    if not products_dir.exists():
        print(f"[reindex] no products dir: {products_dir}")
        return

    files = sorted(products_dir.glob("*.json"))
    print(f"[reindex] found {len(files)} json files under {products_dir}")

    with SessionLocal() as db:
        for f in files:
            try:
                upsert_one(db, f)
            except Exception as e:
                print(f"[reindex] skip {f.name}: {e}")
        db.commit()

    print("[reindex] done")


if __name__ == "__main__":
    main()
