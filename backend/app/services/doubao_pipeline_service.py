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
        image_path: str,
        trace_id: str | None = None,
        event_callback: Callable[[dict[str, Any]], None] | None = None,
    ) -> dict[str, Any]:
        return run_capability_now(
            capability="doubao.stage1_vision",
            input_payload={"image_path": image_path},
            trace_id=trace_id,
            event_callback=event_callback,
        )

    def analyze_stage2(
        self,
        vision_text: str,
        trace_id: str | None = None,
        event_callback: Callable[[dict[str, Any]], None] | None = None,
    ) -> dict[str, Any]:
        return run_capability_now(
            capability="doubao.stage2_struct",
            input_payload={"vision_text": vision_text},
            trace_id=trace_id,
            event_callback=event_callback,
        )

    def analyze(
        self,
        image_path: str,
        trace_id: str | None = None,
        event_callback: Callable[[dict[str, Any]], None] | None = None,
    ) -> dict[str, Any]:
        return run_capability_now(
            capability="doubao.two_stage_parse",
            input_payload={"image_path": image_path},
            trace_id=trace_id,
            event_callback=event_callback,
        )
