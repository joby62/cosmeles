import json
import random
import time
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

        stream_api = getattr(self.client.responses, "stream", None)
        if not callable(stream_api):
            # fallback: if SDK version doesn't expose stream(), degrade gracefully.
            response = self.client.responses.create(**body)
            payload = _serialize_response(response)
            text = str(payload.get("output_text") or "").strip()
            if text and on_text_delta:
                on_text_delta(text)
            return payload

        try:
            with stream_api(**body) as stream_obj:
                emitted_any_delta = False
                text_deltas = getattr(stream_obj, "text_deltas", None)
                if text_deltas is not None:
                    try:
                        for delta in text_deltas:
                            if isinstance(delta, str) and delta:
                                emitted_any_delta = True
                                if on_text_delta:
                                    on_text_delta(delta)
                    except Exception:
                        # fallback to raw event iteration
                        pass

                if not emitted_any_delta:
                    for event in stream_obj:
                        delta = _extract_delta_text(event)
                        if delta and on_text_delta:
                            emitted_any_delta = True
                            on_text_delta(delta)
                final_response = stream_obj.get_final_response()
            payload = _serialize_response(final_response)
            if not emitted_any_delta and on_text_delta:
                text = str(payload.get("output_text") or "").strip()
                if text:
                    on_text_delta(text)
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
            text = str(payload.get("output_text") or "").strip()
            if text and on_text_delta:
                on_text_delta(text)
            return payload


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
    if hasattr(event, "delta"):
        delta = getattr(event, "delta", None)
        if isinstance(delta, str) and delta:
            return delta

    if hasattr(event, "model_dump"):
        try:
            payload = event.model_dump(mode="json")
            if isinstance(payload, dict):
                delta = payload.get("delta")
                if isinstance(delta, str) and delta:
                    return delta
                # Some SDK events wrap text in output_text.delta
                output_text = payload.get("output_text")
                if isinstance(output_text, dict):
                    inner_delta = output_text.get("delta")
                    if isinstance(inner_delta, str) and inner_delta:
                        return inner_delta
        except Exception:
            return ""
    return ""
