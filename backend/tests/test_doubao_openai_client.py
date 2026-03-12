import pytest

from app.services.doubao_openai_client import DoubaoOpenAIClient


class _FakeFinalResponse:
    def model_dump(self, mode="json"):
        return {"output_text": "fallback-ok"}


class _FakeEventStream:
    def __iter__(self):
        yield {"type": "response.output_text.delta", "delta": "hello "}
        yield {"type": "response.output_text.delta", "delta": "world"}
        yield {"type": "response.completed", "response": {"output_text": "hello world"}}


class _FakeReasoningEventStream:
    def __iter__(self):
        yield {"type": "response.reasoning_summary_text.delta", "delta": "先看配方。"}
        yield {"type": "response.output_text.delta", "delta": "结论A"}
        yield {"type": "response.reasoning_summary_text.done", "text": "先看配方。"}
        yield {"type": "response.output_text.done", "text": "结论A"}
        yield {"type": "response.completed", "response": {"output_text": "结论A"}}


class _FakeResponses:
    def create(self, **kwargs):
        if kwargs.get("stream"):
            raise AttributeError("'NoneType' object has no attribute 'append'")
        return _FakeFinalResponse()


class _FakeResponsesStreamOK:
    def create(self, **kwargs):
        if kwargs.get("stream"):
            return _FakeEventStream()
        return _FakeFinalResponse()


class _FakeResponsesReasoningStreamOK:
    def create(self, **kwargs):
        if kwargs.get("stream"):
            return _FakeReasoningEventStream()
        return _FakeFinalResponse()


class _FakeOpenAIClient:
    def __init__(self):
        self.responses = _FakeResponses()


class _FakeOpenAIClientStreamOK:
    def __init__(self):
        self.responses = _FakeResponsesStreamOK()


class _FakeOpenAIClientReasoningStreamOK:
    def __init__(self):
        self.responses = _FakeResponsesReasoningStreamOK()


def test_stream_raises_runtime_error_on_sdk_internal_error():
    client = DoubaoOpenAIClient(
        api_key="dummy",
        endpoint="https://ark.cn-beijing.volces.com/api/v3",
        model="doubao-seed-2-0-mini-260215",
        timeout=5,
    )
    client.client = _FakeOpenAIClient()

    with pytest.raises(RuntimeError, match="Doubao stream request failed"):
        client.chat_with_text(
            "hello",
            stream=True,
            on_text_delta=lambda _delta: None,
        )


def test_stream_extracts_text_delta_from_create_stream_events():
    client = DoubaoOpenAIClient(
        api_key="dummy",
        endpoint="https://ark.cn-beijing.volces.com/api/v3",
        model="doubao-seed-2-0-mini-260215",
        timeout=5,
    )
    client.client = _FakeOpenAIClientStreamOK()

    chunks: list[str] = []
    resp = client.chat_with_text(
        "hello",
        stream=True,
        on_text_delta=lambda delta: chunks.append(delta),
    )

    assert resp["output_text"] == "hello world"
    assert "".join(chunks) == "hello world"


def test_stream_emits_reasoning_summary_events_without_polluting_output_deltas():
    client = DoubaoOpenAIClient(
        api_key="dummy",
        endpoint="https://ark.cn-beijing.volces.com/api/v3",
        model="doubao-seed-2-0-mini-260215",
        timeout=5,
    )
    client.client = _FakeOpenAIClientReasoningStreamOK()

    chunks: list[str] = []
    stream_events: list[dict[str, str]] = []
    resp = client.chat_with_text(
        "hello",
        stream=True,
        on_text_delta=lambda delta: chunks.append(delta),
        on_stream_event=lambda event: stream_events.append(event),
    )

    assert resp["output_text"] == "结论A"
    assert "".join(chunks) == "结论A"
    assert stream_events == [
        {
            "kind": "reasoning_summary_delta",
            "field": "response.reasoning_summary_text.delta.delta",
            "delta": "先看配方。",
        },
        {
            "kind": "output_text_delta",
            "field": "response.output_text.delta.delta",
            "delta": "结论A",
        },
        {
            "kind": "reasoning_summary_done",
            "field": "response.reasoning_summary_text.done.text",
            "text": "先看配方。",
        },
        {
            "kind": "output_text_done",
            "field": "response.output_text.done.text",
            "text": "结论A",
        },
    ]
