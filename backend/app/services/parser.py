from app.schemas import ProductDoc

def normalize_doc(doc: dict, image_rel_path: str, doubao_raw: str | None = None) -> dict:
    # 1) 补充 evidence
    doc.setdefault("evidence", {})
    doc["evidence"]["image_path"] = image_rel_path
    if doubao_raw is not None:
        doc["evidence"]["doubao_raw"] = doubao_raw

    # 2) 用 Pydantic 校验并标准化
    validated = ProductDoc.model_validate(doc)
    return validated.model_dump()
