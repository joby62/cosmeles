import base64
import hashlib
from pathlib import Path
from typing import Any

from app.settings import settings

# 1x1 PNG for upload route tests; avoids invalid-bytes failures.
VALID_TEST_IMAGE_BYTES = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+b5WQAAAAASUVORK5CYII="
)


def install_fake_save_image(monkeypatch: Any, *modules: Any) -> None:
    """
    Patch route modules' save_image so tests don't depend on Pillow.
    It writes webp/jpg variants and returns webp as primary path.
    """

    def _fake_save_image(
        product_id: str,
        filename: str,
        content: bytes,
        content_type: str | None = None,
        subdir: str | None = None,
    ) -> str:
        _ = filename
        _ = content_type
        safe_id = str(product_id or "").strip() or "test-image"
        clean_subdir = "/".join(part.strip() for part in str(subdir or "").split("/") if part.strip())
        rel_suffix = f"/{clean_subdir}" if clean_subdir else ""
        webp_rel = f"images/webp{rel_suffix}/{safe_id}.webp"
        jpg_rel = f"images/jpg{rel_suffix}/{safe_id}.jpg"

        base = Path(settings.storage_dir)
        webp_abs = base / webp_rel
        jpg_abs = base / jpg_rel
        webp_abs.parent.mkdir(parents=True, exist_ok=True)
        jpg_abs.parent.mkdir(parents=True, exist_ok=True)
        payload = content if content else b"test-image"
        webp_abs.write_bytes(payload)
        jpg_abs.write_bytes(payload)
        return webp_rel

    def _fake_save_user_upload_bundle(
        *,
        upload_id: str,
        owner_type: str,
        owner_id: str,
        category: str,
        filename: str,
        content: bytes,
        content_type: str | None = None,
    ) -> dict[str, str]:
        _ = content_type
        payload = content if content else b"test-image"
        owner_type_clean = str(owner_type or "").strip().lower() or "device"
        owner_hash = hashlib.sha1(f"{owner_type_clean}::{str(owner_id or '').strip()}".encode("utf-8")).hexdigest()[:16]
        upload_value = str(upload_id or "").strip() or "test-upload"
        category_value = str(category or "").strip().lower() or "unknown"
        ext = Path(filename or "upload.png").suffix or ".png"

        asset_dir_rel = f"user-uploads/{owner_type_clean}/{owner_hash}/{upload_value}"
        original_rel = f"{asset_dir_rel}/original{ext}"
        meta_rel = f"{asset_dir_rel}/meta.json"
        webp_rel = f"user-images/webp/uploads/{owner_type_clean}/{owner_hash}/{category_value}/{upload_value}.webp"
        jpg_rel = f"user-images/jpg/uploads/{owner_type_clean}/{owner_hash}/{category_value}/{upload_value}.jpg"

        base = Path(settings.user_storage_dir)
        original_abs = base / "uploads" / owner_type_clean / owner_hash / upload_value / f"original{ext}"
        meta_abs = base / "uploads" / owner_type_clean / owner_hash / upload_value / "meta.json"
        webp_abs = base / "images" / "webp" / "uploads" / owner_type_clean / owner_hash / category_value / f"{upload_value}.webp"
        jpg_abs = base / "images" / "jpg" / "uploads" / owner_type_clean / owner_hash / category_value / f"{upload_value}.jpg"

        original_abs.parent.mkdir(parents=True, exist_ok=True)
        meta_abs.parent.mkdir(parents=True, exist_ok=True)
        webp_abs.parent.mkdir(parents=True, exist_ok=True)
        jpg_abs.parent.mkdir(parents=True, exist_ok=True)
        original_abs.write_bytes(payload)
        webp_abs.write_bytes(payload)
        jpg_abs.write_bytes(payload)
        return {
            "asset_dir": asset_dir_rel,
            "original_path": original_rel,
            "preview_image_path": webp_rel,
            "preview_image_jpg_path": jpg_rel,
            "meta_path": meta_rel,
        }

    for module in modules:
        if hasattr(module, "save_image"):
            monkeypatch.setattr(module, "save_image", _fake_save_image)
        if hasattr(module, "save_user_upload_bundle"):
            monkeypatch.setattr(module, "save_user_upload_bundle", _fake_save_user_upload_bundle)
