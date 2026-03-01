import json
import urllib.request
from typing import Any


class DoubaoArkClient:
    def __init__(self, api_key: str, endpoint: str, model: str, reasoning_effort: str = "medium", timeout: int = 60):
        self.api_key = api_key
        self.endpoint = endpoint.rstrip("/")
        self.model = model
        self.reasoning_effort = reasoning_effort
        self.timeout = timeout

    def chat_with_image(self, image_url: str, prompt: str) -> dict[str, Any]:
        body = {
            "model": self.model,
            "reasoning_effort": self.reasoning_effort,
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {"type": "image_url", "image_url": {"url": image_url}},
                        {"type": "text", "text": prompt},
                    ],
                }
            ],
        }

        req = urllib.request.Request(
            url=f"{self.endpoint}/chat/completions",
            data=json.dumps(body).encode("utf-8"),
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {self.api_key}",
            },
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=self.timeout) as resp:
            raw = resp.read().decode("utf-8")
            return json.loads(raw)
