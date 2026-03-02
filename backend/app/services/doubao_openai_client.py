import json
import random
import time
from typing import Any

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

    def chat_with_image(self, image_url: str, prompt: str, model: str | None = None) -> dict[str, Any]:
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
        return self._responses(body)

    def chat_with_text(self, prompt: str, model: str | None = None) -> dict[str, Any]:
        body = {
            "model": model or self.model,
            "input": [
                {
                    "role": "user",
                    "content": [{"type": "input_text", "text": prompt}],
                }
            ],
        }
        return self._responses(body)

    def _responses(self, body: dict[str, Any]) -> dict[str, Any]:
        attempts = self.max_retries + 1
        for attempt in range(1, attempts + 1):
            try:
                response = self.client.responses.create(**body)
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

        try:
            if hasattr(response, "model_dump"):
                return response.model_dump(mode="json")
            if hasattr(response, "to_dict"):
                return response.to_dict()
            if hasattr(response, "model_dump_json"):
                return json.loads(response.model_dump_json())
        except Exception:
            pass

        # fallback: keep minimal data for parser
        try:
            return {"output_text": str(getattr(response, "output_text", "") or "")}
        except Exception as e:
            raise RuntimeError(f"Doubao SDK returned unexpected payload type: {type(response)}") from e

    def _sleep_backoff(self, attempt: int) -> None:
        # 指数退避 + 抖动，减少瞬时重试风暴
        delay = self.retry_backoff_seconds * (2 ** max(attempt - 1, 0))
        jitter = random.uniform(0, min(1.0, delay * 0.2))
        time.sleep(delay + jitter)


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
