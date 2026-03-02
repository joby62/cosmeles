from app.services.doubao_openai_client import DoubaoOpenAIClient


class _FakeFinalResponse:
    def model_dump(self, mode="json"):
        return {"output_text": "fallback-ok"}


class _FakeResponses:
    def stream(self, **_kwargs):
        raise AttributeError("'NoneType' object has no attribute 'append'")

    def create(self, **_kwargs):
        return _FakeFinalResponse()


class _FakeOpenAIClient:
    def __init__(self):
        self.responses = _FakeResponses()


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
