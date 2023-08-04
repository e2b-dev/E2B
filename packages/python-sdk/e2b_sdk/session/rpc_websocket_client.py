import asyncio
import json

from websockets.client import WebSocketClientProtocol, connect
from websockets.exceptions import WebSocketException
from typing import Callable, Optional, Any, Dict
from pydantic import BaseModel, PrivateAttr
from jsonrpcclient import request_json, Ok, parse_json, Error
from websockets.typing import Data

from e2b_sdk.utils.future import DeferredFuture


class RpcWebSocketClient(BaseModel):
    url: str = PrivateAttr()
    on_open: Callable[[], None] = PrivateAttr()
    on_error: Callable[[], None] = PrivateAttr()
    on_close: Callable[[], None] = PrivateAttr()
    on_message: Callable[[Any], None] = PrivateAttr()

    waiting_for_replies: Dict[str, DeferredFuture] = PrivateAttr()

    ws: Optional[WebSocketClientProtocol] = PrivateAttr()

    async def connect(self):
        future_connect = DeferredFuture()

        async def connect_with_reconnect(retries=2):
            for i in range(retries + 1):
                try:
                    async with connect(self.url) as self.ws:
                        self.on_open()
                        future_connect(None)
                        async for message in self.ws:
                            asyncio.create_task(self._receive_message(message))
                except (WebSocketException, OSError):
                    self.on_error()
                    print("Connection error occurred. Reconnecting...")
                    await asyncio.sleep(2**i)
                self.on_close()
            print("Connection retries exceeded.")

        asyncio.create_task(connect_with_reconnect())
        await future_connect

    async def send_message(self, message, *params) -> Any:
        if not self.ws:
            raise Exception("Not connected")

        request = request_json(message, list(params))
        request_with_id = json.loads(request)

        future_reply = DeferredFuture()

        try:
            self.waiting_for_replies[request_with_id["id"]] = future_reply
            await self.ws.send(request)
            return await future_reply
        finally:
            del self.waiting_for_replies[request_with_id["id"]]

    async def _receive_message(self, message: Data):
        data = parse_json(message)
        if id := getattr(data, "id"):
            if id in self.waiting_for_replies:
                if isinstance(data, Ok):
                    self.waiting_for_replies[id](data)
                elif isinstance(data, Error):
                    self.waiting_for_replies[id].reject(data)
        else:
            self.on_message(data)

    async def close(self):
        if self.ws:
            await self.ws.close()
        if self.on_close:
            self.on_close()
