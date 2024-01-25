from __future__ import annotations

import asyncio
import json
import logging
import threading

from concurrent.futures import ThreadPoolExecutor, TimeoutError
from queue import Queue
from threading import Event
from typing import Any, Callable, Dict, Iterator, List, Union, Optional
from jsonrpcclient import Error, Ok, request_json
from jsonrpcclient.id_generators import decimal as decimal_id_generator
from jsonrpcclient.responses import Response
from pydantic import BaseModel, PrivateAttr, ConfigDict
from websockets.typing import Data

from e2b.constants import TIMEOUT
from e2b.sandbox.exception import RpcException, TimeoutException, SandboxException
from e2b.sandbox.websocket_client import WebSocket
from e2b.utils.future import DeferredFuture, run_async_func_in_loop
from e2b.utils.threads import shutdown_executor

logger = logging.getLogger(__name__)


class Notification(BaseModel):
    """Nofification."""

    method: str
    params: Dict


Message = Union[Response, Notification]


def to_response_or_notification(response: Dict[str, Any]) -> Message:
    """Create a Response namedtuple from a dict."""
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


class SandboxRpc(BaseModel):
    model_config = ConfigDict(arbitrary_types_allowed=True)

    url: str
    on_message: Callable[[Notification], None]

    _id_generator: Iterator[int] = PrivateAttr(default_factory=decimal_id_generator)
    _waiting_for_replies: Dict[int, DeferredFuture] = PrivateAttr(default_factory=dict)
    _queue_in: Queue = PrivateAttr(default_factory=Queue)
    _queue_out: Queue = PrivateAttr(default_factory=Queue)
    _process_cleanup: List[Callable[[], Any]] = PrivateAttr(default_factory=list)
    _websocket_task: Optional[threading.Thread] = PrivateAttr(default=None)

    def process_messages(self):
        while True:
            data = self._queue_out.get()
            logger.debug(f"WebSocket received message: {data}".strip())
            self._receive_message(data)
            self._queue_out.task_done()

    def connect(self, timeout: Optional[float] = TIMEOUT):
        started = Event()
        stopped = Event()
        self._process_cleanup.append(stopped.set)

        threading.Thread(
            target=self.process_messages, daemon=True, name="e2b-process-messages"
        ).start()

        executor = ThreadPoolExecutor(thread_name_prefix="e2b-websocket")
        loop = asyncio.new_event_loop()

        # Keep the websocket running as non daemon thread, so it can close websocket properly
        websocket_task = executor.submit(
            run_async_func_in_loop,
            loop,
            WebSocket(
                url=self.url,
                queue_in=self._queue_in,
                queue_out=self._queue_out,
                started=started,
                stopped=stopped,
            ).run(),
        )

        self._process_cleanup.append(websocket_task.cancel)
        self._process_cleanup.append(lambda: shutdown_executor(executor))

        logger.info("WebSocket waiting to start")

        try:
            signaled = started.wait(timeout=timeout)
            if not signaled:
                logger.error("WebSocket failed to start")
                raise TimeoutException("WebSocket failed to start")
        except BaseException as e:
            self.close()

            if loop.is_running():
                loop.stop()

            raise SandboxException(f"WebSocket failed to start: {e}") from e

        logger.info("WebSocket started")

    def send_message(
        self,
        method: str,
        params: List[Any],
        timeout: Optional[float],
    ) -> Any:
        timeout = timeout or TIMEOUT

        id = next(self._id_generator)
        request = request_json(method, params, id)
        future_reply = DeferredFuture(self._process_cleanup)

        try:
            self._waiting_for_replies[id] = future_reply
            logger.debug(f"WebSocket queueing message: {request}")
            self._queue_in.put(request)
            logger.debug(f"WebSocket waiting for reply: {request}")
            try:
                r = future_reply.result(timeout=timeout)
            except TimeoutError as e:
                logger.error(f"WebSocket timed out while waiting for: {request} {e}")
                raise TimeoutException(
                    f"WebSocket timed out while waiting for: {request} {e}"
                )
            return r
        except Exception as e:
            logger.error(f"WebSocket received error while waiting for: {request} {e}")
            raise e
        finally:
            del self._waiting_for_replies[id]
            logger.debug(f"WebSocket removed waiting handler for {id}")

    def _receive_message(self, data: Data):
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

    def close(self):
        self._close()
