from typing import Any
from langchain.callbacks.base import AsyncCallbackHandler
from langchain.schema import LLMResult
from pydantic import PrivateAttr

from agent.tokens.token_streamer import TokenStreamer


class LogsCallbackHandler(AsyncCallbackHandler):
    def __init__(self, streamer: TokenStreamer) -> None:
        super().__init__()
        self.streamer = streamer

    async def on_llm_new_token(self, token: str, **kwargs: Any) -> None:
        """Run on new LLM token. Only available when streaming is enabled."""
        await self.streamer.ingest(token)

    async def on_llm_end(self, response: LLMResult, **kwargs: Any):
        await self.streamer.close()
