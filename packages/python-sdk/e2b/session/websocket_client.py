import asyncio
import json
import logging
from threading import Event
from typing import Any, Callable, Dict, List

from e2b.session.exception import RpcException
from e2b.utils.future import DeferredFuture
from janus import AsyncQueue, Queue
from jsonrpcclient import Ok
from jsonrpcclient.responses import Error, Response
from pydantic import BaseModel
from websockets import connect
from websockets.typing import Data

logger = logging.getLogger(__name__)


class Pong:
    pass


PONG = Pong()


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


class WebSocket:
    def __init__(
        self,
        url: str,
        on_message: Callable[[Notification], None],
        started: Event,
        cancelled: Event,
        queue: AsyncQueue[dict | Pong],
        waiting_for_replies: Dict[int, DeferredFuture],
    ):
        self._ws = None
        self.url = url
        self.on_message = on_message
        self.started = started
        self.cancelled = cancelled
        self._process_cleanup: List[Callable[[], Any]] = []
        self._queue = queue
        self._waiting_for_replies = waiting_for_replies

    async def run(self):
        await self.connect()
        while not self.cancelled.is_set():
            await asyncio.sleep(5)
            await self.pong()
        await self.close()

    async def connect(self):
        future_connect = DeferredFuture(self._process_cleanup)

        async def handle_messages():
            async for websocket in connect(
                self.url,
                ping_interval=None,
                ping_timeout=None,
                max_queue=None,
                max_size=None,
            ):
                self._ws = websocket
                cancel_event = Event()

                self._process_cleanup.append(cancel_event.set)

                async def send_message():
                    while True:
                        if self._queue.empty():
                            await asyncio.sleep(0.1)
                            continue
                        m = await self._queue.get()
                        logger.info(f"Sending message: {m}")
                        if m == PONG:
                            logger.debug("Sending pong")
                            await websocket.pong()
                        else:
                            logger.debug(f"Sending message: {m}")
                            await websocket.send(m)

                messaging_task = asyncio.create_task(send_message())
                self._process_cleanup.append(messaging_task.cancel)

                logger.info(f"Connected to {self.url}")
                future_connect(None)
                try:
                    async for message in self._ws:
                        await self._receive_message(message)
                except Exception as e:
                    logger.error(f"Error: {e}")

            if not self._ws:
                raise Exception("Not connected")
            async for message in self._ws:
                await self._receive_message(message)

        handle_messages_task = asyncio.create_task(handle_messages())
        self._process_cleanup.append(handle_messages_task.cancel)
        await future_connect
        self.started.set()

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

    async def pong(self):
        await self._queue.put(PONG)

    def _close(self):
        for cancel in self._process_cleanup:
            cancel()

        self._process_cleanup.clear()

    async def close(self):
        self._close()

        if self._ws:
            await self._ws.close()


def start_websocket(
    url,
    on_message: Callable[[Notification], None],
    queue: Queue,
    waiting_for_replies: Dict[int, DeferredFuture],
    started: Event,
    cancel_event: Event,
):
    websocket = WebSocket(
        url=url,
        on_message=on_message,
        cancelled=cancel_event,
        started=started,
        queue=queue.async_q,
        waiting_for_replies=waiting_for_replies,
    )
    asyncio.run(websocket.run())
