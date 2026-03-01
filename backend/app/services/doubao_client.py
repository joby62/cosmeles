import json
import base64
import mimetypes
import re
from pathlib import Path
from typing import Any

from app.settings import settings
from app.services.storage import read_rel_bytes
from app.services.doubao_ark_client import DoubaoArkClient

class DoubaoClient:
    """
    支持 sample/mock / real 两种模式：
    - sample/mock：读取 sample_data/product_sample.json，不调用外部网络
    - real：调用豆包 Ark 接口，返回结构化 ProductDoc dict
    """
    def __init__(self):
        self.mode = settings.doubao_mode.lower().strip()

    def analyze(self, image_path: str) -> dict:
        if self.mode in {"mock", "sample"}:
            sample = Path(__file__).resolve().parents[2] / "sample_data" / "product_sample.json"
            return json.loads(sample.read_text(encoding="utf-8"))

        if not settings.doubao_api_key:
            raise NotImplementedError("DOUBAO_API_KEY is missing.")

        endpoint = settings.doubao_endpoint or "https://ark.cn-beijing.volces.com/api/v3"
        model = settings.doubao_model or "doubao-seed-2-0-mini-260215"
        sdk = DoubaoArkClient(
            api_key=settings.doubao_api_key,
            endpoint=endpoint,
            model=model,
            reasoning_effort=settings.doubao_reasoning_effort,
            timeout=settings.doubao_timeout_seconds,
        )

        image_data_url = _to_data_url(image_path)
        prompt = _build_prompt()
        raw = sdk.chat_with_image(image_data_url, prompt)
        content = _extract_content(raw)
        doc = _extract_json_object(content)
        if "evidence" not in doc:
            doc["evidence"] = {}
        doc["evidence"]["doubao_raw"] = content
        return doc


def _to_data_url(image_rel_path: str) -> str:
    data = read_rel_bytes(image_rel_path)
    mime, _ = mimetypes.guess_type(image_rel_path)
    mime = mime or "image/jpeg"
    b64 = base64.b64encode(data).decode("ascii")
    return f"data:{mime};base64,{b64}"


def _build_prompt() -> str:
    return (
        "你是洗护产品成分分析助手。请基于图片识别结果，严格输出 JSON 对象，禁止输出任何额外文字。"
        "字段结构必须为："
        '{"product":{"category":"shampoo|bodywash|conditioner|lotion|cleanser","brand":"",'
        '"name":""},"summary":{"one_sentence":"","pros":[],"cons":[],"who_for":[],"who_not_for":[]},'
        '"ingredients":[{"name":"","type":"","functions":[],"risk":"low|mid|high","notes":""}],'
        '"evidence":{"doubao_raw":""}}。'
        "若字段缺失请给空字符串或空数组。"
    )


def _extract_content(raw: dict[str, Any]) -> str:
    choices = raw.get("choices") or []
    if not choices:
        raise ValueError("Doubao response has no choices.")
    message = choices[0].get("message") or {}
    content = message.get("content")
    if isinstance(content, list):
        texts: list[str] = []
        for part in content:
            if isinstance(part, dict) and isinstance(part.get("text"), str):
                texts.append(part["text"])
        content = "\n".join(texts).strip()
    if not isinstance(content, str) or not content.strip():
        raise ValueError("Doubao response content is empty.")
    return content.strip()


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

    raise ValueError("No JSON object found in Doubao response.")
