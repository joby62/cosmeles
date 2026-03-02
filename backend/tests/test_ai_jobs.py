import pytest

from app.ai.capabilities import CapabilityExecutionResult
from app.ai import orchestrator as orchestrator_module


def test_ai_job_create_and_list(test_client, monkeypatch: pytest.MonkeyPatch):
    client, _ = test_client

    def fake_execute(capability: str, input_payload: dict, trace_id: str | None = None):
        assert capability == "doubao.ingredient_enrich"
        assert input_payload["ingredient"] == "烟酰胺"
        assert trace_id == "trace-123"
        return CapabilityExecutionResult(
            output={"analysis_text": "这是测试输出"},
            prompt_key="doubao.ingredient_enrich",
            prompt_version="v1",
            model="doubao-seed-2-0-mini-260215",
            request_payload={"prompt": "test"},
            response_payload={"output_text": "这是测试输出"},
        )

    monkeypatch.setattr(orchestrator_module, "execute_capability", fake_execute)

    create = client.post(
        "/api/ai/jobs",
        json={
            "capability": "doubao.ingredient_enrich",
            "input": {"ingredient": "烟酰胺", "context": "测试"},
            "trace_id": "trace-123",
            "run_immediately": True,
        },
    )
    assert create.status_code == 200
    job = create.json()
    assert job["status"] == "succeeded"
    assert job["capability"] == "doubao.ingredient_enrich"
    assert job["output"]["analysis_text"] == "这是测试输出"
    assert job["prompt_version"] == "v1"

    query = client.get("/api/ai/jobs", params={"capability": "doubao.ingredient_enrich"})
    assert query.status_code == 200
    jobs = query.json()
    assert len(jobs) == 1
    assert jobs[0]["id"] == job["id"]

    runs = client.get("/api/ai/runs", params={"job_id": job["id"]})
    assert runs.status_code == 200
    run_items = runs.json()
    assert len(run_items) == 1
    assert run_items[0]["status"] == "succeeded"
    assert run_items[0]["model"] == "doubao-seed-2-0-mini-260215"
