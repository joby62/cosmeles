import pytest
from fastapi.testclient import TestClient

from app.routes import ingest as ingest_routes
from app.routes import products as products_routes


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


def _install_fake_route_mapping_builder(monkeypatch: pytest.MonkeyPatch) -> None:
    def fake_run_capability_now(*, capability, input_payload, trace_id=None, event_callback=None):
        if event_callback:
            event_callback({"type": "step", "stage": capability, "message": "mock route mapping"})
        if capability == "doubao.route_mapping_shampoo":
            return {
                "category": "shampoo",
                "rules_version": "2026-03-03.1",
                "primary_route": {
                    "route_key": "volume-support",
                    "route_title": "蓬松支撑型",
                    "confidence": 93,
                    "reason": "mock",
                },
                "secondary_route": {
                    "route_key": "deep-oil-control",
                    "route_title": "深层控油型",
                    "confidence": 72,
                    "reason": "mock",
                },
                "route_scores": [
                    {"route_key": "volume-support", "route_title": "蓬松支撑型", "confidence": 93, "reason": "mock"},
                    {"route_key": "deep-oil-control", "route_title": "深层控油型", "confidence": 72, "reason": "mock"},
                    {"route_key": "gentle-soothing", "route_title": "温和舒缓型", "confidence": 36, "reason": "mock"},
                    {"route_key": "deep-repair", "route_title": "深度修护型", "confidence": 24, "reason": "mock"},
                    {"route_key": "anti-dandruff-itch", "route_title": "去屑止痒型", "confidence": 10, "reason": "mock"},
                ],
                "evidence": {"positive": [], "counter": []},
                "confidence_reason": "mock",
                "needs_review": False,
                "analysis_text": "{\"mock\":true}",
                "model": "mock-pro",
            }
        if capability == "doubao.route_mapping_bodywash":
            return {
                "category": "bodywash",
                "rules_version": "2026-03-03.1",
                "primary_route": {
                    "route_key": "rescue",
                    "route_title": "恒温舒缓修护型",
                    "confidence": 95,
                    "reason": "mock",
                },
                "secondary_route": {
                    "route_key": "shield",
                    "route_title": "脂类补充油膏型",
                    "confidence": 60,
                    "reason": "mock",
                },
                "route_scores": [
                    {"route_key": "rescue", "route_title": "恒温舒缓修护型", "confidence": 95, "reason": "mock"},
                    {"route_key": "shield", "route_title": "脂类补充油膏型", "confidence": 60, "reason": "mock"},
                    {"route_key": "vibe", "route_title": "轻盈香氛平衡型", "confidence": 52, "reason": "mock"},
                    {"route_key": "glow", "route_title": "氨基酸亮肤型", "confidence": 44, "reason": "mock"},
                    {"route_key": "purge", "route_title": "水杨酸净彻控油型", "confidence": 31, "reason": "mock"},
                    {"route_key": "polish", "route_title": "乳酸尿素更新型", "confidence": 20, "reason": "mock"},
                ],
                "evidence": {"positive": [], "counter": []},
                "confidence_reason": "mock",
                "needs_review": False,
                "analysis_text": "{\"mock\":true}",
                "model": "mock-pro",
            }
        raise AssertionError(f"unexpected capability: {capability}")

    monkeypatch.setattr(products_routes, "run_capability_now", fake_run_capability_now)


def _build_route_mapping(client, category: str) -> None:
    resp = client.post(
        "/api/products/route-mapping/build",
        json={"category": category, "force_regenerate": True},
    )
    assert resp.status_code == 200
    payload = resp.json()
    assert payload["failed"] == 0
    assert payload["submitted_to_model"] >= 1


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
    _install_fake_route_mapping_builder(monkeypatch)
    _build_route_mapping(client, "shampoo")

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
    _install_fake_route_mapping_builder(monkeypatch)
    _build_route_mapping(client, "bodywash")

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
    _install_fake_route_mapping_builder(monkeypatch)
    _build_route_mapping(client, "shampoo")

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
    _install_fake_route_mapping_builder(monkeypatch)
    _build_route_mapping(client, "bodywash")

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


def test_mobile_selection_pin_and_list_order(test_client, monkeypatch: pytest.MonkeyPatch):
    client, _ = test_client
    _install_fake_ingest_pipeline(
        monkeypatch,
        {
            "category": "shampoo",
            "brand": "Dove",
            "name": "Pin Order",
            "one_sentence": "置顶排序测试",
        },
    )
    _ingest_one(client, "pin-order.jpg")
    _install_fake_route_mapping_builder(monkeypatch)
    _build_route_mapping(client, "shampoo")

    first = client.post(
        "/api/mobile/selection/resolve",
        json={"category": "shampoo", "answers": {"q1": "A", "q2": "C", "q3": "B"}, "reuse_existing": False},
    )
    assert first.status_code == 200
    first_id = first.json()["session_id"]

    second = client.post(
        "/api/mobile/selection/resolve",
        json={"category": "shampoo", "answers": {"q1": "C", "q2": "C", "q3": "A"}, "reuse_existing": False},
    )
    assert second.status_code == 200
    second_id = second.json()["session_id"]
    assert first_id != second_id

    pin_resp = client.post(
        f"/api/mobile/selection/sessions/{first_id}/pin",
        json={"pinned": True},
    )
    assert pin_resp.status_code == 200
    pinned = pin_resp.json()
    assert pinned["session_id"] == first_id
    assert pinned["is_pinned"] is True
    assert pinned["pinned_at"]

    listed = client.get("/api/mobile/selection/sessions")
    assert listed.status_code == 200
    rows = listed.json()
    assert rows[0]["session_id"] == first_id
    assert rows[0]["is_pinned"] is True
    assert rows[1]["session_id"] == second_id

    unpin_resp = client.post(
        f"/api/mobile/selection/sessions/{first_id}/pin",
        json={"pinned": False},
    )
    assert unpin_resp.status_code == 200
    unpinned = unpin_resp.json()
    assert unpinned["is_pinned"] is False
    assert unpinned["pinned_at"] is None
