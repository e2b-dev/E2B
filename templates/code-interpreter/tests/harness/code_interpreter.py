"""httpx client for the Code Interpreter HTTP API (port 49999).

Mirrors the wire protocol only: JSON requests and a newline-delimited JSON
stream of output events terminated by ``{"type": "end_of_execution"}``.
"""

import json
import textwrap
from dataclasses import dataclass, field
from typing import AsyncIterator, Iterator, Optional

import httpx

KERNEL_READINESS_ATTEMPTS = 4
DEFAULT_EXECUTION_TIMEOUT = 60
DEFAULT_REQUEST_TIMEOUT = 30

DATA_FORMATS = (
    "text",
    "html",
    "markdown",
    "svg",
    "png",
    "jpeg",
    "pdf",
    "latex",
    "json",
    "javascript",
    "data",
    "chart",
)


class CodeInterpreterError(Exception):
    def __init__(self, response: httpx.Response):
        self.status_code = response.status_code
        self.body = response.text
        super().__init__(
            f"{response.status_code} {response.reason_phrase}: {self.body}"
        )


@dataclass
class Result:
    raw: dict

    def __getattr__(self, name: str):
        if name in DATA_FORMATS or name in ("extra", "is_main_result"):
            return self.raw.get(name)
        raise AttributeError(name)

    def formats(self) -> list[str]:
        return [fmt for fmt in DATA_FORMATS if self.raw.get(fmt) is not None]


@dataclass
class ExecutionError:
    name: str
    value: str
    traceback: str


@dataclass
class Execution:
    events: list[dict] = field(default_factory=list)
    results: list[Result] = field(default_factory=list)
    stdout: list[str] = field(default_factory=list)
    stderr: list[str] = field(default_factory=list)
    error: Optional[ExecutionError] = None
    execution_count: Optional[int] = None
    completed: bool = False

    @property
    def text(self) -> Optional[str]:
        for result in self.results:
            if result.is_main_result:
                return result.text
        return None

    def add(self, event: dict) -> None:
        self.events.append(event)
        kind = event["type"]
        if kind == "stdout":
            self.stdout.append(event["text"])
        elif kind == "stderr":
            self.stderr.append(event["text"])
        elif kind == "result":
            self.results.append(Result({k: v for k, v in event.items() if k != "type"}))
        elif kind == "error":
            self.error = ExecutionError(
                name=event["name"], value=event["value"], traceback=event["traceback"]
            )
        elif kind == "number_of_executions":
            self.execution_count = event["execution_count"]
        elif kind == "end_of_execution":
            self.completed = True

    @classmethod
    def from_events(cls, events) -> "Execution":
        execution = cls()
        for event in events:
            execution.add(event)
        return execution


def _headers(
    envd_access_token: Optional[str], traffic_access_token: Optional[str]
) -> dict[str, str]:
    headers = {}
    if envd_access_token:
        headers["X-Access-Token"] = envd_access_token
    if traffic_access_token:
        headers["E2B-Traffic-Access-Token"] = traffic_access_token
    return headers


def _execute_body(
    code: str,
    language: Optional[str],
    context_id: Optional[str],
    envs: Optional[dict[str, str]],
) -> dict:
    return {
        "code": textwrap.dedent(code),
        "language": language,
        "context_id": context_id,
        "env_vars": envs,
    }


def _is_readiness_error(error: Exception) -> bool:
    return isinstance(error, CodeInterpreterError) and error.status_code == 500


class CodeInterpreter:
    def __init__(
        self,
        base_url: str,
        *,
        envd_access_token: Optional[str] = None,
        traffic_access_token: Optional[str] = None,
    ):
        self.base_url = base_url
        self._client = httpx.Client(
            base_url=base_url,
            headers=_headers(envd_access_token, traffic_access_token),
            timeout=DEFAULT_REQUEST_TIMEOUT,
        )

    def close(self) -> None:
        self._client.close()

    def health(self, timeout: float = DEFAULT_REQUEST_TIMEOUT) -> httpx.Response:
        return self._client.get("/health", timeout=timeout)

    def stream_code(
        self,
        code: str,
        *,
        language: Optional[str] = None,
        context_id: Optional[str] = None,
        envs: Optional[dict[str, str]] = None,
        timeout: float = DEFAULT_EXECUTION_TIMEOUT,
    ) -> Iterator[dict]:
        with self._client.stream(
            "POST",
            "/execute",
            json=_execute_body(code, language, context_id, envs),
            timeout=httpx.Timeout(timeout, connect=DEFAULT_REQUEST_TIMEOUT),
        ) as response:
            if response.status_code >= 400:
                response.read()
                raise CodeInterpreterError(response)
            for line in response.iter_lines():
                if line:
                    yield json.loads(line)

    def run_code(
        self,
        code: str,
        *,
        language: Optional[str] = None,
        context_id: Optional[str] = None,
        envs: Optional[dict[str, str]] = None,
        timeout: float = DEFAULT_EXECUTION_TIMEOUT,
    ) -> Execution:
        return Execution.from_events(
            self.stream_code(
                code,
                language=language,
                context_id=context_id,
                envs=envs,
                timeout=timeout,
            )
        )

    def wait_for_kernel(self, language: str) -> None:
        for attempt in range(KERNEL_READINESS_ATTEMPTS):
            try:
                self.run_code("1", language=language)
                return
            except CodeInterpreterError as error:
                if (
                    not _is_readiness_error(error)
                    or attempt == KERNEL_READINESS_ATTEMPTS - 1
                ):
                    raise

    def _check(self, response: httpx.Response) -> httpx.Response:
        if response.status_code >= 400:
            raise CodeInterpreterError(response)
        return response

    def create_context(
        self, *, language: Optional[str] = None, cwd: Optional[str] = None
    ) -> dict:
        body = {}
        if language is not None:
            body["language"] = language
        if cwd is not None:
            body["cwd"] = cwd
        return self._check(self._client.post("/contexts", json=body)).json()

    def list_contexts(self) -> list[dict]:
        return self._check(self._client.get("/contexts")).json()

    def restart_context(self, context_id: str) -> None:
        self._check(self._client.post(f"/contexts/{context_id}/restart"))

    def remove_context(self, context_id: str) -> None:
        self._check(self._client.delete(f"/contexts/{context_id}"))


class AsyncCodeInterpreter:
    def __init__(
        self,
        base_url: str,
        *,
        envd_access_token: Optional[str] = None,
        traffic_access_token: Optional[str] = None,
    ):
        self.base_url = base_url
        self._client = httpx.AsyncClient(
            base_url=base_url,
            headers=_headers(envd_access_token, traffic_access_token),
            timeout=DEFAULT_REQUEST_TIMEOUT,
        )

    async def aclose(self) -> None:
        await self._client.aclose()

    async def health(self, timeout: float = DEFAULT_REQUEST_TIMEOUT) -> httpx.Response:
        return await self._client.get("/health", timeout=timeout)

    async def stream_code(
        self,
        code: str,
        *,
        language: Optional[str] = None,
        context_id: Optional[str] = None,
        envs: Optional[dict[str, str]] = None,
        timeout: float = DEFAULT_EXECUTION_TIMEOUT,
    ) -> AsyncIterator[dict]:
        async with self._client.stream(
            "POST",
            "/execute",
            json=_execute_body(code, language, context_id, envs),
            timeout=httpx.Timeout(timeout, connect=DEFAULT_REQUEST_TIMEOUT),
        ) as response:
            if response.status_code >= 400:
                await response.aread()
                raise CodeInterpreterError(response)
            async for line in response.aiter_lines():
                if line:
                    yield json.loads(line)

    async def run_code(
        self,
        code: str,
        *,
        language: Optional[str] = None,
        context_id: Optional[str] = None,
        envs: Optional[dict[str, str]] = None,
        timeout: float = DEFAULT_EXECUTION_TIMEOUT,
    ) -> Execution:
        execution = Execution()
        async for event in self.stream_code(
            code, language=language, context_id=context_id, envs=envs, timeout=timeout
        ):
            execution.add(event)
        return execution

    async def wait_for_kernel(self, language: str) -> None:
        for attempt in range(KERNEL_READINESS_ATTEMPTS):
            try:
                await self.run_code("1", language=language)
                return
            except CodeInterpreterError as error:
                if (
                    not _is_readiness_error(error)
                    or attempt == KERNEL_READINESS_ATTEMPTS - 1
                ):
                    raise
