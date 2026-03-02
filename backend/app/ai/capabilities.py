import base64
import json
import mimetypes
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from app.ai.errors import AIServiceError
from app.ai.prompts import load_prompt, render_prompt
from app.services.doubao_openai_client import DoubaoOpenAIClient
from app.services.storage import read_rel_bytes, save_doubao_artifact
from app.settings import settings

SUPPORTED_CAPABILITIES = {
    "doubao.stage1_vision",
    "doubao.stage2_struct",
    "doubao.two_stage_parse",
    "doubao.ingredient_enrich",
    "doubao.image_json_consistency",
    "doubao.product_dedup_decision",
}


@dataclass
class CapabilityExecutionResult:
    output: dict[str, Any]
    prompt_key: str | None = None
    prompt_version: str | None = None
    model: str | None = None
    request_payload: dict[str, Any] | None = None
    response_payload: dict[str, Any] | None = None


def execute_capability(
    capability: str,
    input_payload: dict[str, Any],
    trace_id: str | None = None,
) -> CapabilityExecutionResult:
    if capability not in SUPPORTED_CAPABILITIES:
        raise AIServiceError(
            code="capability_not_supported",
            message=f"Capability '{capability}' is not supported.",
            http_status=400,
        )

    if capability == "doubao.stage1_vision":
        return _cap_stage1_vision(input_payload, trace_id)
    if capability == "doubao.stage2_struct":
        return _cap_stage2_struct(input_payload, trace_id)
    if capability == "doubao.two_stage_parse":
        return _cap_two_stage_parse(input_payload, trace_id)
    if capability == "doubao.ingredient_enrich":
        return _cap_ingredient_enrich(input_payload, trace_id)
    if capability == "doubao.image_json_consistency":
        return _cap_image_json_consistency(input_payload, trace_id)
    if capability == "doubao.product_dedup_decision":
        return _cap_product_dedup_decision(input_payload, trace_id)

    raise AIServiceError(
        code="capability_not_supported",
        message=f"Capability '{capability}' is not supported.",
        http_status=400,
    )


def _cap_stage1_vision(input_payload: dict[str, Any], trace_id: str | None) -> CapabilityExecutionResult:
    image_path = _required_str(input_payload, "image_path")
    prompt = load_prompt("doubao.stage1_vision")

    if _is_sample_mode():
        vision_text = "sample mode: skipped vision OCR."
        artifact = _maybe_save_artifact(
            trace_id=trace_id,
            stage="stage1_vision",
            payload={"model": "sample", "prompt": prompt.text, "response": {"mode": "sample"}, "text": vision_text},
        )
        return CapabilityExecutionResult(
            output={"vision_text": vision_text, "model": "sample", "artifact": artifact},
            prompt_key=prompt.key,
            prompt_version=prompt.version,
            model="sample",
            request_payload={"image_path": image_path, "prompt": prompt.text},
            response_payload={"mode": "sample"},
        )

    sdk, vision_model, _, _ = _build_sdk_and_models()
    image_data_url = _to_data_url(image_path)
    response_raw = _safe_sdk_call(lambda: sdk.chat_with_image(image_data_url, prompt.text, model=vision_model))
    vision_text = _extract_content(response_raw)
    artifact = _maybe_save_artifact(
        trace_id=trace_id,
        stage="stage1_vision",
        payload={"model": vision_model, "prompt": prompt.text, "response": response_raw, "text": vision_text},
    )

    return CapabilityExecutionResult(
        output={"vision_text": vision_text, "model": vision_model, "artifact": artifact},
        prompt_key=prompt.key,
        prompt_version=prompt.version,
        model=vision_model,
        request_payload={"image_path": image_path, "prompt": prompt.text},
        response_payload=response_raw,
    )


def _cap_stage2_struct(input_payload: dict[str, Any], trace_id: str | None) -> CapabilityExecutionResult:
    vision_text = _required_nonempty_str(input_payload, "vision_text")
    prompt = load_prompt("doubao.stage2_struct")
    rendered_prompt = render_prompt(prompt.text, {"vision_text": vision_text})

    if _is_sample_mode():
        sample_doc = _sample_product_doc()
        artifact = _maybe_save_artifact(
            trace_id=trace_id,
            stage="stage2_struct",
            payload={"model": "sample", "prompt": rendered_prompt, "response": {"mode": "sample"}, "text": json.dumps(sample_doc, ensure_ascii=False)},
        )
        return CapabilityExecutionResult(
            output={
                "doc": sample_doc,
                "struct_text": json.dumps(sample_doc, ensure_ascii=False),
                "model": "sample",
                "artifact": artifact,
            },
            prompt_key=prompt.key,
            prompt_version=prompt.version,
            model="sample",
            request_payload={"prompt": rendered_prompt},
            response_payload={"mode": "sample"},
        )

    sdk, _, struct_model, _ = _build_sdk_and_models()
    response_raw = _safe_sdk_call(lambda: sdk.chat_with_text(rendered_prompt, model=struct_model))
    struct_text = _extract_content(response_raw)
    struct_doc = _extract_json_object(struct_text)
    artifact = _maybe_save_artifact(
        trace_id=trace_id,
        stage="stage2_struct",
        payload={"model": struct_model, "prompt": rendered_prompt, "response": response_raw, "text": struct_text},
    )

    return CapabilityExecutionResult(
        output={"doc": struct_doc, "struct_text": struct_text, "model": struct_model, "artifact": artifact},
        prompt_key=prompt.key,
        prompt_version=prompt.version,
        model=struct_model,
        request_payload={"prompt": rendered_prompt},
        response_payload=response_raw,
    )


def _cap_two_stage_parse(input_payload: dict[str, Any], trace_id: str | None) -> CapabilityExecutionResult:
    image_path = _required_str(input_payload, "image_path")
    stage1 = _cap_stage1_vision({"image_path": image_path}, trace_id=trace_id)
    stage2 = _cap_stage2_struct({"vision_text": stage1.output["vision_text"]}, trace_id=trace_id)

    doc = stage2.output["doc"]
    evidence = doc.setdefault("evidence", {})
    evidence["doubao_raw"] = stage2.output.get("struct_text")
    evidence["doubao_vision_text"] = stage1.output.get("vision_text")
    evidence["doubao_pipeline_mode"] = "two-stage"
    evidence["doubao_models"] = {"vision": stage1.output.get("model"), "struct": stage2.output.get("model")}
    evidence["doubao_artifacts"] = {"vision": stage1.output.get("artifact"), "struct": stage2.output.get("artifact")}

    return CapabilityExecutionResult(
        output=doc,
        prompt_key="doubao.two_stage_parse",
        prompt_version=f"{stage1.prompt_version}+{stage2.prompt_version}",
        model=f"{stage1.model}|{stage2.model}",
        request_payload={"image_path": image_path},
        response_payload={
            "stage1": {"artifact": stage1.output.get("artifact"), "model": stage1.output.get("model")},
            "stage2": {"artifact": stage2.output.get("artifact"), "model": stage2.output.get("model")},
        },
    )


def _cap_ingredient_enrich(input_payload: dict[str, Any], trace_id: str | None) -> CapabilityExecutionResult:
    ingredient = _required_nonempty_str(input_payload, "ingredient")
    context = str(input_payload.get("context") or "").strip()
    prompt = load_prompt("doubao.ingredient_enrich")
    rendered_prompt = render_prompt(prompt.text, {"ingredient": ingredient, "context": context})

    if _is_sample_mode():
        text = f"sample mode: ingredient={ingredient}, context={context or 'none'}"
        artifact = _maybe_save_artifact(trace_id, "ingredient_enrich", {"model": "sample", "prompt": rendered_prompt, "response": {"mode": "sample"}, "text": text})
        return CapabilityExecutionResult(
            output={"analysis_text": text, "model": "sample", "artifact": artifact},
            prompt_key=prompt.key,
            prompt_version=prompt.version,
            model="sample",
            request_payload={"prompt": rendered_prompt},
            response_payload={"mode": "sample"},
        )

    sdk, _, _, text_model = _build_sdk_and_models()
    response_raw = _safe_sdk_call(lambda: sdk.chat_with_text(rendered_prompt, model=text_model))
    text = _extract_content(response_raw)
    artifact = _maybe_save_artifact(trace_id, "ingredient_enrich", {"model": text_model, "prompt": rendered_prompt, "response": response_raw, "text": text})
    return CapabilityExecutionResult(
        output={"analysis_text": text, "model": text_model, "artifact": artifact},
        prompt_key=prompt.key,
        prompt_version=prompt.version,
        model=text_model,
        request_payload={"prompt": rendered_prompt},
        response_payload=response_raw,
    )


def _cap_image_json_consistency(input_payload: dict[str, Any], trace_id: str | None) -> CapabilityExecutionResult:
    image_path = _required_str(input_payload, "image_path")
    json_text = _required_nonempty_str(input_payload, "json_text")
    stage1 = _cap_stage1_vision({"image_path": image_path}, trace_id=trace_id)

    prompt = load_prompt("doubao.image_json_consistency")
    rendered_prompt = render_prompt(
        prompt.text,
        {"vision_text": stage1.output.get("vision_text", ""), "json_text": json_text},
    )

    if _is_sample_mode():
        text = "sample mode: consistency looks good."
        artifact = _maybe_save_artifact(trace_id, "image_json_consistency", {"model": "sample", "prompt": rendered_prompt, "response": {"mode": "sample"}, "text": text})
        return CapabilityExecutionResult(
            output={
                "analysis_text": text,
                "vision_text": stage1.output.get("vision_text"),
                "model": "sample",
                "artifact": artifact,
            },
            prompt_key=prompt.key,
            prompt_version=prompt.version,
            model="sample",
            request_payload={"image_path": image_path, "prompt": rendered_prompt},
            response_payload={"mode": "sample"},
        )

    sdk, _, _, text_model = _build_sdk_and_models()
    response_raw = _safe_sdk_call(lambda: sdk.chat_with_text(rendered_prompt, model=text_model))
    text = _extract_content(response_raw)
    artifact = _maybe_save_artifact(trace_id, "image_json_consistency", {"model": text_model, "prompt": rendered_prompt, "response": response_raw, "text": text})
    return CapabilityExecutionResult(
        output={
            "analysis_text": text,
            "vision_text": stage1.output.get("vision_text"),
            "model": text_model,
            "artifact": artifact,
        },
        prompt_key=prompt.key,
        prompt_version=prompt.version,
        model=text_model,
        request_payload={"image_path": image_path, "prompt": rendered_prompt},
        response_payload=response_raw,
    )


def _cap_product_dedup_decision(input_payload: dict[str, Any], trace_id: str | None) -> CapabilityExecutionResult:
    candidate_json = _required_nonempty_str(input_payload, "candidate_json")
    existing_jsons = input_payload.get("existing_jsons") or []
    if not isinstance(existing_jsons, list):
        raise AIServiceError(code="invalid_input", message="existing_jsons must be a list.", http_status=400)
    existing_jsons = existing_jsons[:20]

    prompt = load_prompt("doubao.product_dedup_decision")
    rendered_prompt = render_prompt(
        prompt.text,
        {
            "candidate_json": candidate_json,
            "existing_jsons": json.dumps(existing_jsons, ensure_ascii=False),
        },
    )

    if _is_sample_mode():
        text = "sample mode: dedup decision unavailable."
        artifact = _maybe_save_artifact(trace_id, "product_dedup_decision", {"model": "sample", "prompt": rendered_prompt, "response": {"mode": "sample"}, "text": text})
        return CapabilityExecutionResult(
            output={"analysis_text": text, "model": "sample", "artifact": artifact},
            prompt_key=prompt.key,
            prompt_version=prompt.version,
            model="sample",
            request_payload={"prompt": rendered_prompt},
            response_payload={"mode": "sample"},
        )

    sdk, _, _, text_model = _build_sdk_and_models()
    response_raw = _safe_sdk_call(lambda: sdk.chat_with_text(rendered_prompt, model=text_model))
    text = _extract_content(response_raw)
    artifact = _maybe_save_artifact(trace_id, "product_dedup_decision", {"model": text_model, "prompt": rendered_prompt, "response": response_raw, "text": text})
    return CapabilityExecutionResult(
        output={"analysis_text": text, "model": text_model, "artifact": artifact},
        prompt_key=prompt.key,
        prompt_version=prompt.version,
        model=text_model,
        request_payload={"prompt": rendered_prompt},
        response_payload=response_raw,
    )


def _is_sample_mode() -> bool:
    return settings.doubao_mode.lower().strip() in {"mock", "sample"}


def _build_sdk_and_models() -> tuple[DoubaoOpenAIClient, str, str, str]:
    mode = settings.doubao_mode.lower().strip()
    if mode != "real":
        raise AIServiceError(
            code="doubao_mode_invalid",
            message=f"Invalid DOUBAO_MODE: {mode}. Expected one of: real, mock, sample.",
            http_status=400,
        )

    api_key = settings.doubao_api_key or settings.ark_api_key
    if not api_key:
        raise AIServiceError(
            code="doubao_key_missing",
            message="Missing API key. Set DOUBAO_API_KEY or ARK_API_KEY in backend/.env.local.",
            http_status=400,
        )

    endpoint = settings.doubao_endpoint or "https://ark.cn-beijing.volces.com/api/v3"
    vision_model = settings.doubao_vision_model or settings.doubao_model or "doubao-seed-2-0-mini-260215"
    struct_model = settings.doubao_struct_model or settings.doubao_model or vision_model
    pro_model = settings.doubao_pro_model or "doubao-seed-2-0-pro-260215"
    advanced_text_model = settings.doubao_advanced_text_model or pro_model or struct_model
    sdk = DoubaoOpenAIClient(
        api_key=api_key,
        endpoint=endpoint,
        model=vision_model,
        timeout=settings.doubao_timeout_seconds,
    )
    return sdk, vision_model, struct_model, advanced_text_model


def _safe_sdk_call(callable_fn):
    try:
        return callable_fn()
    except RuntimeError as e:
        message = str(e).strip() or "Doubao request failed."
        status = 400 if message.startswith("Doubao configuration") else 502
        raise AIServiceError(code="doubao_request_failed", message=message, http_status=status) from e


def _to_data_url(image_rel_path: str) -> str:
    try:
        data = read_rel_bytes(image_rel_path)
    except FileNotFoundError as e:
        raise AIServiceError(code="image_not_found", message=f"Image file not found: {image_rel_path}.", http_status=404) from e
    except ValueError as e:
        raise AIServiceError(code="image_path_invalid", message=f"Invalid image path: {image_rel_path}.", http_status=400) from e
    mime, _ = mimetypes.guess_type(image_rel_path)
    mime = mime or "image/jpeg"
    b64 = base64.b64encode(data).decode("ascii")
    return f"data:{mime};base64,{b64}"


def _sample_product_doc() -> dict[str, Any]:
    sample = Path(__file__).resolve().parents[2] / "sample_data" / "product_sample.json"
    return json.loads(sample.read_text(encoding="utf-8"))


def _maybe_save_artifact(trace_id: str | None, stage: str, payload: dict[str, Any]) -> str | None:
    if not trace_id:
        return None
    return save_doubao_artifact(trace_id, stage, payload)


def _required_str(payload: dict[str, Any], key: str) -> str:
    value = payload.get(key)
    text = str(value).strip() if value is not None else ""
    if not text:
        raise AIServiceError(code="invalid_input", message=f"'{key}' is required.", http_status=400)
    return text


def _required_nonempty_str(payload: dict[str, Any], key: str) -> str:
    return _required_str(payload, key)


def _extract_content(raw: dict[str, Any]) -> str:
    output_text = raw.get("output_text")
    if isinstance(output_text, str) and output_text.strip():
        return output_text.strip()

    output = raw.get("output")
    if isinstance(output, list):
        collected: list[str] = []
        for item in output:
            collected.extend(_collect_text(item))
        merged = _merge_texts(collected)
        if merged:
            return merged

    choices = raw.get("choices") or []
    if isinstance(choices, list) and choices:
        message = choices[0].get("message") if isinstance(choices[0], dict) else {}
        if not isinstance(message, dict):
            message = {}
        content = message.get("content")
        if isinstance(content, list):
            texts = _collect_text(content)
            merged = _merge_texts(texts)
            if merged:
                return merged
        if isinstance(content, str) and content.strip():
            return content.strip()

    raise AIServiceError(
        code="doubao_empty_response",
        message=f"Doubao response content is empty. top-level keys={list(raw.keys())}",
        http_status=502,
    )


def _collect_text(node: Any) -> list[str]:
    texts: list[str] = []
    if isinstance(node, str):
        value = node.strip()
        if value:
            texts.append(value)
        return texts

    if isinstance(node, list):
        for item in node:
            texts.extend(_collect_text(item))
        return texts

    if not isinstance(node, dict):
        return texts

    for key in ("text", "output_text"):
        value = node.get(key)
        if isinstance(value, str) and value.strip():
            texts.append(value.strip())

    content = node.get("content")
    if content is not None:
        texts.extend(_collect_text(content))

    return texts


def _merge_texts(texts: list[str]) -> str:
    merged: list[str] = []
    seen = set()
    for item in texts:
        value = item.strip()
        if not value or value in seen:
            continue
        seen.add(value)
        merged.append(value)
    return "\n".join(merged).strip()


def _extract_json_object(text: str) -> dict[str, Any]:
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    fence = re.search(r"```(?:json)?\s*(\{[\s\S]*\})\s*```", text)
    if fence:
        return json.loads(fence.group(1))

    first = text.find("{")
    last = text.rfind("}")
    if first >= 0 and last > first:
        return json.loads(text[first : last + 1])

    raise AIServiceError(code="json_not_found", message="No JSON object found in capability response.", http_status=422)
