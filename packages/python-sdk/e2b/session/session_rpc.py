import asyncio
import json
import logging

from websockets.client import WebSocketClientProtocol, connect
from typing import (
    Callable,
    Optional,
    Any,
    Dict,
    List,
    Union,
    Iterable,
    Iterator,
)
from pydantic import BaseModel, PrivateAttr
from jsonrpcclient import request_json, Ok
from jsonrpcclient.id_generators import decimal as decimal_id_generator
from jsonrpcclient.responses import Response, Error, Deserialized
from websockets.typing import Data
from e2b.session.exception import SessionException

from e2b.utils.future import DeferredFuture

logger = logging.getLogger(__name__)


class RpcException(SessionException):
    def __init__(
        self,
        message: str,
        code: int,
        id: str,
        data: Optional[Dict] = None,
    ):
        super().__init__(message)
        self.data = data
        self.code = code
        self.message = message
        self.id = id


class Notification(BaseModel):
    """Nofification"""

    method: str
    params: Dict


Message = Response | Notification


def to_response_or_notification(response: Dict[str, Any]) -> Message:
    """Create a Response namedtuple from a dict"""
    logger.info(f"Received response: {response}")
    if "error" in response:
        return Error(
            response["error"]["code"],
            response["error"]["message"],
            response["error"].get("data"),
            response["id"],
        )
    elif "result" in response and "id" in response:
        return Ok(response["result"], response["id"])

    elif "params" in response:
        return Notification(method=response["method"], params=response["params"])

    raise ValueError("Invalid response", response)


def parse(deserialized: Deserialized) -> Union[Message, Iterable[Message]]:
    """Create a Response or list of Responses from a dict or list of dicts"""
    if isinstance(deserialized, str):
        raise TypeError("Use parse_json on strings")
    return (
        map(to_response_or_notification, deserialized)
        if isinstance(deserialized, list)
        else to_response_or_notification(deserialized)
    )


class SessionRpc(BaseModel):
    url: str
    on_message: Callable[[Notification], None]

    _id_generator: Iterator[int] = PrivateAttr(default_factory=decimal_id_generator)
    _waiting_for_replies: Dict[int, DeferredFuture] = PrivateAttr(default_factory=dict)
    _ws: Optional[WebSocketClientProtocol] = PrivateAttr()

    _process_cleanup: List[Callable[[], Any]] = PrivateAttr(default_factory=list)

    class Config:
        arbitrary_types_allowed = True

    async def connect(self):
        future_connect = DeferredFuture(self._process_cleanup)

        async def handle_messages():
            async for websocket in connect(self.url):
                self._ws = websocket
                logger.info(f"Connected to {self.url}")
                future_connect(None)
                try:
                    async for message in self._ws:
                        await self._receive_message(message)
                except Exception as e:
                    logger.info(f"Error: {e}")
                    continue

            if not self._ws:
                raise Exception("Not connected")
            async for message in self._ws:
                await self._receive_message(message)

        handle_messages_task = asyncio.create_task(handle_messages())
        self._process_cleanup.append(handle_messages_task.cancel)
        await future_connect

    async def send_message(self, method: str, params: List[Any]) -> Any:
        if not self._ws:
            raise Exception("Not connected")

        id = next(self._id_generator)
        request = request_json(method, params, id)
        future_reply = DeferredFuture(self._process_cleanup)

        try:
            self._waiting_for_replies[id] = future_reply
            logger.info(f"Sending request: {request}")
            await self._ws.send(request)
            r = await future_reply
            logger.info(f"Received reply: {r}")
            return r
        except Exception as e:
            logger.info(f"Error: {request} {e}")
            raise e
        finally:
            del self._waiting_for_replies[id]
            logger.info(f"Removed waiting handler for {id}")

    async def _receive_message(self, data: Data):
        message = to_response_or_notification(json.loads(data))

        logger.info(f"Current waiting handlers: {self._waiting_for_replies}")
        if isinstance(message, Ok):
            if (
                message.id in self._waiting_for_replies
                and self._waiting_for_replies[message.id]
            ):
                self._waiting_for_replies[message.id](message.result)
                return
        elif isinstance(message, Error):
            if (
                message.id in self._waiting_for_replies
                and self._waiting_for_replies[message.id]
            ):
                self._waiting_for_replies[message.id].reject(
                    RpcException(
                        code=message.code,
                        message=message.message,
                        id=message.id,
                        data=message.data,
                    )
                )
                return

        elif isinstance(message, Notification):
            self.on_message(message)

    def __del__(self):
        self._close()

    def _close(self):
        for cancel in self._process_cleanup:
            cancel()

        self._process_cleanup.clear()

        for handler in self._waiting_for_replies.values():
            handler.cancel()
            del handler

    async def close(self):
        self._close()

        if self._ws:
            await self._ws.close()
