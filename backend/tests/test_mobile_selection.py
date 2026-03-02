import pytest

from app.routes import ingest as ingest_routes


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
                    }
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


def test_mobile_selection_resolve_shampoo_route_mapping(test_client, monkeypatch: pytest.MonkeyPatch):
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

    resp = client.post(
        "/api/mobile/selection/resolve",
        json={
            "category": "shampoo",
            "answers": {"q1": "A", "q2": "C", "q3": "B"},
        },
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "ok"
    assert body["route"]["key"] == "oil-lightweight-volume"
    assert body["route"]["title"] == "蓬松支撑型"
    assert body["links"]["wiki"].endswith("focus=volume-support")
    assert body["recommended_product"]["category"] == "shampoo"
    assert body["recommended_product"]["id"]


def test_mobile_selection_resolve_bodywash_fastpath(test_client, monkeypatch: pytest.MonkeyPatch):
    client, _ = test_client
    _install_fake_ingest_pipeline(
        monkeypatch,
        {
            "category": "bodywash",
            "brand": "CeraVe",
            "name": "BodyWash B",
            "one_sentence": "沐浴测试",
        },
    )
    _ingest_one(client, "bodywash.jpg")

    resp = client.post(
        "/api/mobile/selection/resolve",
        json={
            "category": "bodywash",
            "answers": {"q1": "B", "q2": "A"},
        },
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["route"]["key"] == "rescue"
    assert body["route"]["title"] == "恒温舒缓修护型"
    assert [item["key"] for item in body["choices"]] == ["q1", "q2"]


def test_mobile_selection_resolve_reuse_existing_session(test_client, monkeypatch: pytest.MonkeyPatch):
    client, _ = test_client
    _install_fake_ingest_pipeline(
        monkeypatch,
        {
            "category": "cleanser",
            "brand": "Freeplus",
            "name": "Cleanser C",
            "one_sentence": "洁面测试",
        },
    )
    _ingest_one(client, "cleanser.jpg")

    payload = {
        "category": "cleanser",
        "answers": {
            "skin": "combo",
            "issue": "residue",
            "scene": "night-clean",
            "avoid": "complex-formula",
        },
        "reuse_existing": True,
    }
    first = client.post("/api/mobile/selection/resolve", json=payload)
    assert first.status_code == 200
    first_body = first.json()
    assert first_body["reused"] is False

    second = client.post("/api/mobile/selection/resolve", json=payload)
    assert second.status_code == 200
    second_body = second.json()
    assert second_body["reused"] is True
    assert second_body["session_id"] == first_body["session_id"]
