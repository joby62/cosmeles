import re
from typing import Any

from app.schemas import ProductCommerceInfo, ProductCommercePackSize

ESSENTIAL_COMMERCE_FIELDS = ("price", "inventory", "shipping_eta")

PACK_SIZE_PATTERNS = [
    re.compile(r"(?P<value>\d+(?:\.\d+)?)\s*(?P<unit>ml|mL|l|L|g|kg|oz|ct)\b"),
    re.compile(r"(?P<value>\d+(?:\.\d+)?)\s*(?P<unit>fl\s*\.?\s*oz)\b", re.IGNORECASE),
]


def _as_dict(value: Any) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


def _clean_text(value: Any) -> str:
    return str(value or "").strip()


def _dedupe(items: list[str]) -> list[str]:
    out: list[str] = []
    for item in items:
        value = _clean_text(item)
        if value and value not in out:
            out.append(value)
    return out


def _first_text(*values: Any) -> str | None:
    for value in values:
        text = _clean_text(value)
        if text:
            return text
    return None


def _coerce_float(value: Any) -> float | None:
    text = _clean_text(value)
    if not text:
        return None
    try:
        return float(text)
    except Exception:
        return None


def _extract_pack_size_from_doc(raw_doc: dict[str, Any]) -> ProductCommercePackSize | None:
    commerce = _as_dict(raw_doc.get("commerce"))
    product = _as_dict(raw_doc.get("product"))
    packaging = _as_dict(raw_doc.get("packaging"))
    commerce_pack_size = _as_dict(commerce.get("pack_size"))

    explicit_label = _first_text(
        commerce_pack_size.get("label"),
        commerce.get("pack_size_label"),
        commerce.get("size_label"),
        commerce.get("size"),
        commerce.get("volume"),
        product.get("pack_size"),
        product.get("size"),
        product.get("volume"),
        packaging.get("pack_size"),
        packaging.get("size"),
        packaging.get("volume"),
    )
    if explicit_label:
        return ProductCommercePackSize(
            label=explicit_label,
            unit=_first_text(commerce_pack_size.get("unit"), commerce.get("pack_size_unit"), packaging.get("unit")),
            value=_coerce_float(commerce_pack_size.get("value") or commerce.get("pack_size_value")),
            source="doc",
        )

    candidate_texts = _dedupe(
        [
            _clean_text(product.get("name")),
            _clean_text(_as_dict(raw_doc.get("summary")).get("one_sentence")),
            _clean_text(_as_dict(raw_doc.get("evidence")).get("doubao_raw")),
        ]
    )

    for idx, text in enumerate(candidate_texts):
        for pattern in PACK_SIZE_PATTERNS:
            match = pattern.search(text)
            if not match:
                continue
            raw_label = match.group(0).strip()
            raw_unit = re.sub(r"\s+", " ", match.group("unit").strip().lower())
            raw_value = float(match.group("value"))
            return ProductCommercePackSize(
                label=raw_label,
                unit=raw_unit,
                value=raw_value,
                source="derived_name" if idx == 0 else "derived_text",
            )
    return None


def derive_product_commerce(raw_doc: dict[str, Any] | None) -> ProductCommerceInfo:
    doc = raw_doc if isinstance(raw_doc, dict) else {}
    commerce = _as_dict(doc.get("commerce"))

    price_label = _first_text(commerce.get("price_label"), commerce.get("price"), commerce.get("price_text"))
    inventory_label = _first_text(
        commerce.get("inventory_label"),
        commerce.get("inventory"),
        commerce.get("stock_label"),
        commerce.get("stock"),
        commerce.get("availability"),
    )
    shipping_eta_label = _first_text(
        commerce.get("shipping_eta_label"),
        commerce.get("shipping_eta"),
        commerce.get("delivery_eta"),
        commerce.get("delivery_window"),
    )
    pack_size = _extract_pack_size_from_doc(doc)

    available_fields: list[str] = []
    missing_fields: list[str] = []

    if price_label:
        available_fields.append("price")
    else:
        missing_fields.append("price")

    if inventory_label:
        available_fields.append("inventory")
    else:
        missing_fields.append("inventory")

    if shipping_eta_label:
        available_fields.append("shipping_eta")
    else:
        missing_fields.append("shipping_eta")

    if pack_size:
        available_fields.append("pack_size")

    if all(field in available_fields for field in ESSENTIAL_COMMERCE_FIELDS):
        status: ProductCommerceInfo["status"] = "ready"
    elif any(field in available_fields for field in ESSENTIAL_COMMERCE_FIELDS):
        status = "partial"
    else:
        status = "catalog_only"

    return ProductCommerceInfo(
        status=status,
        is_purchasable=status == "ready",
        available_fields=available_fields,
        missing_fields=missing_fields,
        price_label=price_label,
        inventory_label=inventory_label,
        shipping_eta_label=shipping_eta_label,
        pack_size=pack_size,
    )
