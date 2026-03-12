import base64
import json
import mimetypes
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable

from app.constants import MOBILE_RULES_VERSION, PRODUCT_PROFILE_SUPPORTED_CATEGORIES, ROUTE_MAPPING_SUPPORTED_CATEGORIES
from app.ai.errors import AIServiceError
from app.ai.prompts import load_prompt, render_prompt
from app.schemas import (
    BodywashProductAnalysisResult,
    CleanserProductAnalysisResult,
    ConditionerProductAnalysisResult,
    MobileSelectionResultAIContent,
    MobileSelectionResultContextPayload,
    LotionProductAnalysisResult,
    ProductAnalysisContextPayload,
    ShampooProductAnalysisResult,
)
from app.services.doubao_openai_client import DoubaoOpenAIClient
from app.services.storage import read_rel_bytes, save_doubao_artifact
from app.settings import settings

SUPPORTED_CAPABILITIES = {
    "doubao.stage1_vision",
    "doubao.stage2_struct",
    "doubao.two_stage_parse",
    "doubao.ingredient_enrich",
    "doubao.ingredient_category_profile",
    "doubao.image_json_consistency",
    "doubao.product_dedup_decision",
    "doubao.product_dedup_group",
    "doubao.mobile_compare_summary",
    "doubao.route_mapping_shampoo",
    "doubao.route_mapping_bodywash",
    "doubao.route_mapping_conditioner",
    "doubao.route_mapping_lotion",
    "doubao.route_mapping_cleanser",
    "doubao.product_profile_shampoo",
    "doubao.product_profile_bodywash",
    "doubao.product_profile_conditioner",
    "doubao.product_profile_lotion",
    "doubao.product_profile_cleanser",
    "doubao.mobile_selection_result_shampoo",
    "doubao.mobile_selection_result_bodywash",
    "doubao.mobile_selection_result_conditioner",
    "doubao.mobile_selection_result_lotion",
    "doubao.mobile_selection_result_cleanser",
}

MODEL_TIER_VALUES = {"mini", "lite", "pro"}


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
    event_callback: Callable[[dict[str, Any]], None] | None = None,
) -> CapabilityExecutionResult:
    if capability not in SUPPORTED_CAPABILITIES:
        raise AIServiceError(
            code="capability_not_supported",
            message=f"Capability '{capability}' is not supported.",
            http_status=400,
        )

    if capability == "doubao.stage1_vision":
        return _cap_stage1_vision(input_payload, trace_id, event_callback=event_callback)
    if capability == "doubao.stage2_struct":
        return _cap_stage2_struct(input_payload, trace_id, event_callback=event_callback)
    if capability == "doubao.two_stage_parse":
        return _cap_two_stage_parse(input_payload, trace_id, event_callback=event_callback)
    if capability == "doubao.ingredient_enrich":
        return _cap_ingredient_enrich(input_payload, trace_id, event_callback=event_callback)
    if capability == "doubao.ingredient_category_profile":
        return _cap_ingredient_category_profile(input_payload, trace_id, event_callback=event_callback)
    if capability == "doubao.image_json_consistency":
        return _cap_image_json_consistency(input_payload, trace_id, event_callback=event_callback)
    if capability == "doubao.product_dedup_decision":
        return _cap_product_dedup_decision(input_payload, trace_id, event_callback=event_callback)
    if capability == "doubao.product_dedup_group":
        return _cap_product_dedup_group(input_payload, trace_id, event_callback=event_callback)
    if capability == "doubao.mobile_compare_summary":
        return _cap_mobile_compare_summary(input_payload, trace_id, event_callback=event_callback)
    if capability == "doubao.route_mapping_shampoo":
        return _cap_route_mapping("shampoo", input_payload, trace_id, event_callback=event_callback)
    if capability == "doubao.route_mapping_bodywash":
        return _cap_route_mapping("bodywash", input_payload, trace_id, event_callback=event_callback)
    if capability == "doubao.route_mapping_conditioner":
        return _cap_route_mapping("conditioner", input_payload, trace_id, event_callback=event_callback)
    if capability == "doubao.route_mapping_lotion":
        return _cap_route_mapping("lotion", input_payload, trace_id, event_callback=event_callback)
    if capability == "doubao.route_mapping_cleanser":
        return _cap_route_mapping("cleanser", input_payload, trace_id, event_callback=event_callback)
    if capability == "doubao.product_profile_shampoo":
        return _cap_product_profile("shampoo", input_payload, trace_id, event_callback=event_callback)
    if capability == "doubao.product_profile_bodywash":
        return _cap_product_profile("bodywash", input_payload, trace_id, event_callback=event_callback)
    if capability == "doubao.product_profile_conditioner":
        return _cap_product_profile("conditioner", input_payload, trace_id, event_callback=event_callback)
    if capability == "doubao.product_profile_lotion":
        return _cap_product_profile("lotion", input_payload, trace_id, event_callback=event_callback)
    if capability == "doubao.product_profile_cleanser":
        return _cap_product_profile("cleanser", input_payload, trace_id, event_callback=event_callback)
    if capability == "doubao.mobile_selection_result_shampoo":
        return _cap_mobile_selection_result("shampoo", input_payload, trace_id, event_callback=event_callback)
    if capability == "doubao.mobile_selection_result_bodywash":
        return _cap_mobile_selection_result("bodywash", input_payload, trace_id, event_callback=event_callback)
    if capability == "doubao.mobile_selection_result_conditioner":
        return _cap_mobile_selection_result("conditioner", input_payload, trace_id, event_callback=event_callback)
    if capability == "doubao.mobile_selection_result_lotion":
        return _cap_mobile_selection_result("lotion", input_payload, trace_id, event_callback=event_callback)
    if capability == "doubao.mobile_selection_result_cleanser":
        return _cap_mobile_selection_result("cleanser", input_payload, trace_id, event_callback=event_callback)

    raise AIServiceError(
        code="capability_not_supported",
        message=f"Capability '{capability}' is not supported.",
        http_status=400,
    )


def _cap_stage1_vision(
    input_payload: dict[str, Any],
    trace_id: str | None,
    event_callback: Callable[[dict[str, Any]], None] | None = None,
) -> CapabilityExecutionResult:
    image_paths = _normalize_stage1_image_paths(input_payload)
    prompt = load_prompt("doubao.stage1_vision")
    _emit(
        event_callback,
        {
            "type": "step",
            "stage": "stage1_vision",
            "message": f"Preparing {len(image_paths)} image(s) and prompt.",
        },
    )

    if _is_sample_mode():
        vision_text = "sample mode: skipped vision OCR."
        _emit(event_callback, {"type": "step", "stage": "stage1_vision", "message": "Sample mode enabled."})
        artifact = _maybe_save_artifact(
            trace_id=trace_id,
            stage="stage1_vision",
            payload={
                "model": "sample",
                "prompt": prompt.text,
                "response": {"mode": "sample"},
                "text": vision_text,
                "image_paths": image_paths,
            },
        )
        return CapabilityExecutionResult(
            output={"vision_text": vision_text, "model": "sample", "artifact": artifact},
            prompt_key=prompt.key,
            prompt_version=prompt.version,
            model="sample",
            request_payload={"image_paths": image_paths, "prompt": prompt.text},
            response_payload={"mode": "sample"},
        )

    sdk, vision_model, _, _ = _build_sdk_and_models()
    selected_tier = _normalize_model_tier(input_payload.get("model_tier"), field_name="model_tier")
    selected_model = _resolve_model_by_tier(
        tier=selected_tier,
        default_model=vision_model,
        mini_model=vision_model,
        lite_model=(settings.doubao_lite_model or "doubao-seed-2-0-lite-260215"),
        pro_model=(settings.doubao_pro_model or "doubao-seed-2-0-pro-260215"),
    )
    _emit(
        event_callback,
        {"type": "step", "stage": "stage1_vision", "message": f"Calling model {selected_model}."},
    )
    image_data_urls = [_to_data_url(item) for item in image_paths]
    response_raw = _safe_sdk_call(
        lambda: sdk.chat_with_image(
            image_data_urls[0],
            prompt.text,
            model=selected_model,
            stream=event_callback is not None,
            **_build_doubao_stream_handlers(event_callback=event_callback, stage="stage1_vision"),
        )
        if len(image_data_urls) == 1
        else sdk.chat_with_images(
            image_data_urls,
            prompt.text,
            model=selected_model,
            stream=event_callback is not None,
            **_build_doubao_stream_handlers(event_callback=event_callback, stage="stage1_vision"),
        )
    )
    vision_text = _extract_content(response_raw)
    _emit(event_callback, {"type": "step", "stage": "stage1_vision", "message": "Stage1 text extracted."})
    artifact = _maybe_save_artifact(
        trace_id=trace_id,
        stage="stage1_vision",
        payload={
            "model": selected_model,
            "prompt": prompt.text,
            "response": response_raw,
            "text": vision_text,
            "image_paths": image_paths,
        },
    )

    return CapabilityExecutionResult(
        output={"vision_text": vision_text, "model": selected_model, "artifact": artifact},
        prompt_key=prompt.key,
        prompt_version=prompt.version,
        model=selected_model,
        request_payload={"image_paths": image_paths, "prompt": prompt.text},
        response_payload=response_raw,
    )


def _cap_stage2_struct(
    input_payload: dict[str, Any],
    trace_id: str | None,
    event_callback: Callable[[dict[str, Any]], None] | None = None,
) -> CapabilityExecutionResult:
    vision_text = _required_nonempty_str(input_payload, "vision_text")
    prompt = load_prompt("doubao.stage2_struct")
    rendered_prompt = render_prompt(prompt.text, {"vision_text": vision_text})
    _emit(event_callback, {"type": "step", "stage": "stage2_struct", "message": "Rendering struct prompt."})

    if _is_sample_mode():
        sample_doc = _sample_product_doc()
        _emit(event_callback, {"type": "step", "stage": "stage2_struct", "message": "Sample mode enabled."})
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
    selected_tier = _normalize_model_tier(input_payload.get("model_tier"), field_name="model_tier")
    selected_model = _resolve_model_by_tier(
        tier=selected_tier,
        default_model=struct_model,
        mini_model=struct_model,
        lite_model=(settings.doubao_lite_model or "doubao-seed-2-0-lite-260215"),
        pro_model=(settings.doubao_pro_model or "doubao-seed-2-0-pro-260215"),
    )
    _emit(
        event_callback,
        {"type": "step", "stage": "stage2_struct", "message": f"Calling model {selected_model}."},
    )
    response_raw = _safe_sdk_call(
        lambda: sdk.chat_with_text(
            rendered_prompt,
            model=selected_model,
            stream=event_callback is not None,
            **_build_doubao_stream_handlers(event_callback=event_callback, stage="stage2_struct"),
        )
    )
    struct_text = _extract_content(response_raw)
    struct_doc = _extract_json_object(struct_text)
    _emit(event_callback, {"type": "step", "stage": "stage2_struct", "message": "Stage2 JSON extracted."})
    artifact = _maybe_save_artifact(
        trace_id=trace_id,
        stage="stage2_struct",
        payload={"model": selected_model, "prompt": rendered_prompt, "response": response_raw, "text": struct_text},
    )

    return CapabilityExecutionResult(
        output={"doc": struct_doc, "struct_text": struct_text, "model": selected_model, "artifact": artifact},
        prompt_key=prompt.key,
        prompt_version=prompt.version,
        model=selected_model,
        request_payload={"prompt": rendered_prompt},
        response_payload=response_raw,
    )


def _cap_two_stage_parse(
    input_payload: dict[str, Any],
    trace_id: str | None,
    event_callback: Callable[[dict[str, Any]], None] | None = None,
) -> CapabilityExecutionResult:
    image_path = _required_str(input_payload, "image_path")
    stage1_model_tier = input_payload.get("stage1_model_tier")
    stage2_model_tier = input_payload.get("stage2_model_tier")
    stage1_input: dict[str, Any] = {"image_path": image_path}
    if stage1_model_tier is not None:
        stage1_input["model_tier"] = stage1_model_tier
    stage2_input: dict[str, Any] = {"vision_text": ""}
    if stage2_model_tier is not None:
        stage2_input["model_tier"] = stage2_model_tier
    _emit(event_callback, {"type": "step", "stage": "two_stage_parse", "message": "Running stage1 vision."})
    stage1 = _cap_stage1_vision(stage1_input, trace_id=trace_id, event_callback=event_callback)
    _emit(event_callback, {"type": "step", "stage": "two_stage_parse", "message": "Running stage2 struct."})
    stage2_input["vision_text"] = stage1.output["vision_text"]
    stage2 = _cap_stage2_struct(stage2_input, trace_id=trace_id, event_callback=event_callback)

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


def _cap_ingredient_enrich(
    input_payload: dict[str, Any],
    trace_id: str | None,
    event_callback: Callable[[dict[str, Any]], None] | None = None,
) -> CapabilityExecutionResult:
    ingredient = _required_nonempty_str(input_payload, "ingredient")
    context = str(input_payload.get("context") or "").strip()
    prompt = load_prompt("doubao.ingredient_enrich")
    rendered_prompt = render_prompt(prompt.text, {"ingredient": ingredient, "context": context})
    _emit(event_callback, {"type": "step", "stage": "ingredient_enrich", "message": "Prompt prepared."})

    if _is_sample_mode():
        text = f"sample mode: ingredient={ingredient}, context={context or 'none'}"
        _emit(event_callback, {"type": "step", "stage": "ingredient_enrich", "message": "Sample mode enabled."})
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
    _emit(
        event_callback,
        {"type": "step", "stage": "ingredient_enrich", "message": f"Calling model {text_model}."},
    )
    response_raw = _safe_sdk_call(
        lambda: sdk.chat_with_text(
            rendered_prompt,
            model=text_model,
            stream=event_callback is not None,
            **_build_doubao_stream_handlers(event_callback=event_callback, stage="ingredient_enrich"),
        )
    )
    text = _extract_content(response_raw)
    _emit(event_callback, {"type": "step", "stage": "ingredient_enrich", "message": "Analysis completed."})
    artifact = _maybe_save_artifact(trace_id, "ingredient_enrich", {"model": text_model, "prompt": rendered_prompt, "response": response_raw, "text": text})
    return CapabilityExecutionResult(
        output={"analysis_text": text, "model": text_model, "artifact": artifact},
        prompt_key=prompt.key,
        prompt_version=prompt.version,
        model=text_model,
        request_payload={"prompt": rendered_prompt},
        response_payload=response_raw,
    )


def _cap_ingredient_category_profile(
    input_payload: dict[str, Any],
    trace_id: str | None,
    event_callback: Callable[[dict[str, Any]], None] | None = None,
) -> CapabilityExecutionResult:
    ingredient = _required_nonempty_str(input_payload, "ingredient")
    category = _required_nonempty_str(input_payload, "category").lower()
    source_json = input_payload.get("source_json")
    if not isinstance(source_json, dict):
        raise AIServiceError(code="invalid_input", message="source_json must be an object.", http_status=400)
    stats = source_json.get("stats")
    samples = source_json.get("samples")
    if not isinstance(stats, dict):
        raise AIServiceError(code="invalid_input", message="source_json.stats must be an object.", http_status=400)
    if not isinstance(samples, list):
        raise AIServiceError(code="invalid_input", message="source_json.samples must be a list.", http_status=400)
    source_samples = [item for item in samples if isinstance(item, dict)][:30]
    if not source_samples:
        raise AIServiceError(code="invalid_input", message="source_json.samples should contain at least one item.", http_status=400)
    try:
        product_count = int(stats.get("product_count"))
        mention_count = int(stats.get("mention_count"))
    except Exception:
        raise AIServiceError(
            code="invalid_input",
            message="source_json.stats.product_count and mention_count should be integers.",
            http_status=400,
        )
    if product_count <= 0 or mention_count <= 0:
        raise AIServiceError(
            code="invalid_input",
            message="source_json.stats.product_count and mention_count should be > 0.",
            http_status=400,
        )

    prompt = load_prompt("doubao.ingredient_category_profile")
    rendered_prompt = render_prompt(
        prompt.text,
        {
            "ingredient": ingredient,
            "category": category,
            "source_json_json": json.dumps(source_json, ensure_ascii=False),
            "source_samples_json": json.dumps(source_samples, ensure_ascii=False),
        },
    )
    _emit(event_callback, {"type": "step", "stage": "ingredient_category_profile", "message": "Prompt prepared."})

    if _is_sample_mode():
        sample = {
            "ingredient_name": ingredient,
            "ingredient_name_en": "",
            "category": category,
            "summary": f"sample mode: {ingredient} in {category}",
            "benefits": [],
            "risks": [],
            "usage_tips": [],
            "suitable_for": [],
            "avoid_for": [],
            "confidence": 0,
            "reason": "sample mode",
        }
        artifact = _maybe_save_artifact(
            trace_id,
            "ingredient_category_profile",
            {"model": "sample", "prompt": rendered_prompt, "response": {"mode": "sample"}, "text": json.dumps(sample, ensure_ascii=False)},
        )
        return CapabilityExecutionResult(
            output={**sample, "analysis_text": json.dumps(sample, ensure_ascii=False), "model": "sample", "artifact": artifact},
            prompt_key=prompt.key,
            prompt_version=prompt.version,
            model="sample",
            request_payload={"prompt": rendered_prompt},
            response_payload={"mode": "sample"},
        )

    sdk, _, _, _ = _build_sdk_and_models()
    pro_model = settings.doubao_pro_model or "doubao-seed-2-0-pro-260215"
    _emit(
        event_callback,
        {"type": "step", "stage": "ingredient_category_profile", "message": f"Calling model {pro_model}."},
    )
    response_raw = _safe_sdk_call(
        lambda: sdk.chat_with_text(
            rendered_prompt,
            model=pro_model,
            stream=event_callback is not None,
            **_build_doubao_stream_handlers(event_callback=event_callback, stage="ingredient_category_profile"),
        )
    )
    text = _extract_content(response_raw)
    parsed = _extract_json_object(text)
    normalized = _normalize_ingredient_category_profile_result(category=category, ingredient=ingredient, payload=parsed)
    _emit(event_callback, {"type": "step", "stage": "ingredient_category_profile", "message": "Ingredient profile completed."})
    artifact = _maybe_save_artifact(
        trace_id,
        "ingredient_category_profile",
        {"model": pro_model, "prompt": rendered_prompt, "response": response_raw, "text": text},
    )
    return CapabilityExecutionResult(
        output={**normalized, "analysis_text": text, "model": pro_model, "artifact": artifact},
        prompt_key=prompt.key,
        prompt_version=prompt.version,
        model=pro_model,
        request_payload={"prompt": rendered_prompt},
        response_payload=response_raw,
    )


def _cap_image_json_consistency(
    input_payload: dict[str, Any],
    trace_id: str | None,
    event_callback: Callable[[dict[str, Any]], None] | None = None,
) -> CapabilityExecutionResult:
    image_path = _required_str(input_payload, "image_path")
    json_text = _required_nonempty_str(input_payload, "json_text")
    _emit(event_callback, {"type": "step", "stage": "image_json_consistency", "message": "Running stage1 vision."})
    stage1 = _cap_stage1_vision({"image_path": image_path}, trace_id=trace_id, event_callback=event_callback)

    prompt = load_prompt("doubao.image_json_consistency")
    rendered_prompt = render_prompt(
        prompt.text,
        {"vision_text": stage1.output.get("vision_text", ""), "json_text": json_text},
    )

    if _is_sample_mode():
        text = "sample mode: consistency looks good."
        _emit(event_callback, {"type": "step", "stage": "image_json_consistency", "message": "Sample mode enabled."})
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
    _emit(
        event_callback,
        {"type": "step", "stage": "image_json_consistency", "message": f"Calling model {text_model}."},
    )
    response_raw = _safe_sdk_call(
        lambda: sdk.chat_with_text(
            rendered_prompt,
            model=text_model,
            stream=event_callback is not None,
            **_build_doubao_stream_handlers(event_callback=event_callback, stage="image_json_consistency"),
        )
    )
    text = _extract_content(response_raw)
    _emit(event_callback, {"type": "step", "stage": "image_json_consistency", "message": "Consistency analysis completed."})
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


def _cap_product_dedup_decision(
    input_payload: dict[str, Any],
    trace_id: str | None,
    event_callback: Callable[[dict[str, Any]], None] | None = None,
) -> CapabilityExecutionResult:
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
        _emit(event_callback, {"type": "step", "stage": "product_dedup_decision", "message": "Sample mode enabled."})
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
    _emit(
        event_callback,
        {"type": "step", "stage": "product_dedup_decision", "message": f"Calling model {text_model}."},
    )
    response_raw = _safe_sdk_call(
        lambda: sdk.chat_with_text(
            rendered_prompt,
            model=text_model,
            stream=event_callback is not None,
            **_build_doubao_stream_handlers(event_callback=event_callback, stage="product_dedup_decision"),
        )
    )
    text = _extract_content(response_raw)
    _emit(event_callback, {"type": "step", "stage": "product_dedup_decision", "message": "Dedup analysis completed."})
    artifact = _maybe_save_artifact(trace_id, "product_dedup_decision", {"model": text_model, "prompt": rendered_prompt, "response": response_raw, "text": text})
    return CapabilityExecutionResult(
        output={"analysis_text": text, "model": text_model, "artifact": artifact},
        prompt_key=prompt.key,
        prompt_version=prompt.version,
        model=text_model,
        request_payload={"prompt": rendered_prompt},
        response_payload=response_raw,
    )


def _cap_product_dedup_group(
    input_payload: dict[str, Any],
    trace_id: str | None,
    event_callback: Callable[[dict[str, Any]], None] | None = None,
) -> CapabilityExecutionResult:
    anchor_product = input_payload.get("anchor_product")
    candidate_products = input_payload.get("candidate_products")
    if not isinstance(anchor_product, dict):
        raise AIServiceError(code="invalid_input", message="anchor_product must be an object.", http_status=400)
    if not isinstance(candidate_products, list):
        raise AIServiceError(code="invalid_input", message="candidate_products must be a list.", http_status=400)

    anchor_id = str(anchor_product.get("id") or "").strip()
    if not anchor_id:
        raise AIServiceError(code="invalid_input", message="anchor_product.id is required.", http_status=400)

    candidate_products = [item for item in candidate_products if isinstance(item, dict)][:20]

    prompt = load_prompt("doubao.product_dedup_group")
    rendered_prompt = render_prompt(
        prompt.text,
        {
            "anchor_product_json": json.dumps(anchor_product, ensure_ascii=False),
            "candidate_products_json": json.dumps(candidate_products, ensure_ascii=False),
        },
    )

    if _is_sample_mode():
        sample = {
            "keep_id": anchor_id,
            "duplicates": [],
            "reason": "sample mode: skip dedup grouping.",
        }
        artifact = _maybe_save_artifact(
            trace_id,
            "product_dedup_group",
            {"model": "sample", "prompt": rendered_prompt, "response": {"mode": "sample"}, "text": json.dumps(sample, ensure_ascii=False)},
        )
        return CapabilityExecutionResult(
            output={**sample, "analysis_text": json.dumps(sample, ensure_ascii=False), "model": "sample", "artifact": artifact},
            prompt_key=prompt.key,
            prompt_version=prompt.version,
            model="sample",
            request_payload={"prompt": rendered_prompt},
            response_payload={"mode": "sample"},
        )

    sdk, _, _, text_model = _build_sdk_and_models()
    selected_tier = _normalize_model_tier(input_payload.get("model_tier"), field_name="model_tier")
    selected_model = _resolve_model_by_tier(
        tier=selected_tier,
        default_model=text_model,
        mini_model=(settings.doubao_model or settings.doubao_struct_model or "doubao-seed-2-0-mini-260215"),
        lite_model=(settings.doubao_lite_model or "doubao-seed-2-0-lite-260215"),
        pro_model=(settings.doubao_pro_model or "doubao-seed-2-0-pro-260215"),
    )
    _emit(
        event_callback,
        {"type": "step", "stage": "product_dedup_group", "message": f"Calling model {selected_model}."},
    )
    response_raw = _safe_sdk_call(
        lambda: sdk.chat_with_text(
            rendered_prompt,
            model=selected_model,
            stream=event_callback is not None,
            **_build_doubao_stream_handlers(event_callback=event_callback, stage="product_dedup_group"),
        )
    )
    text = _extract_content(response_raw)
    parsed = _extract_json_object(text)
    normalized = _normalize_dedup_group_result(anchor_id=anchor_id, candidate_products=candidate_products, payload=parsed)
    _emit(event_callback, {"type": "step", "stage": "product_dedup_group", "message": "Dedup grouping completed."})
    artifact = _maybe_save_artifact(
        trace_id,
        "product_dedup_group",
        {"model": selected_model, "prompt": rendered_prompt, "response": response_raw, "text": text},
    )
    return CapabilityExecutionResult(
        output={**normalized, "analysis_text": text, "model": selected_model, "artifact": artifact},
        prompt_key=prompt.key,
        prompt_version=prompt.version,
        model=selected_model,
        request_payload={"prompt": rendered_prompt},
        response_payload=response_raw,
    )


def _cap_mobile_compare_summary(
    input_payload: dict[str, Any],
    trace_id: str | None,
    event_callback: Callable[[dict[str, Any]], None] | None = None,
) -> CapabilityExecutionResult:
    compare_context_json = _required_nonempty_str(input_payload, "compare_context_json")
    prompt = load_prompt("doubao.mobile_compare_summary")
    rendered_prompt = render_prompt(
        prompt.text,
        {
            "compare_context_json": compare_context_json,
        },
    )

    if _is_sample_mode():
        sample = {
            "decision": "hybrid",
            "headline": "当前产品可用，但更建议分场景与首推产品搭配使用。",
            "confidence": 0.62,
            "sections": {
                "keep_benefits": ["当前产品在清洁触感上更直接。"],
                "keep_watchouts": ["连续高频使用时可能放大你的不适点。"],
                "ingredient_order_diff": ["两款在前排关键成分的权重分布不同。"],
                "profile_fit_advice": ["按你填写的个人情况，建议主推款作为日常主力。"],
            },
        }
        artifact = _maybe_save_artifact(
            trace_id,
            "mobile_compare_summary",
            {"model": "sample", "prompt": rendered_prompt, "response": {"mode": "sample"}, "text": json.dumps(sample, ensure_ascii=False)},
        )
        return CapabilityExecutionResult(
            output={**sample, "analysis_text": json.dumps(sample, ensure_ascii=False), "model": "sample", "artifact": artifact},
            prompt_key=prompt.key,
            prompt_version=prompt.version,
            model="sample",
            request_payload={"prompt": rendered_prompt},
            response_payload={"mode": "sample"},
        )

    sdk, _, _, _ = _build_sdk_and_models()
    text_model = settings.doubao_pro_model or "doubao-seed-2-0-pro-260215"
    _emit(
        event_callback,
        {"type": "step", "stage": "mobile_compare_summary", "message": f"Calling model {text_model}."},
    )
    response_raw = _safe_sdk_call(
        lambda: sdk.chat_with_text(
            rendered_prompt,
            model=text_model,
            stream=event_callback is not None,
            **_build_doubao_stream_handlers(event_callback=event_callback, stage="mobile_compare_summary"),
        )
    )
    text = _extract_content(response_raw)
    parsed = _extract_json_object(text)
    normalized = _normalize_mobile_compare_summary_result(parsed)
    _emit(event_callback, {"type": "step", "stage": "mobile_compare_summary", "message": "Compare summary completed."})
    artifact = _maybe_save_artifact(
        trace_id,
        "mobile_compare_summary",
        {"model": text_model, "prompt": rendered_prompt, "response": response_raw, "text": text},
    )
    return CapabilityExecutionResult(
        output={**normalized, "analysis_text": text, "model": text_model, "artifact": artifact},
        prompt_key=prompt.key,
        prompt_version=prompt.version,
        model=text_model,
        request_payload={"prompt": rendered_prompt},
        response_payload=response_raw,
    )


def _cap_route_mapping(
    category: str,
    input_payload: dict[str, Any],
    trace_id: str | None,
    event_callback: Callable[[dict[str, Any]], None] | None = None,
) -> CapabilityExecutionResult:
    normalized_category = str(category or "").strip().lower()
    if normalized_category not in ROUTE_MAPPING_SUPPORTED_CATEGORIES:
        raise AIServiceError(
            code="route_mapping_category_unsupported",
            message=f"route mapping does not support category '{normalized_category}'.",
            http_status=400,
        )

    product_context_json = _required_nonempty_str(input_payload, "product_context_json")
    decision_table = _load_route_mapping_decision_table(normalized_category)
    decision_table_json = json.dumps(decision_table, ensure_ascii=False)
    prompt_key = f"doubao.route_mapping_{normalized_category}"
    prompt = load_prompt(prompt_key)
    rendered_prompt = render_prompt(
        prompt.text,
        {
            "decision_table_json": decision_table_json,
            "product_context_json": product_context_json,
        },
    )

    stage = f"route_mapping_{normalized_category}"
    if _is_sample_mode():
        route_candidates = decision_table.get("route_candidates") or []
        sample_scores = []
        for idx, item in enumerate(route_candidates):
            route_key = str(item.get("route_key") or "").strip()
            if not route_key:
                continue
            sample_scores.append(
                {
                    "route_key": route_key,
                    "confidence": max(0, 80 - idx * 8),
                    "reason": "sample mode",
                }
            )
        if len(sample_scores) < 2:
            raise AIServiceError(
                code="route_mapping_invalid_decision_table",
                message=f"decision table for '{normalized_category}' has insufficient route candidates.",
                http_status=500,
            )
        sample = {
            "category": normalized_category,
            "rules_version": str(decision_table.get("rules_version") or ""),
            "primary_route": sample_scores[0],
            "secondary_route": sample_scores[1],
            "route_scores": sample_scores,
            "evidence": {"positive": [], "counter": []},
            "confidence_reason": "sample mode output",
            "needs_review": False,
        }
        normalized = _normalize_route_mapping_result(normalized_category, decision_table, sample)
        artifact = _maybe_save_artifact(
            trace_id,
            stage,
            {
                "model": "sample",
                "prompt": rendered_prompt,
                "response": {"mode": "sample"},
                "text": json.dumps(sample, ensure_ascii=False),
            },
        )
        return CapabilityExecutionResult(
            output={**normalized, "analysis_text": json.dumps(sample, ensure_ascii=False), "model": "sample", "artifact": artifact},
            prompt_key=prompt.key,
            prompt_version=prompt.version,
            model="sample",
            request_payload={"prompt": rendered_prompt},
            response_payload={"mode": "sample"},
        )

    sdk, _, _, _ = _build_sdk_and_models()
    pro_model = settings.doubao_pro_model or "doubao-seed-2-0-pro-260215"
    _emit(
        event_callback,
        {"type": "step", "stage": stage, "message": f"Calling model {pro_model}."},
    )
    response_raw = _safe_sdk_call(
        lambda: sdk.chat_with_text(
            rendered_prompt,
            model=pro_model,
            stream=event_callback is not None,
            **_build_doubao_stream_handlers(event_callback=event_callback, stage=stage),
        )
    )
    text = _extract_content(response_raw)
    parsed = _extract_json_object(text)
    normalized = _normalize_route_mapping_result(normalized_category, decision_table, parsed)
    _emit(event_callback, {"type": "step", "stage": stage, "message": "Route mapping completed."})
    artifact = _maybe_save_artifact(
        trace_id,
        stage,
        {"model": pro_model, "prompt": rendered_prompt, "response": response_raw, "text": text},
    )
    return CapabilityExecutionResult(
        output={**normalized, "analysis_text": text, "model": pro_model, "artifact": artifact},
        prompt_key=prompt.key,
        prompt_version=prompt.version,
        model=pro_model,
        request_payload={"prompt": rendered_prompt},
        response_payload=response_raw,
    )


def _cap_product_profile(
    category: str,
    input_payload: dict[str, Any],
    trace_id: str | None,
    event_callback: Callable[[dict[str, Any]], None] | None = None,
) -> CapabilityExecutionResult:
    normalized_category = str(category or "").strip().lower()
    if normalized_category not in PRODUCT_PROFILE_SUPPORTED_CATEGORIES:
        raise AIServiceError(
            code="product_profile_category_unsupported",
            message=f"product profile does not support category '{normalized_category}'.",
            http_status=400,
        )

    context_json = _required_nonempty_str(input_payload, "product_analysis_context_json")
    try:
        context_payload = json.loads(context_json)
    except json.JSONDecodeError as e:
        raise AIServiceError(
            code="invalid_input",
            message="product_analysis_context_json must be valid JSON object text.",
            http_status=400,
        ) from e
    if not isinstance(context_payload, dict):
        raise AIServiceError(
            code="invalid_input",
            message="product_analysis_context_json must decode to a JSON object.",
            http_status=400,
        )

    try:
        validated_context = ProductAnalysisContextPayload.model_validate(context_payload)
    except Exception as e:
        raise AIServiceError(
            code="invalid_input",
            message=f"product analysis context invalid: {e}",
            http_status=400,
        ) from e

    if validated_context.product.category != normalized_category:
        raise AIServiceError(
            code="invalid_input",
            message=(
                f"product analysis context category mismatch: expected '{normalized_category}', "
                f"got '{validated_context.product.category}'."
            ),
            http_status=400,
        )

    normalized_context_json = json.dumps(validated_context.model_dump(), ensure_ascii=False)
    prompt_key = f"doubao.product_profile_{normalized_category}"
    prompt = load_prompt(prompt_key)
    rendered_prompt = render_prompt(
        prompt.text,
        {
            "product_analysis_context_json": normalized_context_json,
        },
    )

    stage = f"product_profile_{normalized_category}"
    if _is_sample_mode():
        sample = _build_sample_product_profile(normalized_category, validated_context)
        normalized = _normalize_product_profile_result(normalized_category, sample)
        artifact = _maybe_save_artifact(
            trace_id,
            stage,
            {
                "model": "sample",
                "prompt": rendered_prompt,
                "response": {"mode": "sample"},
                "text": json.dumps(sample, ensure_ascii=False),
            },
        )
        return CapabilityExecutionResult(
            output={**normalized, "model": "sample", "artifact": artifact},
            prompt_key=prompt.key,
            prompt_version=prompt.version,
            model="sample",
            request_payload={"prompt": rendered_prompt},
            response_payload={"mode": "sample"},
        )

    sdk, _, _, _ = _build_sdk_and_models()
    pro_model = settings.doubao_pro_model or "doubao-seed-2-0-pro-260215"
    _emit(
        event_callback,
        {"type": "step", "stage": stage, "message": f"Calling model {pro_model}."},
    )
    response_raw = _safe_sdk_call(
        lambda: sdk.chat_with_text(
            rendered_prompt,
            model=pro_model,
            stream=event_callback is not None,
            **_build_doubao_stream_handlers(event_callback=event_callback, stage=stage),
        )
    )
    text = _extract_content(response_raw)
    parsed = _extract_json_object(text)
    normalized = _normalize_product_profile_result(normalized_category, parsed)
    _emit(event_callback, {"type": "step", "stage": stage, "message": "Product profile completed."})
    artifact = _maybe_save_artifact(
        trace_id,
        stage,
        {"model": pro_model, "prompt": rendered_prompt, "response": response_raw, "text": text},
    )
    return CapabilityExecutionResult(
        output={**normalized, "model": pro_model, "artifact": artifact},
        prompt_key=prompt.key,
        prompt_version=prompt.version,
        model=pro_model,
        request_payload={"prompt": rendered_prompt},
        response_payload=response_raw,
    )


def _cap_mobile_selection_result(
    category: str,
    input_payload: dict[str, Any],
    trace_id: str | None,
    event_callback: Callable[[dict[str, Any]], None] | None = None,
) -> CapabilityExecutionResult:
    normalized_category = str(category or "").strip().lower()
    if normalized_category not in PRODUCT_PROFILE_SUPPORTED_CATEGORIES:
        raise AIServiceError(
            code="selection_result_category_unsupported",
            message=f"selection result does not support category '{normalized_category}'.",
            http_status=400,
        )

    context_json = _required_nonempty_str(input_payload, "selection_result_context_json")
    try:
        context_payload = json.loads(context_json)
    except json.JSONDecodeError as e:
        raise AIServiceError(
            code="invalid_input",
            message="selection_result_context_json must be valid JSON object text.",
            http_status=400,
        ) from e
    if not isinstance(context_payload, dict):
        raise AIServiceError(
            code="invalid_input",
            message="selection_result_context_json must decode to a JSON object.",
            http_status=400,
        )

    try:
        validated_context = MobileSelectionResultContextPayload.model_validate(context_payload)
    except Exception as e:
        raise AIServiceError(
            code="invalid_input",
            message=f"selection result context invalid: {e}",
            http_status=400,
        ) from e

    if validated_context.category != normalized_category:
        raise AIServiceError(
            code="invalid_input",
            message=(
                f"selection result context category mismatch: expected '{normalized_category}', "
                f"got '{validated_context.category}'."
            ),
            http_status=400,
        )

    normalized_context_json = json.dumps(validated_context.model_dump(mode="json"), ensure_ascii=False)
    prompt_key = f"doubao.mobile_selection_result_{normalized_category}"
    prompt = load_prompt(prompt_key)
    rendered_prompt = render_prompt(
        prompt.text,
        {
            "selection_result_context_json": normalized_context_json,
        },
    )

    stage = f"mobile_selection_result_{normalized_category}"
    if _is_sample_mode():
        sample = _build_sample_mobile_selection_result(validated_context)
        normalized = _normalize_mobile_selection_result_content(sample)
        artifact = _maybe_save_artifact(
            trace_id,
            stage,
            {
                "model": "sample",
                "prompt": rendered_prompt,
                "response": {"mode": "sample"},
                "text": json.dumps(sample, ensure_ascii=False),
            },
        )
        return CapabilityExecutionResult(
            output={**normalized, "model": "sample", "artifact": artifact},
            prompt_key=prompt.key,
            prompt_version=prompt.version,
            model="sample",
            request_payload={"prompt": rendered_prompt},
            response_payload={"mode": "sample"},
        )

    sdk, _, _, _ = _build_sdk_and_models()
    pro_model = settings.doubao_pro_model or "doubao-seed-2-0-pro-260215"
    _emit(
        event_callback,
        {"type": "step", "stage": stage, "message": f"Calling model {pro_model}."},
    )
    response_raw = _safe_sdk_call(
        lambda: sdk.chat_with_text(
            rendered_prompt,
            model=pro_model,
            stream=event_callback is not None,
            **_build_doubao_stream_handlers(event_callback=event_callback, stage=stage),
        )
    )
    text = _extract_content(response_raw)
    parsed = _extract_json_object(text)
    normalized = _normalize_mobile_selection_result_content(parsed)
    _emit(event_callback, {"type": "step", "stage": stage, "message": "Selection result content completed."})
    artifact = _maybe_save_artifact(
        trace_id,
        stage,
        {"model": pro_model, "prompt": rendered_prompt, "response": response_raw, "text": text},
    )
    return CapabilityExecutionResult(
        output={**normalized, "model": pro_model, "artifact": artifact},
        prompt_key=prompt.key,
        prompt_version=prompt.version,
        model=pro_model,
        request_payload={"prompt": rendered_prompt},
        response_payload=response_raw,
    )


def _normalize_stage1_image_paths(input_payload: dict[str, Any]) -> list[str]:
    raw = input_payload.get("image_paths")
    out: list[str] = []
    if isinstance(raw, list):
        for item in raw:
            text = str(item or "").strip()
            if text:
                out.append(text)
    if not out:
        out = [_required_str(input_payload, "image_path")]
    if len(out) > 2:
        raise AIServiceError(
            code="invalid_input",
            message="stage1 image_paths supports at most 2 images.",
            http_status=400,
        )
    if not out:
        raise AIServiceError(
            code="invalid_input",
            message="stage1 requires image_path or image_paths.",
            http_status=400,
        )
    return out


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
        max_retries=settings.doubao_max_retries,
        retry_backoff_seconds=settings.doubao_retry_backoff_seconds,
    )
    return sdk, vision_model, struct_model, advanced_text_model


def _normalize_model_tier(value: Any, *, field_name: str = "model_tier") -> str | None:
    text = str(value or "").strip().lower()
    if not text:
        return None
    if text not in MODEL_TIER_VALUES:
        raise AIServiceError(
            code="invalid_model_tier",
            message=f"{field_name} must be one of: mini, lite, pro.",
            http_status=400,
        )
    return text


def _resolve_model_by_tier(
    *,
    tier: str | None,
    default_model: str,
    mini_model: str,
    lite_model: str,
    pro_model: str,
) -> str:
    if tier == "mini":
        return mini_model
    if tier == "lite":
        return lite_model
    if tier == "pro":
        return pro_model
    return default_model


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
    lower_path = image_rel_path.lower()
    if not mime and lower_path.endswith(".heic"):
        mime = "image/heic"
    if not mime and lower_path.endswith(".heif"):
        mime = "image/heif"
    mime = mime or "image/jpeg"
    b64 = base64.b64encode(data).decode("ascii")
    return f"data:{mime};base64,{b64}"


def _sample_product_doc() -> dict[str, Any]:
    sample = Path(__file__).resolve().parents[2] / "sample_data" / "product_sample.json"
    doc = json.loads(sample.read_text(encoding="utf-8"))
    return _inject_sample_stage2_ingredient_order_fields(doc)


def _inject_sample_stage2_ingredient_order_fields(doc: dict[str, Any]) -> dict[str, Any]:
    if not isinstance(doc, dict):
        return doc
    ingredients = doc.get("ingredients")
    if not isinstance(ingredients, list):
        return doc

    major_cutoff = max(1, len(ingredients) // 2)
    for idx, item in enumerate(ingredients, start=1):
        if not isinstance(item, dict):
            continue
        item["rank"] = idx
        abundance = str(item.get("abundance_level") or "").strip().lower()
        if abundance not in {"major", "trace"}:
            item["abundance_level"] = "major" if idx <= major_cutoff else "trace"
        try:
            confidence = int(item.get("order_confidence"))
        except Exception:
            confidence = -1
        if confidence < 0 or confidence > 100:
            item["order_confidence"] = 70
    return doc


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


def _normalize_dedup_group_result(
    anchor_id: str,
    candidate_products: list[dict[str, Any]],
    payload: dict[str, Any],
) -> dict[str, Any]:
    allowed_ids = {anchor_id}
    for item in candidate_products:
        pid = str(item.get("id") or "").strip()
        if pid:
            allowed_ids.add(pid)

    keep_id = str(payload.get("keep_id") or "").strip()
    if not keep_id:
        raise AIServiceError(code="dedup_group_invalid", message="dedup group output missing keep_id.", http_status=422)
    if keep_id not in allowed_ids:
        raise AIServiceError(
            code="dedup_group_invalid",
            message=f"dedup group keep_id '{keep_id}' is not in candidate set.",
            http_status=422,
        )

    duplicates_raw = payload.get("duplicates")
    if not isinstance(duplicates_raw, list):
        raise AIServiceError(code="dedup_group_invalid", message="dedup group duplicates must be a list.", http_status=422)

    duplicates: list[dict[str, Any]] = []
    seen = set()
    for item in duplicates_raw:
        if not isinstance(item, dict):
            continue
        pid = str(item.get("id") or "").strip()
        if not pid or pid == keep_id or pid not in allowed_ids or pid in seen:
            continue
        seen.add(pid)
        try:
            confidence = int(item.get("confidence"))
        except Exception:
            confidence = 0
        confidence = max(0, min(100, confidence))
        reason = str(item.get("reason") or "").strip()
        duplicates.append({"id": pid, "confidence": confidence, "reason": reason})

    reason = str(payload.get("reason") or "").strip()
    return {
        "keep_id": keep_id,
        "duplicates": duplicates,
        "reason": reason,
    }


def _normalize_mobile_compare_summary_result(payload: dict[str, Any]) -> dict[str, Any]:
    if not isinstance(payload, dict):
        raise AIServiceError(
            code="mobile_compare_summary_invalid",
            message="mobile compare summary output must be a JSON object.",
            http_status=422,
        )

    decision = str(payload.get("decision") or "").strip().lower()
    if decision not in {"keep", "switch", "hybrid"}:
        raise AIServiceError(
            code="mobile_compare_summary_invalid",
            message="mobile compare summary decision must be one of keep/switch/hybrid.",
            http_status=422,
        )

    headline = str(payload.get("headline") or "").strip()
    if not headline:
        raise AIServiceError(
            code="mobile_compare_summary_invalid",
            message="mobile compare summary headline is required.",
            http_status=422,
        )

    raw_confidence = payload.get("confidence")
    try:
        confidence = float(raw_confidence)
    except Exception:
        confidence = 0.0
    confidence = max(0.0, min(1.0, confidence))

    sections_raw = payload.get("sections")
    if not isinstance(sections_raw, dict):
        raise AIServiceError(
            code="mobile_compare_summary_invalid",
            message="mobile compare summary sections must be an object.",
            http_status=422,
        )

    def normalize_items(key: str) -> list[str]:
        value = sections_raw.get(key)
        if not isinstance(value, list):
            raise AIServiceError(
                code="mobile_compare_summary_invalid",
                message=f"mobile compare summary sections.{key} must be a list.",
                http_status=422,
            )
        out: list[str] = []
        for item in value:
            text = str(item or "").strip()
            if text:
                out.append(text)
        if not out:
            raise AIServiceError(
                code="mobile_compare_summary_invalid",
                message=f"mobile compare summary sections.{key} cannot be empty.",
                http_status=422,
            )
        return out[:6]

    sections = {
        "keep_benefits": normalize_items("keep_benefits"),
        "keep_watchouts": normalize_items("keep_watchouts"),
        "ingredient_order_diff": normalize_items("ingredient_order_diff"),
        "profile_fit_advice": normalize_items("profile_fit_advice"),
    }

    return {
        "decision": decision,
        "headline": headline,
        "confidence": confidence,
        "sections": sections,
    }


def _product_profile_result_model(category: str):
    normalized_category = str(category or "").strip().lower()
    models = {
        "shampoo": ShampooProductAnalysisResult,
        "bodywash": BodywashProductAnalysisResult,
        "conditioner": ConditionerProductAnalysisResult,
        "lotion": LotionProductAnalysisResult,
        "cleanser": CleanserProductAnalysisResult,
    }
    model = models.get(normalized_category)
    if model is None:
        raise AIServiceError(
            code="product_profile_category_unsupported",
            message=f"product profile does not support category '{normalized_category}'.",
            http_status=400,
        )
    return model


def _build_sample_product_profile(category: str, context: ProductAnalysisContextPayload) -> dict[str, Any]:
    route_key = str(context.route_mapping.primary_route_key or "").strip()
    route_title = str(context.route_mapping.primary_route_title or "").strip()
    diagnostics_fields: dict[str, list[str]] = {
        "shampoo": [
            "cleanse_intensity",
            "oil_control_support",
            "dandruff_itch_support",
            "scalp_soothing_support",
            "hair_strengthening_support",
            "moisture_balance_support",
            "daily_use_friendliness",
            "residue_weight",
        ],
        "bodywash": [
            "cleanse_intensity",
            "barrier_repair_support",
            "body_acne_support",
            "keratin_softening_support",
            "brightening_support",
            "fragrance_presence",
            "rinse_afterfeel_nourishment",
        ],
        "conditioner": [
            "detangling_support",
            "anti_frizz_support",
            "airy_light_support",
            "repair_density",
            "color_lock_support",
            "basic_hydration_support",
            "fine_hair_burden",
        ],
        "lotion": [
            "light_hydration_support",
            "heavy_repair_support",
            "body_acne_support",
            "aha_renew_support",
            "brightening_support",
            "fragrance_presence",
            "occlusive_weight",
        ],
        "cleanser": [
            "apg_support",
            "amino_support",
            "soap_blend_strength",
            "bha_support",
            "clay_support",
            "enzyme_support",
            "barrier_friendliness",
            "makeup_residue_support",
        ],
    }
    schema_versions = {
        "shampoo": "product_profile_shampoo.v1",
        "bodywash": "product_profile_bodywash.v1",
        "conditioner": "product_profile_conditioner.v1",
        "lotion": "product_profile_lotion.v1",
        "cleanser": "product_profile_cleanser.v1",
    }
    fields = diagnostics_fields.get(category, [])
    diagnostics = {
        key: {
            "score": 2,
            "reason": "sample mode: using conservative placeholder evidence.",
        }
        for key in fields
    }
    return {
        "schema_version": schema_versions[category],
        "category": category,
        "route_key": route_key,
        "route_title": route_title,
        "headline": f"Sample {category} profile",
        "positioning_summary": "sample mode output generated from validated product analysis context.",
        "subtype_fit_verdict": "fit_with_limits",
        "subtype_fit_reason": "sample mode output with conservative confidence.",
        "best_for": ["sample mode suitable audience"],
        "not_ideal_for": ["sample mode unsuitable audience"],
        "usage_tips": ["sample mode usage tip"],
        "watchouts": ["sample mode watchout"],
        "key_ingredients": [],
        "evidence": {
            "positive": [],
            "counter": [],
            "missing_codes": ["summary_signal_too_weak"],
        },
        "diagnostics": diagnostics,
        "confidence": 50,
        "confidence_reason": "sample mode output only.",
        "needs_review": True,
    }


def _normalize_product_profile_result(category: str, payload: dict[str, Any]) -> dict[str, Any]:
    if not isinstance(payload, dict):
        raise AIServiceError(
            code="product_profile_invalid",
            message="product profile output must be a JSON object.",
            http_status=422,
        )

    model = _product_profile_result_model(category)
    try:
        normalized = model.model_validate(payload)
    except Exception as e:
        raise AIServiceError(
            code="product_profile_invalid",
            message=f"product profile output invalid: {e}",
            http_status=422,
        ) from e
    return normalized.model_dump()


def _build_sample_mobile_selection_result(context: MobileSelectionResultContextPayload) -> dict[str, Any]:
    route_title = str(context.route.title or "").strip() or "当前路线"
    product_name = str(context.recommended_product.name or "").strip() or "当前主推"
    product_title = str(context.recommended_product.brand or "").strip()
    if product_title and product_name:
        product_title = f"{product_title} {product_name}"
    elif product_name:
        product_title = product_name
    else:
        product_title = "当前主推产品"
    evidence_note = "产品分析暂缺，当前先基于题目和矩阵做保守解释。"
    if context.product_analysis_summary is not None:
        evidence_note = "产品分析已接入，当前可用题目、矩阵和产品摘要做解释承接。"
    return {
        "schema_version": "selection_result_content.v2",
        "renderer_variant": "selection_result_default",
        "micro_summary": f"{route_title}先稳住",
        "share_copy": {
            "title": f"你的本命路线是{route_title}",
            "subtitle": f"我现在更适合先走{route_title}这条线",
            "caption": f"予选先把我现在的情况讲明白，再把当前更适合的方向和 {product_title} 这类承接方案接上了。",
        },
        "display_order": ["hero", "situation", "attention", "pitfalls", "evidence", "product_bridge", "ctas"],
        "blocks": [
            {
                "id": "hero",
                "kind": "hero",
                "version": "v1",
                "payload": {
                    "eyebrow": "予选先帮你看懂自己",
                    "title": f"你当前更偏向{route_title}这条日常护理主线",
                    "subtitle": f"系统先根据你的题目选择和路线分差判断当前最该优先的护理方向，再用主推产品把这个方向接住。",
                    "items": [
                        "当前结果先回答你现在更像什么情况，再承接产品方向。",
                        "系统不会只堆商品，而是先讲清楚为什么会落到这条路。",
                        "后续若矩阵或主推变化，这类场景内容也会随之重建更新。",
                    ],
                },
            },
            {
                "id": "situation",
                "kind": "explanation",
                "version": "v1",
                "payload": {
                    "title": "你现在更像什么情况",
                    "subtitle": f"从当前答案组合看，你更接近 {route_title} 这条主线，说明系统认为这才是你当下更需要先处理的矛盾。",
                    "items": [
                        f"当前路线先锚定到 {route_title}，不是随机给产品。",
                        "系统会结合 top1 与 top2 分差，避免只看单题表面现象。",
                        "如果有 veto，说明某些看起来像的方向其实被明确排除了。",
                    ],
                    "note": "sample mode 下这里只输出保守占位内容，线上应由正式模型结果覆盖。",
                },
            },
            {
                "id": "attention",
                "kind": "strategy",
                "version": "v1",
                "payload": {
                    "title": "你当前最该抓住什么",
                    "subtitle": "先把当前最关键的护理优先级抓住，再谈额外诉求，会比一上来追求面面俱到更稳。",
                    "items": [
                        "先沿着当前主线解决最核心矛盾，少被次要诉求带偏。",
                        "题目收敛结果代表的是日常护理优先级，不是一次性终局判断。",
                        "当前主推只是先承接这条方向，不代表你只有这一款能用。",
                    ],
                    "note": evidence_note,
                },
            },
            {
                "id": "pitfalls",
                "kind": "warning",
                "version": "v1",
                "payload": {
                    "title": "你现在最该少踩的坑",
                    "subtitle": "很多人会因为只盯一个表面症状或一句营销话术，就把自己带到并不适合的方向上。",
                    "items": [
                        "不要把看起来也像的次要问题，误当成当前真正要先处理的问题。",
                        "不要把产品宣传词当结论，还是要回到路线和证据本身。",
                        "不要把当前推荐理解成万能方案，它只是更贴近你当前状态。",
                    ],
                    "note": "这一步的重点是少踩坑，而不是把所有需求一次性叠满。",
                },
            },
            {
                "id": "evidence",
                "kind": "explanation",
                "version": "v1",
                "payload": {
                    "title": "为什么系统这样判断",
                    "subtitle": "系统会同时看答案、路线得分、top2 差距和 veto 屏蔽，再决定为什么当前路线更站得住。",
                    "items": [
                        "不是只凭单题命中，而是看整套答案如何把路线分数推高或压低。",
                        "top2 对比能帮助解释为什么相近路线没有赢过当前主线。",
                        "被 veto 的路线会被明确挡掉，避免结果页讲得含糊不清。",
                    ],
                    "note": evidence_note,
                },
            },
            {
                "id": "product_bridge",
                "kind": "strategy",
                "version": "v1",
                "payload": {
                    "title": "为什么先给你这类或这款",
                    "subtitle": f"当前主推会优先承接 {route_title} 这条路线，目标是让产品服务于你的情况解释，而不是反过来用产品定义你。",
                    "items": [
                        f"当前主推先用 {product_title} 接住这条路线的核心诉求。",
                        "如果产品分析证据不足，结果页也必须明确标注，而不是假装很完整。",
                        "后续如果主推变化或证据更新，同一场景会按最新依赖重建内容。",
                    ],
                    "note": "予选的优先级是适配度，不是把更多商品堆给你。",
                },
            },
        ],
        "ctas": [
            {"id": "open_product", "label": "查看产品详情", "action": "product", "href": "", "payload": {}},
            {"id": "open_wiki", "label": "查看成分百科", "action": "wiki", "href": "", "payload": {}},
            {"id": "restart", "label": "重新判断一次", "action": "restart", "href": "", "payload": {}},
        ],
    }


def _normalize_mobile_selection_result_content(payload: dict[str, Any]) -> dict[str, Any]:
    if not isinstance(payload, dict):
        raise AIServiceError(
            code="selection_result_invalid",
            message="selection result output must be a JSON object.",
            http_status=422,
        )

    try:
        normalized = MobileSelectionResultAIContent.model_validate(payload)
    except Exception as e:
        raise AIServiceError(
            code="selection_result_invalid",
            message=f"selection result output invalid: {e}",
            http_status=422,
        ) from e

    expected_display_order = ["hero", "situation", "attention", "pitfalls", "evidence", "product_bridge", "ctas"]
    if list(normalized.display_order) != expected_display_order:
        raise AIServiceError(
            code="selection_result_invalid",
            message=f"display_order must equal {expected_display_order}.",
            http_status=422,
        )

    _ensure_text_length("micro_summary", normalized.micro_summary, minimum=6, maximum=12)
    _ensure_text_length("share_copy.title", normalized.share_copy.title, minimum=10, maximum=18)
    _ensure_text_length("share_copy.subtitle", normalized.share_copy.subtitle, minimum=12, maximum=28)
    _ensure_text_length("share_copy.caption", normalized.share_copy.caption, minimum=24, maximum=56)

    expected_blocks = [
        ("hero", "hero"),
        ("situation", "explanation"),
        ("attention", "strategy"),
        ("pitfalls", "warning"),
        ("evidence", "explanation"),
        ("product_bridge", "strategy"),
    ]
    if len(normalized.blocks) != len(expected_blocks):
        raise AIServiceError(
            code="selection_result_invalid",
            message=f"blocks must contain exactly {len(expected_blocks)} items.",
            http_status=422,
        )
    for idx, (expected_id, expected_kind) in enumerate(expected_blocks):
        block = normalized.blocks[idx]
        if block.id != expected_id or block.kind != expected_kind or block.version != "v1":
            raise AIServiceError(
                code="selection_result_invalid",
                message=(
                    f"blocks[{idx}] must be id='{expected_id}', kind='{expected_kind}', version='v1'; "
                    f"got id='{block.id}', kind='{block.kind}', version='{block.version}'."
                ),
                http_status=422,
            )
        _validate_selection_result_block_payload(block_id=expected_id, payload=block.payload)

    expected_ctas = [
        ("open_product", "product"),
        ("open_wiki", "wiki"),
        ("restart", "restart"),
    ]
    if len(normalized.ctas) != len(expected_ctas):
        raise AIServiceError(
            code="selection_result_invalid",
            message=f"ctas must contain exactly {len(expected_ctas)} items.",
            http_status=422,
        )
    for idx, (expected_id, expected_action) in enumerate(expected_ctas):
        cta = normalized.ctas[idx]
        if cta.id != expected_id or cta.action != expected_action:
            raise AIServiceError(
                code="selection_result_invalid",
                message=(
                    f"ctas[{idx}] must be id='{expected_id}', action='{expected_action}'; "
                    f"got id='{cta.id}', action='{cta.action}'."
                ),
                http_status=422,
            )
        _ensure_nonempty_string(f"ctas[{idx}].label", cta.label)
        if not isinstance(cta.href, str):
            raise AIServiceError(
                code="selection_result_invalid",
                message=f"ctas[{idx}].href must be a string.",
                http_status=422,
            )
        if not isinstance(cta.payload, dict):
            raise AIServiceError(
                code="selection_result_invalid",
                message=f"ctas[{idx}].payload must be a JSON object.",
                http_status=422,
            )

    return normalized.model_dump(mode="json")


def _validate_selection_result_block_payload(*, block_id: str, payload: dict[str, Any]) -> None:
    if not isinstance(payload, dict):
        raise AIServiceError(
            code="selection_result_invalid",
            message=f"{block_id}.payload must be a JSON object.",
            http_status=422,
        )

    if block_id == "hero":
        required_keys = {"eyebrow", "title", "subtitle"}
        allowed_keys = {"eyebrow", "title", "subtitle", "items"}
        payload_keys = set(payload.keys())
        if not required_keys.issubset(payload_keys) or not payload_keys.issubset(allowed_keys):
            raise AIServiceError(
                code="selection_result_invalid",
                message=f"{block_id}.payload keys must include {sorted(required_keys)} and only use {sorted(allowed_keys)}.",
                http_status=422,
            )
        _ensure_nonempty_string(f"{block_id}.payload.eyebrow", payload.get("eyebrow"))
        _ensure_text_length(f"{block_id}.payload.title", payload.get("title"), minimum=12, maximum=32)
        _ensure_text_length(f"{block_id}.payload.subtitle", payload.get("subtitle"), minimum=24, maximum=100)
        if "items" in payload:
            _ensure_string_list(f"{block_id}.payload.items", payload.get("items"), minimum=0, maximum=5, item_min=12, item_max=48)
        return

    expected_keys = {"title", "subtitle", "items", "note"}
    if set(payload.keys()) != expected_keys:
        raise AIServiceError(
            code="selection_result_invalid",
            message=f"{block_id}.payload keys must equal {sorted(expected_keys)}.",
            http_status=422,
        )
    _ensure_text_length(f"{block_id}.payload.title", payload.get("title"), minimum=8, maximum=20)
    _ensure_text_length(f"{block_id}.payload.subtitle", payload.get("subtitle"), minimum=30, maximum=90)
    _ensure_string_list(f"{block_id}.payload.items", payload.get("items"), minimum=3, maximum=5, item_min=16, item_max=48)
    _ensure_text_length(f"{block_id}.payload.note", payload.get("note"), minimum=20, maximum=80)


def _ensure_nonempty_string(field_name: str, value: Any) -> str:
    if not isinstance(value, str):
        raise AIServiceError(
            code="selection_result_invalid",
            message=f"{field_name} must be a string.",
            http_status=422,
        )
    text = value.strip()
    if not text:
        raise AIServiceError(
            code="selection_result_invalid",
            message=f"{field_name} cannot be empty.",
            http_status=422,
        )
    return text


def _ensure_text_length(field_name: str, value: Any, *, minimum: int, maximum: int) -> str:
    text = _ensure_nonempty_string(field_name, value)
    size = len(text)
    if size < minimum or size > maximum:
        raise AIServiceError(
            code="selection_result_invalid",
            message=f"{field_name} length must be within [{minimum}, {maximum}], got {size}.",
            http_status=422,
        )
    return text


def _ensure_string_list(
    field_name: str,
    value: Any,
    *,
    minimum: int,
    maximum: int,
    item_min: int,
    item_max: int,
) -> list[str]:
    if not isinstance(value, list):
        raise AIServiceError(
            code="selection_result_invalid",
            message=f"{field_name} must be an array.",
            http_status=422,
        )
    if len(value) < minimum or len(value) > maximum:
        raise AIServiceError(
            code="selection_result_invalid",
            message=f"{field_name} length must be within [{minimum}, {maximum}], got {len(value)}.",
            http_status=422,
        )
    out: list[str] = []
    seen: set[str] = set()
    for idx, item in enumerate(value):
        text = _ensure_text_length(f"{field_name}[{idx}]", item, minimum=item_min, maximum=item_max)
        if text in seen:
            raise AIServiceError(
                code="selection_result_invalid",
                message=f"{field_name} contains duplicate item '{text}'.",
                http_status=422,
            )
        seen.add(text)
        out.append(text)
    return out


def _load_route_mapping_decision_table(category: str) -> dict[str, Any]:
    normalized_category = str(category or "").strip().lower()
    if normalized_category not in ROUTE_MAPPING_SUPPORTED_CATEGORIES:
        raise AIServiceError(
            code="route_mapping_category_unsupported",
            message=f"route mapping does not support category '{normalized_category}'.",
            http_status=400,
        )
    rel = f"{normalized_category}/v{MOBILE_RULES_VERSION}.json"
    path = Path(__file__).resolve().parent / "decision_tables" / rel
    if not path.exists():
        raise AIServiceError(
            code="route_mapping_decision_table_missing",
            message=f"route mapping decision table missing for category '{normalized_category}': {path.name}",
            http_status=500,
        )
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except Exception as e:
        raise AIServiceError(
            code="route_mapping_decision_table_invalid",
            message=f"route mapping decision table invalid for category '{normalized_category}': {e}",
            http_status=500,
        ) from e

    if not isinstance(payload, dict):
        raise AIServiceError(
            code="route_mapping_decision_table_invalid",
            message=f"route mapping decision table must be a JSON object for category '{normalized_category}'.",
            http_status=500,
        )
    route_candidates = payload.get("route_candidates")
    if not isinstance(route_candidates, list) or not route_candidates:
        raise AIServiceError(
            code="route_mapping_decision_table_invalid",
            message=f"route mapping decision table route_candidates missing for category '{normalized_category}'.",
            http_status=500,
        )
    table_category = str(payload.get("category") or "").strip().lower()
    if table_category != normalized_category:
        raise AIServiceError(
            code="route_mapping_decision_table_invalid",
            message=(
                "route mapping decision table category mismatch: "
                f"expected '{normalized_category}', got '{table_category or '-'}'."
            ),
            http_status=500,
        )
    rules_version = str(payload.get("rules_version") or "").strip()
    if rules_version != MOBILE_RULES_VERSION:
        raise AIServiceError(
            code="route_mapping_decision_table_invalid",
            message=(
                "route mapping decision table rules_version mismatch: "
                f"expected '{MOBILE_RULES_VERSION}', got '{rules_version or '-'}'."
            ),
            http_status=500,
        )
    return payload


def _normalize_route_mapping_result(
    category: str,
    decision_table: dict[str, Any],
    payload: dict[str, Any],
) -> dict[str, Any]:
    if not isinstance(payload, dict):
        raise AIServiceError(
            code="route_mapping_invalid",
            message="route mapping output must be a JSON object.",
            http_status=422,
        )

    expected_category = str(category or "").strip().lower()
    output_category = str(payload.get("category") or expected_category).strip().lower()
    if output_category != expected_category:
        raise AIServiceError(
            code="route_mapping_invalid",
            message=f"route mapping category mismatch: expected '{expected_category}', got '{output_category}'.",
            http_status=422,
        )

    expected_rules_version = str(decision_table.get("rules_version") or "").strip()
    output_rules_version = str(payload.get("rules_version") or "").strip()
    if output_rules_version != expected_rules_version:
        raise AIServiceError(
            code="route_mapping_invalid",
            message=(
                "route mapping rules_version mismatch: "
                f"expected '{expected_rules_version}', got '{output_rules_version}'."
            ),
            http_status=422,
        )

    raw_candidates = decision_table.get("route_candidates") or []
    if not isinstance(raw_candidates, list) or not raw_candidates:
        raise AIServiceError(
            code="route_mapping_invalid",
            message="route mapping decision table has no route_candidates.",
            http_status=500,
        )
    candidate_map: dict[str, str] = {}
    for item in raw_candidates:
        if not isinstance(item, dict):
            continue
        key = str(item.get("route_key") or "").strip()
        title = str(item.get("route_title") or "").strip()
        if key and title:
            candidate_map[key] = title
    if not candidate_map:
        raise AIServiceError(
            code="route_mapping_invalid",
            message="route mapping decision table route_candidates invalid.",
            http_status=500,
        )

    raw_scores = payload.get("route_scores")
    if not isinstance(raw_scores, list):
        raise AIServiceError(
            code="route_mapping_invalid",
            message="route mapping route_scores must be a list.",
            http_status=422,
        )

    seen_keys: set[str] = set()
    scores: list[dict[str, Any]] = []
    for item in raw_scores:
        if not isinstance(item, dict):
            continue
        route_key = str(item.get("route_key") or "").strip()
        if route_key not in candidate_map:
            raise AIServiceError(
                code="route_mapping_invalid",
                message=f"route mapping route_scores contains unsupported route_key '{route_key}'.",
                http_status=422,
            )
        if route_key in seen_keys:
            raise AIServiceError(
                code="route_mapping_invalid",
                message=f"route mapping route_scores has duplicate route_key '{route_key}'.",
                http_status=422,
            )
        seen_keys.add(route_key)
        try:
            confidence = int(item.get("confidence"))
        except Exception:
            confidence = -1
        if confidence < 0 or confidence > 100:
            raise AIServiceError(
                code="route_mapping_invalid",
                message=f"route mapping route_scores[{route_key}] confidence must be 0-100 integer.",
                http_status=422,
            )
        reason = str(item.get("reason") or "").strip()
        scores.append(
            {
                "route_key": route_key,
                "route_title": candidate_map[route_key],
                "confidence": confidence,
                "reason": reason,
            }
        )

    missing = sorted(set(candidate_map.keys()) - seen_keys)
    if missing:
        raise AIServiceError(
            code="route_mapping_invalid",
            message=f"route mapping route_scores missing candidates: {', '.join(missing)}.",
            http_status=422,
        )

    # Stable order: highest confidence first, then route key.
    scores.sort(key=lambda item: (-int(item["confidence"]), str(item["route_key"])))
    primary_expected = scores[0]
    secondary_expected = scores[1] if len(scores) > 1 else scores[0]

    raw_primary = payload.get("primary_route")
    if not isinstance(raw_primary, dict):
        raise AIServiceError(
            code="route_mapping_invalid",
            message="route mapping primary_route is required.",
            http_status=422,
        )
    raw_secondary = payload.get("secondary_route")
    if not isinstance(raw_secondary, dict):
        raise AIServiceError(
            code="route_mapping_invalid",
            message="route mapping secondary_route is required.",
            http_status=422,
        )

    primary_key = str(raw_primary.get("route_key") or "").strip()
    secondary_key = str(raw_secondary.get("route_key") or "").strip()
    if primary_key != str(primary_expected["route_key"]):
        raise AIServiceError(
            code="route_mapping_invalid",
            message=(
                "route mapping primary_route must match highest-confidence route: "
                f"expected '{primary_expected['route_key']}', got '{primary_key}'."
            ),
            http_status=422,
        )
    if secondary_key != str(secondary_expected["route_key"]):
        raise AIServiceError(
            code="route_mapping_invalid",
            message=(
                "route mapping secondary_route must match second-highest route: "
                f"expected '{secondary_expected['route_key']}', got '{secondary_key}'."
            ),
            http_status=422,
        )

    confidence_reason = str(payload.get("confidence_reason") or "").strip()
    if not confidence_reason:
        raise AIServiceError(
            code="route_mapping_invalid",
            message="route mapping confidence_reason is required.",
            http_status=422,
        )

    needs_review_raw = payload.get("needs_review")
    if not isinstance(needs_review_raw, bool):
        raise AIServiceError(
            code="route_mapping_invalid",
            message="route mapping needs_review must be boolean.",
            http_status=422,
        )

    evidence_raw = payload.get("evidence")
    if not isinstance(evidence_raw, dict):
        raise AIServiceError(
            code="route_mapping_invalid",
            message="route mapping evidence must be an object.",
            http_status=422,
        )

    def normalize_evidence_items(key: str) -> list[dict[str, Any]]:
        rows = evidence_raw.get(key)
        if not isinstance(rows, list):
            return []
        out: list[dict[str, Any]] = []
        for item in rows:
            if not isinstance(item, dict):
                continue
            rank_value = item.get("rank")
            try:
                rank = int(rank_value)
            except Exception:
                rank = 0
            out.append(
                {
                    "ingredient_name_cn": str(item.get("ingredient_name_cn") or "").strip(),
                    "ingredient_name_en": str(item.get("ingredient_name_en") or "").strip(),
                    "rank": max(0, rank),
                    "impact": str(item.get("impact") or "").strip(),
                }
            )
            if len(out) >= 20:
                break
        return out

    primary_reason = str(raw_primary.get("reason") or "").strip()
    secondary_reason = str(raw_secondary.get("reason") or "").strip()
    primary_confidence = int(primary_expected["confidence"])
    secondary_confidence = int(secondary_expected["confidence"])

    return {
        "category": expected_category,
        "rules_version": expected_rules_version,
        "primary_route": {
            "route_key": str(primary_expected["route_key"]),
            "route_title": str(primary_expected["route_title"]),
            "confidence": primary_confidence,
            "reason": primary_reason,
        },
        "secondary_route": {
            "route_key": str(secondary_expected["route_key"]),
            "route_title": str(secondary_expected["route_title"]),
            "confidence": secondary_confidence,
            "reason": secondary_reason,
        },
        "route_scores": scores,
        "evidence": {
            "positive": normalize_evidence_items("positive"),
            "counter": normalize_evidence_items("counter"),
        },
        "confidence_reason": confidence_reason,
        "needs_review": bool(needs_review_raw),
    }


def _normalize_ingredient_category_profile_result(
    *,
    category: str,
    ingredient: str,
    payload: dict[str, Any],
) -> dict[str, Any]:
    if not isinstance(payload, dict):
        raise AIServiceError(code="ingredient_profile_invalid", message="ingredient profile output must be a JSON object.", http_status=422)

    ingredient_name_raw = str(payload.get("ingredient_name") or ingredient).strip() or ingredient
    ingredient_name_en_raw = str(payload.get("ingredient_name_en") or "").strip()
    ingredient_name = _normalize_ingredient_name_cn(ingredient_name_raw)
    ingredient_name_en = _normalize_ingredient_name_en(ingredient_name_en_raw)
    if not ingredient_name:
        fallback_cn = _normalize_ingredient_name_cn(ingredient)
        ingredient_name = fallback_cn or ingredient_name_raw
    if not ingredient_name_en:
        ingredient_name_en = _extract_english_name(ingredient_name_raw) or _extract_english_name(ingredient)
    output_category = str(payload.get("category") or category).strip().lower() or category
    if output_category != category:
        raise AIServiceError(
            code="ingredient_profile_invalid",
            message=f"ingredient profile category mismatch: expected '{category}', got '{output_category}'.",
            http_status=422,
        )

    summary = str(payload.get("summary") or "").strip()
    if not summary:
        raise AIServiceError(code="ingredient_profile_invalid", message="ingredient profile summary is required.", http_status=422)

    try:
        confidence = int(payload.get("confidence"))
    except Exception:
        confidence = 0
    confidence = max(0, min(100, confidence))

    return {
        "ingredient_name": ingredient_name,
        "ingredient_name_en": ingredient_name_en,
        "category": output_category,
        "summary": summary,
        "benefits": _to_str_array(payload.get("benefits")),
        "risks": _to_str_array(payload.get("risks")),
        "usage_tips": _to_str_array(payload.get("usage_tips")),
        "suitable_for": _to_str_array(payload.get("suitable_for")),
        "avoid_for": _to_str_array(payload.get("avoid_for")),
        "confidence": confidence,
        "reason": str(payload.get("reason") or "").strip(),
    }


def _normalize_ingredient_name_cn(value: str) -> str:
    text = str(value or "").strip()
    if not text:
        return ""
    text = re.sub(r"\([^)]*[A-Za-z][^)]*\)", "", text)
    text = re.sub(r"（[^）]*[A-Za-z][^）]*）", "", text)
    text = re.sub(r"[A-Za-z][A-Za-z0-9\s\-_/.,]*", "", text)
    text = re.sub(r"\s+", " ", text).strip(" ,，;；:：()（）-_/")
    return text.strip()


def _normalize_ingredient_name_en(value: str) -> str:
    text = str(value or "").strip()
    if not text:
        return ""
    text = re.sub(r"[\u4e00-\u9fff]", "", text)
    text = re.sub(r"\s+", " ", text).strip(" ,，;；:：")
    return text


def _extract_english_name(value: str) -> str:
    text = str(value or "").strip()
    if not text:
        return ""
    matches = re.findall(r"[A-Za-z][A-Za-z0-9\- ]*", text)
    parts = [m.strip(" -_/.,") for m in matches if m and m.strip(" -_/.,")]
    if not parts:
        return ""
    deduped = list(dict.fromkeys(parts))
    return " / ".join(deduped[:3])


def _to_str_array(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    out: list[str] = []
    for item in value:
        text = str(item or "").strip()
        if not text:
            continue
        out.append(text)
        if len(out) >= 20:
            break
    return out


def _emit(event_callback: Callable[[dict[str, Any]], None] | None, payload: dict[str, Any]) -> None:
    if not event_callback:
        return
    try:
        event_callback(payload)
    except Exception:
        return


def _build_doubao_stream_handlers(
    *,
    event_callback: Callable[[dict[str, Any]], None] | None,
    stage: str,
) -> dict[str, Callable[..., None] | None]:
    if event_callback is None:
        return {"on_text_delta": None, "on_stream_event": None}
    return {
        "on_text_delta": lambda delta: _emit(
            event_callback,
            {
                "type": "delta",
                "stage": stage,
                "delta": delta,
                "stream_kind": "output_text",
                "stream_field": "response.output_text.delta.delta",
            },
        ),
        "on_stream_event": lambda event: _forward_doubao_stream_event(
            event_callback=event_callback,
            stage=stage,
            event=event,
        ),
    }


def _forward_doubao_stream_event(
    *,
    event_callback: Callable[[dict[str, Any]], None] | None,
    stage: str,
    event: dict[str, Any],
) -> None:
    kind = str(event.get("kind") or "").strip()
    if kind != "reasoning_summary_delta":
        return
    delta = str(event.get("delta") or "")
    if not delta:
        return
    _emit(
        event_callback,
        {
            "type": "delta",
            "stage": stage,
            "delta": delta,
            "stream_kind": "reasoning_summary",
            "stream_field": str(event.get("field") or "response.reasoning_summary_text.delta.delta"),
        },
    )
