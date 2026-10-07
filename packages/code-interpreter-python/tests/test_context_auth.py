import inspect

import httpx
import pytest

from e2b.connection_config import ConnectionConfig
from e2b_code_interpreter import AsyncSandbox, Sandbox
from e2b_code_interpreter import code_interpreter_async, code_interpreter_sync


@pytest.mark.parametrize(
    "cls,module",
    [(Sandbox, code_interpreter_sync), (AsyncSandbox, code_interpreter_async)],
)
@pytest.mark.parametrize("token", ["sandbox-token", None])
async def test_context_operations_forward_auth(cls, module, token, monkeypatch):
    context = {"id": "context-id", "language": "python", "cwd": "/home/user"}
    requests = []

    def handle(request):
        requests.append(request)
        if request.headers.get("X-Access-Token") != token:
            return httpx.Response(401, text="Unauthorized")
        return httpx.Response(
            200, json=[context] if request.method == "GET" else context
        )

    monkeypatch.setattr(
        module, "get_transport", lambda *args, **kwargs: httpx.MockTransport(handle)
    )
    sandbox = cls(
        sandbox_id="sandbox-id",
        sandbox_domain=None,
        envd_version="0.2.0",
        envd_access_token=token,
        traffic_access_token="traffic-token",
        connection_config=ConnectionConfig(
            sandbox_url="https://interpreter.example.test"
        ),
    )

    async def call(method, *args):
        result = method(*args)
        return await result if inspect.isawaitable(result) else result

    try:
        assert (await call(sandbox.create_code_context)).id == context["id"]
        assert (await call(sandbox.list_code_contexts))[0].id == context["id"]
        await call(sandbox.restart_code_context, context["id"])
        await call(sandbox.remove_code_context, context["id"])
    finally:
        if cls is AsyncSandbox:
            await sandbox._client.aclose()
        else:
            sandbox._client.close()

    assert len(requests) == 4
    for request in requests:
        assert request.headers.get("X-Access-Token") == token
        assert request.headers["E2B-Traffic-Access-Token"] == "traffic-token"
        assert request.headers["E2b-Sandbox-Id"] == "sandbox-id"
        assert request.headers["E2b-Sandbox-Port"] == "49999"
