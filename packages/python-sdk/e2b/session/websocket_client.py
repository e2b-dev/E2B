import asyncio
import json
import logging
from queue import Queue
from threading import Event
from typing import Any, Callable, Dict, List

from e2b.session.exception import RpcException
from e2b.utils.future import DeferredFuture
from jsonrpcclient import Ok
from jsonrpcclient.responses import Error, Response
from pydantic import BaseModel
from websockets import connect
from websockets.typing import Data

logger = logging.getLogger(__name__)


class Notification(BaseModel):
    """Nofification"""

    method: str
    params: Dict


Message = Response | Notification


class WebSocket:
    def __init__(
        self,
        url: str,
        on_message: Callable[[Notification], None],
        started: Event,
        cancelled: Event,
        queue_in: Queue[dict],
        queue_out: Queue[dict],
        waiting_for_replies: Dict[int, DeferredFuture],
    ):
        self._ws = None
        self.url = url
        self.on_message = on_message
        self.started = started
        self.cancelled = cancelled
        self._process_cleanup: List[Callable[[], Any]] = []
        self._queue_in = queue_in
        self._queue_out = queue_out
        self._waiting_for_replies = waiting_for_replies

    async def run(self):
        await self.connect()
        await self.close()

    async def connect(self):
        future_connect = DeferredFuture(self._process_cleanup)

        async def handle_messages():
            async for websocket in connect(
                self.url,
                max_queue=None,
                max_size=None,
            ):
                logger.info("WS Connected")
                self._ws = websocket
                cancel_event = Event()

                self._process_cleanup.append(cancel_event.set)

                async def send_message():
                    logger.info("Starting to send messages")
                    while True:
                        logger.info("While true")
                        if self._queue_in.empty():
                            logger.info("Queue is empty")
                            await asyncio.sleep(0.1)
                        logger.info("Queue is not empty")
                        m = self._queue_in.get(block=False)
                        logger.info(f"Got message: {m}")
                        if m:
                            logger.debug(f"Sending message: {m}")
                            await websocket.send(m)

                messaging_task = asyncio.create_task(send_message())
                self._process_cleanup.append(messaging_task.cancel)

                logger.info(f"Connected to {self.url}")
                future_connect(None)
                try:
                    async for message in self._ws:
                        logger.debug(f"Received message: {message}")
                        self._queue_out.put(message)
                except Exception as e:
                    logger.error(f"Error: {e}")

        handle_messages_task = asyncio.create_task(handle_messages())
        self._process_cleanup.append(handle_messages_task.cancel)
        logger.info("Future Connecting")
        await future_connect
        logger.info("Future Connected")
        self.started.set()
        logger.info("Started")
        await asyncio.sleep(1000)

    def _close(self):
        for cancel in self._process_cleanup:
            cancel()

        self._process_cleanup.clear()

    async def close(self):
        self._close()

        if self._ws:
            await self._ws.close()


async def start_websocket(
    url,
    on_message: Callable[[Notification], None],
    queue_in: Queue,
    queue_out: Queue,
    waiting_for_replies: Dict[int, DeferredFuture],
    started: Event,
    cancel_event: Event,
):
    websocket = WebSocket(
        url=url,
        on_message=on_message,
        cancelled=cancel_event,
        started=started,
        queue_in=queue_in,
        queue_out=queue_out,
        waiting_for_replies=waiting_for_replies,
    )
    await websocket.run()
