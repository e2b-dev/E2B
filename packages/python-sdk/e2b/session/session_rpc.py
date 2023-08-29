from __future__ import annotations

import asyncio
import json
import logging
from concurrent.futures import ThreadPoolExecutor
from queue import Queue
from threading import Event
from typing import Any, Callable, Dict, Iterator, List, Union

from e2b.session.exception import RpcException
from e2b.session.websocket_client import WebSocket
from e2b.utils.future import DeferredFuture, run_async_func_in_new_loop
from e2b.utils.threads import shutdown_executor
from janus import Queue as JanusQueue
from jsonrpcclient import Error, Ok, request_json
from jsonrpcclient.id_generators import decimal as decimal_id_generator
from jsonrpcclient.responses import Response
from pydantic import BaseModel, PrivateAttr
from websockets.typing import Data

logger = logging.getLogger(__name__)


class Notification(BaseModel):
    """Nofification"""

    method: str
    params: Dict


Message = Union[Response, Notification]


def to_response_or_notification(response: Dict[str, Any]) -> Message:
    """Create a Response namedtuple from a dict"""
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
    _queue_in: Queue = PrivateAttr(default_factory=Queue)
    _queue_out: JanusQueue = PrivateAttr(default_factory=JanusQueue)
    _process_cleanup: List[Callable[[], Any]] = PrivateAttr(default_factory=list)

    class Config:
        arbitrary_types_allowed = True

    async def process_messages(self):
        while True:
            data = await self._queue_out.async_q.get()
            logger.debug(f"WebSocket received message: {data}".strip())
            await self._receive_message(data)
            self._queue_out.async_q.task_done()

    async def connect(self):
        started = Event()
        stopped = Event()
        task = asyncio.create_task(self.process_messages())
        executor = ThreadPoolExecutor()
        websocket_task = executor.submit(
            run_async_func_in_new_loop,
            WebSocket(
                url=self.url,
                queue_in=self._queue_in,
                queue_out=self._queue_out.sync_q,
                started=started,
                stopped=stopped,
            ).run(),
        )
        self._process_cleanup.append(stopped.set)
        self._process_cleanup.append(websocket_task.cancel)
        self._process_cleanup.append(lambda: shutdown_executor(executor))
        self._process_cleanup.append(task.cancel)
        logger.info("WebSocket waiting to start")
        while not started.is_set():
            await asyncio.sleep(0)
        logger.info("WebSocket started")

    async def send_message(self, method: str, params: List[Any]) -> Any:
        id = next(self._id_generator)
        request = request_json(method, params, id)
        future_reply = DeferredFuture(self._process_cleanup)

        try:
            self._waiting_for_replies[id] = future_reply
            logger.debug(f"WebSocket queueing message: {request}")
            self._queue_in.put(request)
            logger.debug(f"WebSocket waiting for reply: {request}")
            r = await future_reply
            return r
        except Exception as e:
            logger.error(f"WebSocket received error while waiting for: {request} {e}")
            raise e
        finally:
            del self._waiting_for_replies[id]
            logger.debug(f"WebSocket removed waiting handler for {id}")

    async def _receive_message(self, data: Data):
        logger.debug(f"Processing message: {data}".strip())

        message = to_response_or_notification(json.loads(data))

        logger.debug(
            f"Current waiting handlers: {list(self._waiting_for_replies.keys())}"
        )
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
