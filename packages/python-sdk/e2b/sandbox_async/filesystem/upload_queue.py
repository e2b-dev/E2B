import asyncio
import random
import weakref
from typing import Awaitable, Callable, List, Optional, TypeVar, cast

import httpx

from e2b.exceptions import SandboxException

_FILE_UPLOAD_RETRY_BASE_DELAY = 0.25
_FILE_UPLOAD_RETRY_MAX_DELAY = 4.0
_FILE_UPLOAD_RETRY_JITTER = 0.25

_TRANSIENT_FILE_UPLOAD_ERRORS = (
    httpx.ConnectError,
    httpx.ConnectTimeout,
    httpx.PoolTimeout,
    httpx.ReadError,
    httpx.ReadTimeout,
    httpx.RemoteProtocolError,
    httpx.WriteError,
    httpx.WriteTimeout,
)

_GLOBAL_FILE_UPLOAD_SEMAPHORES: weakref.WeakKeyDictionary[
    asyncio.AbstractEventLoop, dict[int, asyncio.Semaphore]
] = weakref.WeakKeyDictionary()

T = TypeVar("T")
R = TypeVar("R")


def _get_global_file_upload_semaphore(max_uploads: int) -> asyncio.Semaphore:
    loop = asyncio.get_running_loop()
    semaphores = _GLOBAL_FILE_UPLOAD_SEMAPHORES.get(loop)
    if semaphores is None:
        semaphores = {}
        _GLOBAL_FILE_UPLOAD_SEMAPHORES[loop] = semaphores

    semaphore = semaphores.get(max_uploads)
    if semaphore is None:
        semaphore = asyncio.Semaphore(max_uploads)
        semaphores[max_uploads] = semaphore

    return semaphore


def _file_upload_retry_delay(attempt: int) -> float:
    delay = min(
        _FILE_UPLOAD_RETRY_MAX_DELAY,
        _FILE_UPLOAD_RETRY_BASE_DELAY * (2 ** (attempt - 1)),
    )
    return delay + random.random() * _FILE_UPLOAD_RETRY_JITTER


async def retry_file_upload(
    upload: Callable[[], Awaitable[R]],
    *,
    attempts: int,
    max_global_uploads: int,
    stop_event: asyncio.Event,
) -> R:
    global_uploads = _get_global_file_upload_semaphore(max_global_uploads)

    for attempt in range(1, attempts + 1):
        if stop_event.is_set():
            raise asyncio.CancelledError()

        try:
            async with global_uploads:
                return await upload()
        except _TRANSIENT_FILE_UPLOAD_ERRORS:
            if attempt >= attempts:
                raise
            try:
                await asyncio.wait_for(
                    stop_event.wait(),
                    timeout=_file_upload_retry_delay(attempt),
                )
            except asyncio.TimeoutError:
                pass
            else:
                raise asyncio.CancelledError()

    # Unreachable: the loop either returns or raises.
    raise SandboxException("Unexpected file upload retry state")


async def run_upload_batch(
    items: List[T],
    limit: int,
    upload: Callable[[T, int, asyncio.Event], Awaitable[R]],
) -> List[R]:
    if len(items) == 0:
        return []

    upload_queue: asyncio.Queue = asyncio.Queue()
    upload_results: List[Optional[R]] = [None] * len(items)
    first_error: List[Exception] = []
    stop_event = asyncio.Event()
    upload_tasks: List[asyncio.Task] = []

    for index, item in enumerate(items):
        upload_queue.put_nowait((index, item))

    def _cancel_upload_workers(current_task: Optional[asyncio.Task]):
        for task in upload_tasks:
            if task is not current_task and not task.done():
                task.cancel()

    async def _upload_worker():
        while not stop_event.is_set():
            try:
                index, item = upload_queue.get_nowait()
            except asyncio.QueueEmpty:
                return

            try:
                upload_results[index] = await upload(item, index, stop_event)
            except Exception as e:
                if not first_error:
                    first_error.append(e)
                    stop_event.set()
                    _cancel_upload_workers(asyncio.current_task())
                return
            finally:
                upload_queue.task_done()

    upload_tasks = [
        asyncio.create_task(_upload_worker()) for _ in range(min(limit, len(items)))
    ]

    try:
        await asyncio.gather(*upload_tasks, return_exceptions=True)
    except BaseException:
        _cancel_upload_workers(None)
        await asyncio.gather(*upload_tasks, return_exceptions=True)
        raise

    if first_error:
        raise first_error[0]

    return cast(List[R], upload_results)
