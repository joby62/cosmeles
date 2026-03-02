import json
import random
import time
from collections.abc import Iterable
from typing import Any, Callable

from openai import APIConnectionError, APIStatusError, APITimeoutError, OpenAI


class DoubaoOpenAIClient:
    def __init__(
        self,
        api_key: str,
        endpoint: str,
        model: str,
        timeout: int = 60,
        max_retries: int = 0,
        retry_backoff_seconds: float = 1.0,
    ):
        self.api_key = api_key
        self.endpoint = endpoint.rstrip("/")
        self.model = model
        self.timeout = timeout
        self.max_retries = max(0, int(max_retries))
        self.retry_backoff_seconds = max(0.1, float(retry_backoff_seconds))
        self.client = OpenAI(
            base_url=self.endpoint,
            api_key=self.api_key,
            timeout=self.timeout,
            # 我们在业务层实现重试，避免 SDK 内外双重重试导致请求过长
            max_retries=0,
        )

    def chat_with_image(
        self,
        image_url: str,
        prompt: str,
        model: str | None = None,
        stream: bool = False,
        on_text_delta: Callable[[str], None] | None = None,
    ) -> dict[str, Any]:
        body = {
            "model": model or self.model,
            "input": [
                {
                    "role": "user",
                    "content": [
                        {"type": "input_image", "image_url": image_url},
                        {"type": "input_text", "text": prompt},
                    ],
                }
            ],
        }
        return self._responses(body, stream=stream, on_text_delta=on_text_delta)

    def chat_with_text(
        self,
        prompt: str,
        model: str | None = None,
        stream: bool = False,
        on_text_delta: Callable[[str], None] | None = None,
    ) -> dict[str, Any]:
        body = {
            "model": model or self.model,
            "input": [
                {
                    "role": "user",
                    "content": [{"type": "input_text", "text": prompt}],
                }
            ],
        }
        return self._responses(body, stream=stream, on_text_delta=on_text_delta)

    def _responses(
        self,
        body: dict[str, Any],
        stream: bool = False,
        on_text_delta: Callable[[str], None] | None = None,
    ) -> dict[str, Any]:
        attempts = self.max_retries + 1
        for attempt in range(1, attempts + 1):
            try:
                response = self._call_response_api(body, stream=stream, on_text_delta=on_text_delta)
                break
            except APITimeoutError as e:
                if attempt >= attempts:
                    raise RuntimeError(f"Doubao API timeout after {attempt} attempts.") from e
                self._sleep_backoff(attempt)
                continue
            except APIConnectionError as e:
                reason = str(getattr(e, "message", "") or str(e) or "unknown")
                if attempt >= attempts:
                    raise RuntimeError(f"Doubao API network error after {attempt} attempts: {reason}") from e
                self._sleep_backoff(attempt)
                continue
            except APIStatusError as e:
                detail = _extract_status_error_detail(e)
                if attempt < attempts and _is_retryable_status(e.status_code):
                    self._sleep_backoff(attempt)
                    continue
                raise RuntimeError(f"Doubao API HTTP {e.status_code}: {detail}") from e

        return response

    def _sleep_backoff(self, attempt: int) -> None:
        # 指数退避 + 抖动，减少瞬时重试风暴
        delay = self.retry_backoff_seconds * (2 ** max(attempt - 1, 0))
        jitter = random.uniform(0, min(1.0, delay * 0.2))
        time.sleep(delay + jitter)

    def _call_response_api(
        self,
        body: dict[str, Any],
        stream: bool,
        on_text_delta: Callable[[str], None] | None,
    ) -> dict[str, Any]:
        if not stream:
            response = self.client.responses.create(**body)
            return _serialize_response(response)

        try:
            stream_payload = self._stream_with_create(body=body, on_text_delta=on_text_delta)
            if stream_payload is not None:
                return stream_payload
            stream_payload = self._stream_with_context_helper(body=body, on_text_delta=on_text_delta)
            if stream_payload is not None:
                return stream_payload
            response = self.client.responses.create(**body)
            payload = _serialize_response(response)
            _emit_final_text_if_needed(payload, on_text_delta=on_text_delta)
            return payload
        except (APITimeoutError, APIConnectionError, APIStatusError):
            # Keep original retry/error behavior handled in _responses.
            raise
        except Exception as e:
            # SDK streaming occasionally throws internal errors for some multimodal payloads.
            # Fallback to non-stream request to improve robustness.
            response = self.client.responses.create(**body)
            payload = _serialize_response(response)
            payload["_stream_fallback_error"] = f"{type(e).__name__}: {str(e)}"
            _emit_final_text_if_needed(payload, on_text_delta=on_text_delta)
            return payload

    def _stream_with_create(
        self,
        body: dict[str, Any],
        on_text_delta: Callable[[str], None] | None,
    ) -> dict[str, Any] | None:
        create_api = getattr(self.client.responses, "create", None)
        if not callable(create_api):
            return None

        try:
            stream_obj = create_api(**body, stream=True)
        except TypeError:
            # Older/partial SDK adapters may not accept stream=True.
            return None

        if not _is_iterable(stream_obj):
            payload = _serialize_response(stream_obj)
            _emit_final_text_if_needed(payload, on_text_delta=on_text_delta)
            return payload

        return _consume_stream(
            stream_obj=stream_obj,
            on_text_delta=on_text_delta,
            close_when_done=True,
        )

    def _stream_with_context_helper(
        self,
        body: dict[str, Any],
        on_text_delta: Callable[[str], None] | None,
    ) -> dict[str, Any] | None:
        stream_api = getattr(self.client.responses, "stream", None)
        if not callable(stream_api):
            return None

        with stream_api(**body) as stream_obj:
            return _consume_stream(
                stream_obj=stream_obj,
                on_text_delta=on_text_delta,
                close_when_done=False,
            )


def _extract_status_error_detail(error: APIStatusError) -> str:
    body_text = ""
    resp = getattr(error, "response", None)
    if resp is not None:
        body_text = str(getattr(resp, "text", "") or "").strip()
    detail = (body_text or str(error)).strip()
    if len(detail) > 1200:
        detail = detail[:1200] + "...(truncated)"
    return detail


def _is_retryable_status(status: int) -> bool:
    return status in {408, 409, 425, 429, 500, 502, 503, 504}


def _serialize_response(response: Any) -> dict[str, Any]:
    if isinstance(response, dict):
        return response
    try:
        if hasattr(response, "model_dump"):
            return response.model_dump(mode="json")
        if hasattr(response, "to_dict"):
            return response.to_dict()
        if hasattr(response, "model_dump_json"):
            return json.loads(response.model_dump_json())
    except Exception:
        pass

    try:
        return {"output_text": str(getattr(response, "output_text", "") or "")}
    except Exception as e:
        raise RuntimeError(f"Doubao SDK returned unexpected payload type: {type(response)}") from e


def _extract_delta_text(event: Any) -> str:
    payload = _event_to_dict(event)
    if isinstance(payload, dict):
        delta = _extract_delta_text_from_payload(payload)
        if delta:
            return delta

    if hasattr(event, "delta"):
        delta = getattr(event, "delta", None)
        text = _as_text(delta)
        if text:
            return text

    if hasattr(event, "text"):
        text = _as_text(getattr(event, "text", None))
        if text:
            return text

    return ""


def _consume_stream(
    stream_obj: Any,
    on_text_delta: Callable[[str], None] | None,
    close_when_done: bool,
) -> dict[str, Any]:
    emitted_any_delta = False
    collected: list[str] = []
    final_payload: dict[str, Any] | None = None

    try:
        # Prefer raw stream events: `text_deltas` helper may coalesce chunks.
        for event in stream_obj:
            delta = _extract_delta_text(event)
            if delta:
                emitted_any_delta = True
                collected.append(delta)
                if on_text_delta:
                    on_text_delta(delta)

            maybe_response = _extract_response_payload_from_event(event)
            if maybe_response is not None:
                final_payload = _serialize_response(maybe_response)

        get_final_response = getattr(stream_obj, "get_final_response", None)
        if callable(get_final_response):
            try:
                final_payload = _serialize_response(get_final_response())
            except Exception:
                pass
    finally:
        if close_when_done:
            close = getattr(stream_obj, "close", None)
            if callable(close):
                close()

    if final_payload is None:
        final_payload = {"output_text": "".join(collected)}

    if not emitted_any_delta:
        _emit_final_text_if_needed(final_payload, on_text_delta=on_text_delta)

    return final_payload


def _extract_response_payload_from_event(event: Any) -> Any | None:
    if hasattr(event, "response"):
        response = getattr(event, "response", None)
        if response is not None:
            return response

    payload = _event_to_dict(event)
    if not isinstance(payload, dict):
        return None

    response = payload.get("response")
    if response is not None:
        return response

    done_types = {"response.completed", "response.done", "response.output_text.done"}
    if str(payload.get("type") or "") in done_types:
        text = _as_text(payload.get("text")) or _as_text(payload.get("output_text"))
        if text:
            return {"output_text": text}

    return None


def _emit_final_text_if_needed(
    payload: dict[str, Any],
    on_text_delta: Callable[[str], None] | None,
) -> None:
    if not on_text_delta:
        return
    text = _as_text(payload.get("output_text"))
    if text:
        on_text_delta(text)


def _event_to_dict(event: Any) -> dict[str, Any] | None:
    if isinstance(event, dict):
        return event
    if isinstance(event, str):
        try:
            parsed = json.loads(event)
            if isinstance(parsed, dict):
                return parsed
        except json.JSONDecodeError:
            return None
    if hasattr(event, "model_dump"):
        try:
            payload = event.model_dump(mode="json")
            if isinstance(payload, dict):
                return payload
        except Exception:
            return None
    if hasattr(event, "to_dict"):
        try:
            payload = event.to_dict()
            if isinstance(payload, dict):
                return payload
        except Exception:
            return None
    return None


def _extract_delta_text_from_payload(payload: dict[str, Any]) -> str:
    event_type = str(payload.get("type") or "")

    # Responses API delta events.
    if event_type in {"response.output_text.delta", "response.refusal.delta"}:
        for key in ("delta", "text"):
            text = _as_text(payload.get(key))
            if text:
                return text

    # Partial adapters may not include `type`, keep a strict fallback.
    for key in ("delta", "text"):
        text = _as_text(payload.get(key))
        if text:
            return text

    output_text = payload.get("output_text")
    if isinstance(output_text, dict):
        for key in ("delta", "text"):
            text = _as_text(output_text.get(key))
            if text:
                return text
    elif isinstance(output_text, list):
        for item in output_text:
            text = _as_text(item)
            if text:
                return text

    return ""


def _as_text(value: Any) -> str:
    if isinstance(value, str):
        return value
    if isinstance(value, list):
        parts: list[str] = []
        for item in value:
            text = _as_text(item)
            if text:
                parts.append(text)
        return "".join(parts)
    if isinstance(value, dict):
        for key in ("delta", "text", "value", "output_text"):
            nested = value.get(key)
            text = _as_text(nested)
            if text:
                return text
        content = value.get("content")
        if content is not None:
            text = _as_text(content)
            if text:
                return text
    return ""


def _is_iterable(value: Any) -> bool:
    if isinstance(value, (str, bytes, dict)):
        return False
    return isinstance(value, Iterable)
