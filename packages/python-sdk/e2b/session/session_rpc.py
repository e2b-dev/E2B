import json
import logging
from concurrent.futures import ThreadPoolExecutor
from queue import Queue
from typing import Any, Callable, Dict, Iterator, List

from e2b.session.event import Event
from e2b.session.exception import RpcException
from e2b.session.websocket_client import WebSocket
from e2b.utils.future import DeferredFuture
from jsonrpcclient import Error, Ok, request_json
from jsonrpcclient.id_generators import decimal as decimal_id_generator
from jsonrpcclient.responses import Response
from pydantic import BaseModel, PrivateAttr
from websockets.typing import Data

logger = logging.getLogger(__name__)


import asyncio


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


class SessionRpc(BaseModel):
    url: str
    on_message: Callable[[Notification], None]

    _id_generator: Iterator[int] = PrivateAttr(default_factory=decimal_id_generator)
    _waiting_for_replies: Dict[int, DeferredFuture] = PrivateAttr(default_factory=dict)
    _queue_in: Queue[dict] = PrivateAttr(default_factory=Queue)
    _queue_out: Queue[Data] = PrivateAttr(default_factory=Queue)
    _process_cleanup: List[Callable[[], Any]] = PrivateAttr(default_factory=list)

    class Config:
        arbitrary_types_allowed = True

    async def process_messages(self):
        while True:
            if self._queue_out.empty():
                await asyncio.sleep(0.1)
                continue
            data = self._queue_out.get()
            await self._receive_message(data)
            self._queue_out.task_done()

    async def connect(self):
        started = Event()
        stopped = Event()
        task = asyncio.create_task(self.process_messages())
        executor = ThreadPoolExecutor()
        websocket_task = executor.submit(
            asyncio.new_event_loop().run_until_complete,
            WebSocket.start(
                self.url, self._queue_in, self._queue_out, started, stopped
            ),
        )
        self._process_cleanup.append(stopped.set)
        self._process_cleanup.append(websocket_task.cancel)
        self._process_cleanup.append(executor.shutdown)
        self._process_cleanup.append(task.cancel)
        await started.wait()

    async def send_message(self, method: str, params: List[Any]) -> Any:
        id = next(self._id_generator)
        request = request_json(method, params, id)
        future_reply = DeferredFuture(self._process_cleanup)

        try:
            self._waiting_for_replies[id] = future_reply
            logger.info(f"Queueing: {request}")
            self._queue_in.put(request)
            logger.info(f"Queue size: {self._queue_in.qsize()}")
            logger.info(f"Waiting for reply: {request}")
            r = await future_reply
            return r
        except Exception as e:
            logger.error(f"Error: {request} {e}")
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

    def _close(self):
        for cancel in self._process_cleanup:
            cancel()

        self._process_cleanup.clear()

        for handler in self._waiting_for_replies.values():
            handler.cancel()
            del handler

    async def close(self):
        self._close()
