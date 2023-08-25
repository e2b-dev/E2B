import asyncio
import logging

from websockets.client import WebSocketClientProtocol, connect
from janus import Queue
from typing import Any, Callable, Dict, List
from jsonrpcclient.responses import Response
from pydantic import BaseModel
from websockets.typing import Data

from e2b.session.event import Event
from e2b.utils.future import DeferredFuture


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
        started: Event,
        cancelled: Event,
        queue_in: Queue[dict],
        queue_out: Queue[Data],
        waiting_for_replies: Dict[int, DeferredFuture],
    ):
        self._ws: WebSocketClientProtocol | None = None
        self.url = url
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
                        message = await self._queue_in.async_q.get()
                        logger.info(f"Got message: {message}")
                        if self._ws:
                            await self._ws.send(message)
                        else:
                            logger.error("No websocket connection")

                messaging_task = asyncio.create_task(send_message())
                self._process_cleanup.append(messaging_task.cancel)

                logger.info(f"Connected to {self.url}")
                future_connect(None)
                try:
                    async for message in self._ws:
                        logger.debug(f"Received message: {message}")
                        await self._queue_out.async_q.put(message)
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

    @classmethod
    async def start(
        cls,
        url,
        queue_in: Queue[dict],
        queue_out: Queue[Data],
        waiting_for_replies: Dict[int, DeferredFuture],
        started: Event,
        cancel_event: Event,
    ):
        websocket = cls(
            url=url,
            cancelled=cancel_event,
            started=started,
            queue_in=queue_in,
            queue_out=queue_out,
            waiting_for_replies=waiting_for_replies,
        )
        await websocket.run()
        return websocket
