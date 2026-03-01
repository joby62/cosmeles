import base64
import json
import mimetypes
import re
from pathlib import Path
from typing import Any

from app.settings import settings
from app.services.doubao_ark_client import DoubaoArkClient
from app.services.storage import read_rel_bytes, save_doubao_artifact


class DoubaoClient:
    """
    两阶段识别：
    1) mini(vision): 图片 -> 文字抽取
    2) lite(struct): 抽取文字 -> 严格 JSON 结构化
    """

    def __init__(self):
        self.mode = settings.doubao_mode.lower().strip()

    def analyze_stage1(self, image_path: str, trace_id: str | None = None) -> dict[str, Any]:
        if self.mode in {"mock", "sample"}:
            vision_text = "sample mode: skipped vision OCR."
            artifact = None
            if trace_id:
                artifact = save_doubao_artifact(
                    trace_id,
                    "stage1_vision",
                    {"model": "sample", "prompt": "sample", "response": {"mode": "sample"}, "text": vision_text},
                )
            return {"vision_text": vision_text, "model": "sample", "artifact": artifact}

        sdk, vision_model, _ = self._build_sdk_and_models()
        image_data_url = _to_data_url(image_path)
        vision_prompt = _build_vision_prompt()
        vision_raw = sdk.chat_with_image(image_data_url, vision_prompt, model=vision_model)
        vision_text = _extract_content(vision_raw)

        artifact = None
        if trace_id:
            artifact = save_doubao_artifact(
                trace_id,
                "stage1_vision",
                {"model": vision_model, "prompt": vision_prompt, "response": vision_raw, "text": vision_text},
            )
        return {"vision_text": vision_text, "model": vision_model, "artifact": artifact}

    def analyze_stage2(self, vision_text: str, trace_id: str | None = None) -> dict[str, Any]:
        if self.mode in {"mock", "sample"}:
            sample = Path(__file__).resolve().parents[2] / "sample_data" / "product_sample.json"
            doc = json.loads(sample.read_text(encoding="utf-8"))
            artifact = None
            if trace_id:
                artifact = save_doubao_artifact(
                    trace_id,
                    "stage2_struct",
                    {"model": "sample", "prompt": "sample", "response": {"mode": "sample"}, "text": "sample"},
                )
            return {"doc": doc, "struct_text": json.dumps(doc, ensure_ascii=False), "model": "sample", "artifact": artifact}

        sdk, _, struct_model = self._build_sdk_and_models()
        struct_prompt = _build_struct_prompt(vision_text)
        struct_raw = sdk.chat_with_text(struct_prompt, model=struct_model)
        struct_content = _extract_content(struct_raw)
        doc = _extract_json_object(struct_content)

        artifact = None
        if trace_id:
            artifact = save_doubao_artifact(
                trace_id,
                "stage2_struct",
                {"model": struct_model, "prompt": struct_prompt, "response": struct_raw, "text": struct_content},
            )
        return {"doc": doc, "struct_text": struct_content, "model": struct_model, "artifact": artifact}

    def analyze(self, image_path: str, trace_id: str | None = None) -> dict:
        stage1 = self.analyze_stage1(image_path, trace_id=trace_id)
        stage2 = self.analyze_stage2(stage1["vision_text"], trace_id=trace_id)
        doc = stage2["doc"]

        evidence = doc.setdefault("evidence", {})
        evidence["doubao_raw"] = stage2["struct_text"]
        evidence["doubao_vision_text"] = stage1["vision_text"]
        evidence["doubao_pipeline_mode"] = "two-stage"
        evidence["doubao_models"] = {"vision": stage1["model"], "struct": stage2["model"]}
        evidence["doubao_artifacts"] = {"vision": stage1.get("artifact"), "struct": stage2.get("artifact")}
        return doc

    def _build_sdk_and_models(self) -> tuple[DoubaoArkClient, str, str]:
        if self.mode != "real":
            raise ValueError(f"Invalid DOUBAO_MODE: {self.mode}. Expected one of: real, mock, sample.")
        if not settings.doubao_api_key:
            raise ValueError("DOUBAO_API_KEY is missing. Set backend/.env.local and keep DOUBAO_MODE=real.")

        endpoint = settings.doubao_endpoint or "https://ark.cn-beijing.volces.com/api/v3"
        vision_model = settings.doubao_vision_model or settings.doubao_model or "doubao-seed-2-0-mini-260215"
        struct_model = settings.doubao_struct_model or "doubao-seed-2-0-lite-260215"
        sdk = DoubaoArkClient(
            api_key=settings.doubao_api_key,
            endpoint=endpoint,
            model=vision_model,
            reasoning_effort=settings.doubao_reasoning_effort,
            timeout=settings.doubao_timeout_seconds,
        )
        return sdk, vision_model, struct_model


def _to_data_url(image_rel_path: str) -> str:
    data = read_rel_bytes(image_rel_path)
    mime, _ = mimetypes.guess_type(image_rel_path)
    mime = mime or "image/jpeg"
    b64 = base64.b64encode(data).decode("ascii")
    return f"data:{mime};base64,{b64}"


def _build_vision_prompt() -> str:
    return (
        "你是洗护产品图像识别助手。请只输出图片中可读文字和关键视觉信息，禁止输出 JSON。"
        "请按以下结构输出纯文本："
        "【品牌】、【产品名】、【品类】、【包装文案原文】、【成分表原文】、【使用说明原文】、【其他可见信息】。"
        "看不清请写“未识别”。不要编造。"
    )


def _build_struct_prompt(vision_text: str) -> str:
    return (
        "你是洗护产品成分分析助手。下面是图片识别得到的文本，请你基于它输出严格 JSON 对象，禁止任何额外文字。\n"
        "【图片识别文本开始】\n"
        f"{vision_text}\n"
        "【图片识别文本结束】\n"
        "JSON 字段结构必须为："
        '{"product":{"category":"shampoo|bodywash|conditioner|lotion|cleanser","brand":"",'
        '"name":""},"summary":{"one_sentence":"","pros":[],"cons":[],"who_for":[],"who_not_for":[]},'
        '"ingredients":[{"name":"","type":"","functions":[],"risk":"low|mid|high","notes":""}],'
        '"evidence":{"doubao_raw":""}}。'
        "若字段缺失请给空字符串或空数组，不要省略字段。"
    )


def _extract_content(raw: dict[str, Any]) -> str:
    # Ark /responses 格式优先
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

    # 兼容 /chat/completions 格式
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

    raise ValueError(f"Doubao response content is empty. top-level keys={list(raw.keys())}")


def _collect_text(node: Any) -> list[str]:
    texts: list[str] = []
    if isinstance(node, str):
        val = node.strip()
        if val:
            texts.append(val)
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
        val = item.strip()
        if not val or val in seen:
            continue
        seen.add(val)
        merged.append(val)
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

    raise ValueError("No JSON object found in Doubao response.")
