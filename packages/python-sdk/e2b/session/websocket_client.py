import asyncio
import logging
from queue import Queue
from typing import Any, Callable, List

from e2b.session.event import Event
from websockets import WebSocketClientProtocol, connect
from websockets.typing import Data

logger = logging.getLogger(__name__)


class WebSocket:
    def __init__(
        self,
        url: str,
        started: Event,
        cancelled: Event,
        queue_in: Queue[dict],
        queue_out: Queue[Data],
    ):
        self._ws: WebSocketClientProtocol | None = None
        self.url = url
        self.started = started
        self.cancelled = cancelled
        self._process_cleanup: List[Callable[[], Any]] = []
        self._queue_in = queue_in
        self._queue_out = queue_out

    async def run(self):
        await self.connect()
        await self.cancelled.wait()
        await self.close()

    async def send_message(self):
        logger.info("Starting to send messages")
        while True:
            if self._queue_in.empty():
                await asyncio.sleep(0.1)
                continue
            message = self._queue_in.get()
            logger.debug(f"Got message: {message}")
            if self._ws:
                await self._ws.send(message)
                self._queue_in.task_done()
            else:
                logger.error("No websocket connection")

    async def handle_messages(self):
        async for websocket in connect(self.url, max_queue=None, max_size=None):
            self._ws = websocket

            messaging_task = asyncio.create_task(self.send_message())
            self._process_cleanup.append(messaging_task.cancel)

            logger.info(f"Connected to {self.url}")
            self.started.set()
            try:
                async for message in self._ws:
                    logger.debug(f"Received message: {message}")
                    self._queue_out.put(message)
            except Exception as e:
                logger.error(f"Error: {e}")

    async def connect(self):
        handle_messages_task = asyncio.create_task(self.handle_messages())
        self._process_cleanup.append(handle_messages_task.cancel)

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
        started: Event,
        cancel_event: Event,
    ):
        websocket = cls(
            url=url,
            cancelled=cancel_event,
            started=started,
            queue_in=queue_in,
            queue_out=queue_out,
        )
        await websocket.run()
