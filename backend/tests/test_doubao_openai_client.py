from app.services.doubao_openai_client import DoubaoOpenAIClient


class _FakeFinalResponse:
    def model_dump(self, mode="json"):
        return {"output_text": "fallback-ok"}


class _FakeEventStream:
    def __iter__(self):
        yield {"type": "response.output_text.delta", "delta": "hello "}
        yield {"type": "response.output_text.delta", "delta": "world"}
        yield {"type": "response.completed", "response": {"output_text": "hello world"}}


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


class _FakeOpenAIClient:
    def __init__(self):
        self.responses = _FakeResponses()


class _FakeOpenAIClientStreamOK:
    def __init__(self):
        self.responses = _FakeResponsesStreamOK()


def test_stream_fallback_to_non_stream_on_sdk_internal_error():
    client = DoubaoOpenAIClient(
        api_key="dummy",
        endpoint="https://ark.cn-beijing.volces.com/api/v3",
        model="doubao-seed-2-0-mini-260215",
        timeout=5,
    )
    client.client = _FakeOpenAIClient()

    chunks: list[str] = []
    resp = client.chat_with_text(
        "hello",
        stream=True,
        on_text_delta=lambda delta: chunks.append(delta),
    )

    assert resp["output_text"] == "fallback-ok"
    assert "_stream_fallback_error" in resp
    assert "NoneType" in str(resp["_stream_fallback_error"])
    assert "fallback-ok" in "".join(chunks)


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
