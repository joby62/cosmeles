import pytest
from fastapi.testclient import TestClient

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


def test_mobile_selection_isolated_by_device_cookie(test_client, monkeypatch: pytest.MonkeyPatch):
    client, _ = test_client
    _install_fake_ingest_pipeline(
        monkeypatch,
        {
            "category": "shampoo",
            "brand": "Dove",
            "name": "Shampoo Z",
            "one_sentence": "隔离测试",
        },
    )
    _ingest_one(client, "isolation.jpg")

    payload = {
        "category": "shampoo",
        "answers": {"q1": "A", "q2": "C", "q3": "B"},
        "reuse_existing": True,
    }
    first = client.post("/api/mobile/selection/resolve", json=payload)
    assert first.status_code == 200
    first_body = first.json()
    assert first_body["reused"] is False

    with TestClient(client.app) as another_device:
        second = another_device.post("/api/mobile/selection/resolve", json=payload)
        assert second.status_code == 200
        second_body = second.json()
        assert second_body["reused"] is False
        assert second_body["session_id"] != first_body["session_id"]

        listed = another_device.get("/api/mobile/selection/sessions")
        assert listed.status_code == 200
        listed_ids = {item["session_id"] for item in listed.json()}
        assert first_body["session_id"] not in listed_ids


def test_mobile_selection_batch_delete_scoped_by_owner(test_client, monkeypatch: pytest.MonkeyPatch):
    client, _ = test_client
    _install_fake_ingest_pipeline(
        monkeypatch,
        {
            "category": "bodywash",
            "brand": "CeraVe",
            "name": "BodyWash D",
            "one_sentence": "删除测试",
        },
    )
    _ingest_one(client, "delete.jpg")

    payload = {"category": "bodywash", "answers": {"q1": "B", "q2": "A"}}

    first = client.post("/api/mobile/selection/resolve", json=payload)
    assert first.status_code == 200
    first_session_id = first.json()["session_id"]

    with TestClient(client.app) as another_device:
        second = another_device.post("/api/mobile/selection/resolve", json=payload)
        assert second.status_code == 200
        second_session_id = second.json()["session_id"]

        deleted = another_device.post(
            "/api/mobile/selection/sessions/batch/delete",
            json={"ids": [second_session_id, first_session_id, "missing-id"]},
        )
        assert deleted.status_code == 200
        body = deleted.json()
        assert body["deleted_ids"] == [second_session_id]
        assert body["forbidden_ids"] == [first_session_id]
        assert body["not_found_ids"] == ["missing-id"]

        listed = another_device.get("/api/mobile/selection/sessions")
        assert listed.status_code == 200
        listed_ids = [item["session_id"] for item in listed.json()]
        assert second_session_id not in listed_ids

    listed_self = client.get("/api/mobile/selection/sessions")
    assert listed_self.status_code == 200
    listed_self_ids = [item["session_id"] for item in listed_self.json()]
    assert first_session_id in listed_self_ids


def test_mobile_selection_resolve_with_forwarded_device_header(test_client, monkeypatch: pytest.MonkeyPatch):
    client, _ = test_client
    _install_fake_ingest_pipeline(
        monkeypatch,
        {
            "category": "lotion",
            "brand": "CeraVe",
            "name": "Lotion Header",
            "one_sentence": "header 归属测试",
        },
    )
    _ingest_one(client, "lotion.jpg")

    headers = {"x-mobile-device-id": "device-header-001"}
    payload = {
        "category": "lotion",
        "answers": {
            "group": "dry-tight",
            "issue": "itch-flake",
            "scene": "after-shower",
            "avoid": "none",
        },
    }
    resolved = client.post("/api/mobile/selection/resolve", json=payload, headers=headers)
    assert resolved.status_code == 200
    session_id = resolved.json()["session_id"]

    listed_same_owner = client.get("/api/mobile/selection/sessions", headers=headers)
    assert listed_same_owner.status_code == 200
    ids_same_owner = [item["session_id"] for item in listed_same_owner.json()]
    assert session_id in ids_same_owner

    listed_other_owner = client.get(
        "/api/mobile/selection/sessions",
        headers={"x-mobile-device-id": "device-header-002"},
    )
    assert listed_other_owner.status_code == 200
    ids_other_owner = [item["session_id"] for item in listed_other_owner.json()]
    assert session_id not in ids_other_owner
