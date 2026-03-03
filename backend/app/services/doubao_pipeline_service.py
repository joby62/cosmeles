from typing import Any
from typing import Callable

from app.ai.orchestrator import run_capability_now


class DoubaoPipelineService:
    """
    Backward-compatible facade.
    Internally delegates to the new AI capability layer.
    """

    def analyze_stage1(
        self,
        image_path: str | None = None,
        image_paths: list[str] | None = None,
        trace_id: str | None = None,
        model_tier: str | None = None,
        event_callback: Callable[[dict[str, Any]], None] | None = None,
    ) -> dict[str, Any]:
        paths = [str(item or "").strip() for item in (image_paths or []) if str(item or "").strip()]
        input_payload: dict[str, Any] = {}
        if paths:
            input_payload["image_paths"] = paths
            input_payload["image_path"] = paths[0]
        else:
            single = str(image_path or "").strip()
            if not single:
                raise ValueError("analyze_stage1 requires image_path or image_paths.")
            input_payload["image_path"] = single
        if model_tier:
            input_payload["model_tier"] = model_tier
        return run_capability_now(
            capability="doubao.stage1_vision",
            input_payload=input_payload,
            trace_id=trace_id,
            event_callback=event_callback,
        )

    def analyze_stage2(
        self,
        vision_text: str,
        trace_id: str | None = None,
        model_tier: str | None = None,
        event_callback: Callable[[dict[str, Any]], None] | None = None,
    ) -> dict[str, Any]:
        input_payload: dict[str, Any] = {"vision_text": vision_text}
        if model_tier:
            input_payload["model_tier"] = model_tier
        return run_capability_now(
            capability="doubao.stage2_struct",
            input_payload=input_payload,
            trace_id=trace_id,
            event_callback=event_callback,
        )

    def analyze(
        self,
        image_path: str,
        trace_id: str | None = None,
        stage1_model_tier: str | None = None,
        stage2_model_tier: str | None = None,
        event_callback: Callable[[dict[str, Any]], None] | None = None,
    ) -> dict[str, Any]:
        input_payload: dict[str, Any] = {"image_path": image_path}
        if stage1_model_tier:
            input_payload["stage1_model_tier"] = stage1_model_tier
        if stage2_model_tier:
            input_payload["stage2_model_tier"] = stage2_model_tier
        return run_capability_now(
            capability="doubao.two_stage_parse",
            input_payload=input_payload,
            trace_id=trace_id,
            event_callback=event_callback,
        )
