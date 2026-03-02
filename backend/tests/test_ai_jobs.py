import pytest

from app.ai.capabilities import CapabilityExecutionResult
from app.ai.errors import AIServiceError
from app.ai import orchestrator as orchestrator_module
from app.settings import settings


def test_ai_job_create_and_list(test_client, monkeypatch: pytest.MonkeyPatch):
    client, _ = test_client

    def fake_execute(capability: str, input_payload: dict, trace_id: str | None = None, event_callback=None):
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


def test_ai_job_dedup_capability(test_client, monkeypatch: pytest.MonkeyPatch):
    client, _ = test_client

    def fake_execute(capability: str, input_payload: dict, trace_id: str | None = None, event_callback=None):
        assert capability == "doubao.product_dedup_decision"
        assert trace_id == "trace-dedup"
        assert "candidate_json" in input_payload
        assert isinstance(input_payload.get("existing_jsons"), list)
        return CapabilityExecutionResult(
            output={"analysis_text": "疑似重复，建议人工复核"},
            prompt_key="doubao.product_dedup_decision",
            prompt_version="v1",
            model="doubao-seed-2-0-mini-260215",
            request_payload={"prompt": "test"},
            response_payload={"output_text": "疑似重复，建议人工复核"},
        )

    monkeypatch.setattr(orchestrator_module, "execute_capability", fake_execute)

    resp = client.post(
        "/api/ai/jobs",
        json={
            "capability": "doubao.product_dedup_decision",
            "input": {"candidate_json": "{\"a\":1}", "existing_jsons": ["{\"b\":2}"]},
            "trace_id": "trace-dedup",
            "run_immediately": True,
        },
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "succeeded"
    assert body["output"]["analysis_text"] == "疑似重复，建议人工复核"


def test_ai_job_stream_endpoint(test_client, monkeypatch: pytest.MonkeyPatch):
    client, _ = test_client

    def fake_execute(capability: str, input_payload: dict, trace_id: str | None = None, event_callback=None):
        if event_callback:
            event_callback({"type": "step", "stage": "ingredient_enrich", "message": "calling model"})
            event_callback({"type": "delta", "stage": "ingredient_enrich", "delta": "部分输出"})
        return CapabilityExecutionResult(
            output={"analysis_text": "完整输出"},
            prompt_key=capability,
            prompt_version="v1",
            model="doubao-seed-2-0-pro-260215",
            request_payload={"prompt": "test"},
            response_payload={"output_text": "完整输出"},
        )

    monkeypatch.setattr(orchestrator_module, "execute_capability", fake_execute)

    resp = client.post(
        "/api/ai/jobs/stream",
        json={
            "capability": "doubao.ingredient_enrich",
            "input": {"ingredient": "烟酰胺"},
            "trace_id": "trace-stream-1",
            "run_immediately": True,
        },
    )
    assert resp.status_code == 200
    text = resp.text
    assert "event: job_created" in text
    assert "event: progress" in text
    assert "event: result" in text
    assert "完整输出" in text
    assert "event: done" in text


def test_ai_metrics_summary(test_client, monkeypatch: pytest.MonkeyPatch):
    client, _ = test_client
    monkeypatch.setattr(
        settings,
        "ai_cost_per_run_by_model_json",
        '{"doubao-seed-2-0-mini-260215": 0.12}',
    )

    def fake_execute(capability: str, input_payload: dict, trace_id: str | None = None, event_callback=None):
        if input_payload.get("mode") == "timeout":
            raise AIServiceError(
                code="doubao_request_failed",
                message="Doubao API timeout.",
                http_status=502,
            )
        return CapabilityExecutionResult(
            output={"analysis_text": "ok"},
            prompt_key=capability,
            prompt_version="v1",
            model="doubao-seed-2-0-mini-260215",
            request_payload={"prompt": "test"},
            response_payload={"output_text": "ok"},
        )

    monkeypatch.setattr(orchestrator_module, "execute_capability", fake_execute)

    ok_job = client.post(
        "/api/ai/jobs",
        json={
            "capability": "doubao.ingredient_enrich",
            "input": {"ingredient": "烟酰胺"},
            "trace_id": "trace-metrics-1",
            "run_immediately": True,
        },
    )
    assert ok_job.status_code == 200
    assert ok_job.json()["status"] == "succeeded"

    fail_job = client.post(
        "/api/ai/jobs",
        json={
            "capability": "doubao.ingredient_enrich",
            "input": {"ingredient": "烟酰胺", "mode": "timeout"},
            "trace_id": "trace-metrics-2",
            "run_immediately": True,
        },
    )
    assert fail_job.status_code == 200
    assert fail_job.json()["status"] == "failed"

    metrics = client.get("/api/ai/metrics/summary", params={"since_hours": 24})
    assert metrics.status_code == 200
    body = metrics.json()
    assert body["total_jobs"] == 2
    assert body["succeeded_jobs"] == 1
    assert body["failed_jobs"] == 1
    assert body["success_rate"] == 0.5
    assert body["timeout_failures"] == 1
    assert body["timeout_rate"] == 0.5
    assert body["total_runs"] == 2
    assert body["priced_runs"] == 1
    assert body["cost_coverage_rate"] == 0.5
    assert body["total_estimated_cost"] == pytest.approx(0.12)
    assert body["avg_task_cost"] == pytest.approx(0.12)


def test_ai_metrics_summary_token_pricing(test_client, monkeypatch: pytest.MonkeyPatch):
    client, _ = test_client
    monkeypatch.setattr(settings, "ai_cost_per_run_by_model_json", "")
    monkeypatch.setattr(
        settings,
        "ai_model_pricing_per_mtoken_json",
        '{"doubao-seed-2-0-pro-260215":{"input":3.2,"output":16,"cache_hit":0.64}}',
    )

    def fake_execute(capability: str, input_payload: dict, trace_id: str | None = None, event_callback=None):
        return CapabilityExecutionResult(
            output={"analysis_text": "ok"},
            prompt_key=capability,
            prompt_version="v1",
            model="doubao-seed-2-0-pro-260215",
            request_payload={"prompt": "test"},
            response_payload={
                "output_text": "ok",
                "usage": {
                    "input_tokens": 1_000_000,
                    "output_tokens": 100_000,
                    "input_tokens_details": {"cached_tokens": 200_000},
                },
            },
        )

    monkeypatch.setattr(orchestrator_module, "execute_capability", fake_execute)

    ok_job = client.post(
        "/api/ai/jobs",
        json={
            "capability": "doubao.ingredient_enrich",
            "input": {"ingredient": "烟酰胺"},
            "trace_id": "trace-metrics-token-1",
            "run_immediately": True,
        },
    )
    assert ok_job.status_code == 200
    assert ok_job.json()["status"] == "succeeded"

    metrics = client.get("/api/ai/metrics/summary", params={"since_hours": 24})
    assert metrics.status_code == 200
    body = metrics.json()
    assert body["total_jobs"] == 1
    assert body["succeeded_jobs"] == 1
    assert body["failed_jobs"] == 0
    assert body["priced_runs"] == 1
    assert body["cost_coverage_rate"] == 1.0
    # (1,000,000-200,000)/1e6*3.2 + 100,000/1e6*16 + 200,000/1e6*0.64 = 4.288
    assert body["total_estimated_cost"] == pytest.approx(4.288)
    assert body["avg_task_cost"] == pytest.approx(4.288)
