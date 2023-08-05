import asyncio
import json
import logging

from websockets.client import WebSocketClientProtocol, connect
from typing import Callable, Optional, Any, Dict, Awaitable, List
from pydantic import BaseModel, PrivateAttr
from jsonrpcclient import request_json, Ok, parse_json
from websockets.typing import Data

from e2b.utils.future import DeferredFuture

logger = logging.getLogger(__name__)


class SessionDaemon(BaseModel):
    url: str
    on_close: Callable[[], Awaitable[None]]
    on_message: Callable[[Any], None]

    _waiting_for_replies: Dict[str, DeferredFuture] = PrivateAttr(default_factory=dict)
    _ws: Optional[WebSocketClientProtocol] = PrivateAttr()

    class Config:
        arbitrary_types_allowed = True

    async def connect(self):
        self._ws = await connect(self.url)

        async def handle_messages():
            if not self._ws:
                raise Exception("Not connected")
            async for message in self._ws:
                await self._receive_message(message)
            await self.on_close()

        asyncio.create_task(handle_messages())

    async def send_message(self, method: str, params: List[Any]) -> Any:
        if not self._ws:
            raise Exception("Not connected")

        request = request_json(method, params)
        request_with_id = json.loads(request)

        logger.info(f"Sending request: {request_with_id}")

        future_reply = DeferredFuture()

        try:
            self._waiting_for_replies[request_with_id["id"]] = future_reply
            await self._ws.send(request)
            r = await future_reply
            logger.info(f"Received reply: {r}")
            return r
        except Exception as e:
            logger.info(f"Error: {request_with_id} {e}")
            raise e
        finally:
            del self._waiting_for_replies[request_with_id["id"]]

    async def _receive_message(self, message: Data):
        data = parse_json(message)
        if id := getattr(data, "id"):
            if id in self._waiting_for_replies and self._waiting_for_replies[id]:
                if isinstance(data, Ok):
                    self._waiting_for_replies[id](getattr(data, "result"))
                else:
                    logger.info(f"Error: {data}")
                    self._waiting_for_replies[id].reject(Exception(data))
        else:
            self.on_message(data)

    async def close(self):
        if self._ws:
            await self._ws.close()
        if self.on_close:
            await self.on_close()
