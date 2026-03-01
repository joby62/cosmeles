import json
from typing import Any

from openai import APIConnectionError, APIStatusError, APITimeoutError, OpenAI


class DoubaoOpenAIClient:
    def __init__(self, api_key: str, endpoint: str, model: str, timeout: int = 60):
        self.api_key = api_key
        self.endpoint = endpoint.rstrip("/")
        self.model = model
        self.timeout = timeout
        self.client = OpenAI(
            base_url=self.endpoint,
            api_key=self.api_key,
            timeout=self.timeout,
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
        try:
            response = self.client.responses.create(**body)
        except APITimeoutError as e:
            raise RuntimeError("Doubao API timeout.") from e
        except APIConnectionError as e:
            reason = str(getattr(e, "message", "") or str(e) or "unknown")
            raise RuntimeError(f"Doubao API network error: {reason}") from e
        except APIStatusError as e:
            body_text = ""
            resp = getattr(e, "response", None)
            if resp is not None:
                # openai SDK httpx response body
                body_text = str(getattr(resp, "text", "") or "").strip()
            detail = (body_text or str(e)).strip()
            if len(detail) > 1200:
                detail = detail[:1200] + "...(truncated)"
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
