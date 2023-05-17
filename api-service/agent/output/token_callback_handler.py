from typing import Any
from langchain.callbacks.base import AsyncCallbackHandler
from langchain.schema import LLMResult
from asyncio import Queue


class TokenCallbackHandler(AsyncCallbackHandler):
    def __init__(self, **kwargs) -> None:
        super().__init__(**kwargs)
        self._queue: Queue[str | None] = Queue(1)

    async def on_llm_new_token(self, token: str, **kwargs: Any) -> None:
        """Run on new LLM token. Only available when streaming is enabled."""
        await self._ingest_token(token)

    async def on_llm_end(self, response: LLMResult, **kwargs: Any):
        await self._close_token_stream()

    async def retrieve_token(self):
        token = await self._queue.get()
        self._queue.task_done()
        return token

    async def _ingest_token(self, token: str):
        await self._queue.put(token)

    async def _close_token_stream(self):
        await self._queue.put(None)
