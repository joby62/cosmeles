import json

import pytest

from app.routes import ingest as ingest_routes
from app.routes import mobile as mobile_routes


def _install_fake_ingest_pipeline(monkeypatch: pytest.MonkeyPatch, plan: dict) -> None:
    def fake_stage1(_image_rel: str, trace_id: str, event_callback=None):
        if event_callback:
            event_callback({"type": "step", "stage": "stage1_vision", "message": "mock"})
        return {
            "vision_text": f"【品牌】{plan['brand']}\n【产品名】{plan['name']}\n【品类】{plan['category']}",
            "model": "doubao-stage1-mini",
            "artifact": f"doubao_runs/{trace_id}/stage1_vision.json",
        }

    def fake_stage2(_vision_text: str, trace_id: str, event_callback=None):
        if event_callback:
            event_callback({"type": "step", "stage": "stage2_struct", "message": "mock"})
        return {
            "doc": {
                "product": {
                    "category": plan["category"],
                    "brand": plan["brand"],
                    "name": plan["name"],
                },
                "summary": {
                    "one_sentence": plan["one_sentence"],
                    "pros": ["温和清洁"],
                    "cons": [],
                    "who_for": ["普通肤质"],
                    "who_not_for": [],
                },
                "ingredients": [
                    {
                        "name": "甘油",
                        "type": "保湿剂",
                        "functions": ["保湿"],
                        "risk": "low",
                        "notes": "",
                    },
                    {
                        "name": "椰油酰胺丙基甜菜碱",
                        "type": "表活",
                        "functions": ["清洁"],
                        "risk": "mid",
                        "notes": "",
                    },
                ],
                "evidence": {"doubao_raw": ""},
            },
            "struct_text": "{\"ok\":true}",
            "model": "doubao-stage2-mini",
            "artifact": f"doubao_runs/{trace_id}/stage2_struct.json",
        }

    monkeypatch.setattr(ingest_routes, "_analyze_with_doubao_stage1", fake_stage1)
    monkeypatch.setattr(ingest_routes, "_analyze_with_doubao_stage2", fake_stage2)


def _ingest_one(client, image_name: str = "sample.jpg") -> str:
    stage1 = client.post(
        "/api/upload/stage1",
        files={"image": (image_name, b"fake-jpeg-bytes", "image/jpeg")},
    )
    assert stage1.status_code == 200
    trace_id = stage1.json()["trace_id"]

    stage2 = client.post("/api/upload/stage2", data={"trace_id": trace_id})
    assert stage2.status_code == 200
    return trace_id


def _parse_sse_events(raw: str) -> list[tuple[str, dict]]:
    events: list[tuple[str, dict]] = []
    for block in raw.replace("\r\n", "\n").split("\n\n"):
        text = block.strip()
        if not text or text.startswith(":"):
            continue
        event = "message"
        data_lines: list[str] = []
        for line in text.split("\n"):
            if line.startswith("event:"):
                event = line.split(":", 1)[1].strip()
            elif line.startswith("data:"):
                data_lines.append(line.split(":", 1)[1].strip())
        payload = {}
        if data_lines:
            payload = json.loads("\n".join(data_lines))
        events.append((event, payload))
    return events


def test_mobile_compare_bootstrap_without_history(test_client):
    client, _ = test_client
    resp = client.get("/api/mobile/compare/bootstrap", params={"category": "shampoo"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "ok"
    assert body["selected_category"] == "shampoo"
    assert body["recommendation"]["exists"] is False
    assert body["profile"]["has_history_profile"] is False


def test_mobile_compare_stream_success_and_fetch_result(test_client, monkeypatch: pytest.MonkeyPatch):
    client, _ = test_client
    _install_fake_ingest_pipeline(
        monkeypatch,
        {
            "category": "shampoo",
            "brand": "Dove",
            "name": "Shampoo A",
            "one_sentence": "洗发测试",
        },
    )
    _ingest_one(client, "shampoo.jpg")

    # 先生成历史首推会话
    selection = client.post(
        "/api/mobile/selection/resolve",
        json={"category": "shampoo", "answers": {"q1": "A", "q2": "C", "q3": "B"}},
    )
    assert selection.status_code == 200

    upload = client.post(
        "/api/mobile/compare/current-product/upload",
        data={"category": "shampoo", "brand": "CurrentBrand", "name": "CurrentName"},
        files={"image": ("current.jpg", b"fake-current-jpeg", "image/jpeg")},
    )
    assert upload.status_code == 200
    upload_id = upload.json()["upload_id"]

    class FakePipeline:
        def analyze_stage1(self, image_path: str, trace_id: str | None = None, event_callback=None):
            if event_callback:
                event_callback({"type": "step", "stage": "stage1_vision", "message": "stage1 done"})
            return {
                "vision_text": "mock vision",
                "model": "doubao-stage1-mini",
                "artifact": f"doubao_runs/{trace_id}/stage1_vision.json",
            }

        def analyze_stage2(self, vision_text: str, trace_id: str | None = None, event_callback=None):
            if event_callback:
                event_callback({"type": "step", "stage": "stage2_struct", "message": "stage2 done"})
            return {
                "doc": {
                    "product": {
                        "category": "shampoo",
                        "brand": "CurrentBrand",
                        "name": "CurrentName",
                    },
                    "summary": {
                        "one_sentence": "当前在用品测试摘要",
                        "pros": ["即时顺滑"],
                        "cons": ["可能偏干"],
                        "who_for": ["正常发质"],
                        "who_not_for": ["极敏感头皮"],
                    },
                    "ingredients": [
                        {"name": "甘油", "type": "保湿剂", "functions": ["保湿"], "risk": "low", "notes": ""},
                        {"name": "月桂醇硫酸酯钠", "type": "表活", "functions": ["清洁"], "risk": "high", "notes": ""},
                    ],
                    "evidence": {"doubao_raw": ""},
                },
                "struct_text": "{\"ok\":true}",
                "model": "doubao-stage2-mini",
                "artifact": f"doubao_runs/{trace_id}/stage2_struct.json",
            }

    def fake_run_capability_now(capability: str, input_payload: dict, trace_id: str | None = None, event_callback=None):
        assert capability == "doubao.mobile_compare_summary"
        if event_callback:
            event_callback({"type": "step", "stage": "mobile_compare_summary", "message": "running"})
            event_callback({"type": "delta", "stage": "mobile_compare_summary", "delta": "实时输出片段。"})
        return {
            "decision": "switch",
            "headline": "更建议你换到历史首推，整体更匹配当前情况。",
            "confidence": 0.88,
            "sections": {
                "keep_benefits": ["当前产品即时顺滑反馈更明显。"],
                "keep_watchouts": ["高频使用可能放大干涩风险。"],
                "ingredient_order_diff": ["两款前排成分侧重明显不同。"],
                "profile_fit_advice": ["结合你的个人情况，首推更稳妥。"],
            },
            "model": "doubao-pro",
        }

    monkeypatch.setattr(mobile_routes, "DoubaoPipelineService", FakePipeline)
    monkeypatch.setattr(mobile_routes, "run_capability_now", fake_run_capability_now)

    stream_resp = client.post(
        "/api/mobile/compare/jobs/stream",
        json={
            "category": "shampoo",
            "profile_mode": "reuse_latest",
            "current_product": {"source": "upload_new", "upload_id": upload_id},
            "options": {"include_inci_order_diff": True, "include_function_rank_diff": True},
        },
    )
    assert stream_resp.status_code == 200
    events = _parse_sse_events(stream_resp.text)
    by_event = {}
    for name, payload in events:
        by_event.setdefault(name, []).append(payload)

    assert "error" not in by_event
    assert "result" in by_event
    result = by_event["result"][0]
    assert result["status"] == "ok"
    assert result["verdict"]["decision"] == "switch"
    assert result["sections"][0]["key"] == "keep_benefits"
    assert result["trace_id"]

    fetched = client.get(f"/api/mobile/compare/results/{result['compare_id']}")
    assert fetched.status_code == 200
    fetched_body = fetched.json()
    assert fetched_body["compare_id"] == result["compare_id"]
    assert fetched_body["verdict"]["headline"] == result["verdict"]["headline"]


def test_mobile_compare_stream_returns_real_error_when_no_recommendation(test_client):
    client, _ = test_client
    stream_resp = client.post(
        "/api/mobile/compare/jobs/stream",
        json={
            "category": "shampoo",
            "profile_mode": "skip",
            "current_product": {"source": "history_product", "product_id": "missing-id"},
            "options": {"include_inci_order_diff": True, "include_function_rank_diff": True},
        },
    )
    assert stream_resp.status_code == 200
    events = _parse_sse_events(stream_resp.text)
    errors = [payload for name, payload in events if name == "error"]
    assert errors
    assert errors[0]["code"] == "COMPARE_RECOMMENDATION_NOT_FOUND"
