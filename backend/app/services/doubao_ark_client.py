import json
import urllib.error
import urllib.request
from typing import Any


class DoubaoArkClient:
    def __init__(self, api_key: str, endpoint: str, model: str, reasoning_effort: str = "medium", timeout: int = 60):
        self.api_key = api_key
        self.endpoint = endpoint.rstrip("/")
        self.model = model
        self.reasoning_effort = reasoning_effort
        self.timeout = timeout

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
        req = urllib.request.Request(
            url=f"{self.endpoint}/responses",
            data=json.dumps(body).encode("utf-8"),
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {self.api_key}",
            },
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as resp:
                raw = resp.read().decode("utf-8")
        except urllib.error.HTTPError as e:
            payload = ""
            try:
                payload = e.read().decode("utf-8", errors="ignore")
            except Exception:
                payload = ""
            detail = (payload or str(e.reason or "")).strip()
            if len(detail) > 1200:
                detail = detail[:1200] + "...(truncated)"
            raise RuntimeError(f"Doubao API HTTP {e.code}: {detail}") from e
        except urllib.error.URLError as e:
            reason = str(getattr(e, "reason", "") or "unknown")
            raise RuntimeError(f"Doubao API network error: {reason}") from e
        except TimeoutError as e:
            raise RuntimeError("Doubao API timeout.") from e

        try:
            return json.loads(raw)
        except json.JSONDecodeError as e:
            preview = raw[:300] + ("...(truncated)" if len(raw) > 300 else "")
            raise RuntimeError(f"Doubao API returned non-JSON payload: {preview}") from e
