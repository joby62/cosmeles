import base64
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

    for module in modules:
        monkeypatch.setattr(module, "save_image", _fake_save_image)
