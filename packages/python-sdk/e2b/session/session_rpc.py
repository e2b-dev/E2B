import logging
from concurrent.futures import ThreadPoolExecutor
from threading import Event
from typing import Any, Callable, Dict, Iterator, List

from e2b.session.websocket_client import Notification, start_websocket
from e2b.utils.future import DeferredFuture
from janus import Queue
from jsonrpcclient import request_json
from jsonrpcclient.id_generators import decimal as decimal_id_generator
from pydantic import BaseModel, PrivateAttr

logger = logging.getLogger(__name__)


class SessionRpc(BaseModel):
    url: str
    on_message: Callable[[Notification], None]

    _id_generator: Iterator[int] = PrivateAttr(default_factory=decimal_id_generator)
    _waiting_for_replies: Dict[int, DeferredFuture] = PrivateAttr(default_factory=dict)
    _queue: Queue = PrivateAttr(default_factory=Queue)
    _process_cleanup: List[Callable[[], Any]] = PrivateAttr(default_factory=list)

    class Config:
        arbitrary_types_allowed = True

    async def connect(self):
        started = Event()
        cancelled = Event()
        executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix="e2b_ws_")
        executor.submit(
            start_websocket,
            self.url,
            self.on_message,
            self._queue,
            self._waiting_for_replies,
            started,
            cancelled,
        )
        self._process_cleanup.append(cancelled.set)
        self._process_cleanup.append(executor.shutdown)
        started.wait()

    async def send_message(self, method: str, params: List[Any]) -> Any:
        id = next(self._id_generator)
        request = request_json(method, params, id)
        future_reply = DeferredFuture(self._process_cleanup)

        try:
            self._waiting_for_replies[id] = future_reply
            logger.info(f"Sending request: {request}")
            await self._queue.async_q.put(request)
            logger.info(f"Waiting for reply: {request}")
            r = await future_reply
            logger.info(f"Received reply: {r}")
            return r
        except Exception as e:
            logger.error(f"Error: {request} {e}")
            raise e
        finally:
            del self._waiting_for_replies[id]
            logger.info(f"Removed waiting handler for {id}")

    def _close(self):
        for cancel in self._process_cleanup:
            cancel()

        self._process_cleanup.clear()

        for handler in self._waiting_for_replies.values():
            handler.cancel()
            del handler

    async def close(self):
        self._close()
