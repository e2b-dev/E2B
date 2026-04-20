import random
import threading
import time
from queue import Empty, Queue
from typing import Callable, List, Optional, TypeVar, cast

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

_GLOBAL_FILE_UPLOAD_SEMAPHORES: dict[int, threading.Semaphore] = {}
_GLOBAL_FILE_UPLOAD_SEMAPHORES_LOCK = threading.Lock()

T = TypeVar("T")
R = TypeVar("R")


class _UploadCancelled(Exception):
    pass


def _get_global_file_upload_semaphore(max_uploads: int) -> threading.Semaphore:
    with _GLOBAL_FILE_UPLOAD_SEMAPHORES_LOCK:
        semaphore = _GLOBAL_FILE_UPLOAD_SEMAPHORES.get(max_uploads)
        if semaphore is None:
            semaphore = threading.Semaphore(max_uploads)
            _GLOBAL_FILE_UPLOAD_SEMAPHORES[max_uploads] = semaphore

        return semaphore


def _file_upload_retry_delay(attempt: int) -> float:
    delay = min(
        _FILE_UPLOAD_RETRY_MAX_DELAY,
        _FILE_UPLOAD_RETRY_BASE_DELAY * (2 ** (attempt - 1)),
    )
    return delay + random.random() * _FILE_UPLOAD_RETRY_JITTER


def _remaining_timeout(deadline: Optional[float]) -> Optional[float]:
    if deadline is None:
        return None

    remaining = deadline - time.monotonic()
    if remaining <= 0:
        raise TimeoutError("File upload timed out")

    return remaining


def _acquire_semaphore(
    semaphore: threading.Semaphore,
    stop_event: threading.Event,
    deadline: Optional[float],
) -> None:
    while True:
        if stop_event.is_set():
            raise _UploadCancelled()

        timeout = 0.05
        remaining = _remaining_timeout(deadline)
        if remaining is not None:
            timeout = min(timeout, remaining)

        if semaphore.acquire(timeout=timeout):
            return


def _wait_for_file_upload_retry(
    delay: float,
    stop_event: threading.Event,
    deadline: Optional[float],
) -> None:
    timeout = delay
    remaining = _remaining_timeout(deadline)
    if remaining is not None:
        timeout = min(timeout, remaining)

    if stop_event.wait(timeout):
        raise _UploadCancelled()

    _remaining_timeout(deadline)


def retry_file_upload(
    upload: Callable[[], R],
    *,
    attempts: int,
    max_global_uploads: int,
    stop_event: threading.Event,
    deadline: Optional[float] = None,
) -> R:
    global_uploads = _get_global_file_upload_semaphore(max_global_uploads)

    for attempt in range(1, attempts + 1):
        if stop_event.is_set():
            raise _UploadCancelled()

        acquired = False
        try:
            _acquire_semaphore(global_uploads, stop_event, deadline)
            acquired = True
            return upload()
        except _TRANSIENT_FILE_UPLOAD_ERRORS:
            if attempt >= attempts:
                raise
        finally:
            if acquired:
                global_uploads.release()

        _wait_for_file_upload_retry(
            _file_upload_retry_delay(attempt),
            stop_event,
            deadline,
        )

    # Unreachable: the loop either returns or raises.
    raise SandboxException("Unexpected file upload retry state")


def run_upload_batch(
    items: List[T],
    limit: int,
    upload: Callable[[T, int, threading.Event], R],
) -> List[R]:
    if len(items) == 0:
        return []

    upload_queue: Queue[tuple[int, T]] = Queue()
    upload_results: List[Optional[R]] = [None] * len(items)
    first_error: List[Exception] = []
    first_error_lock = threading.Lock()
    stop_event = threading.Event()

    for index, item in enumerate(items):
        upload_queue.put_nowait((index, item))

    def _upload_worker() -> None:
        while not stop_event.is_set():
            try:
                index, item = upload_queue.get_nowait()
            except Empty:
                return

            try:
                upload_results[index] = upload(item, index, stop_event)
            except _UploadCancelled:
                return
            except Exception as e:
                with first_error_lock:
                    if not first_error:
                        first_error.append(e)
                        stop_event.set()
                return
            finally:
                upload_queue.task_done()

    upload_threads = [
        threading.Thread(target=_upload_worker) for _ in range(min(limit, len(items)))
    ]

    for thread in upload_threads:
        thread.start()

    for thread in upload_threads:
        thread.join()

    if first_error:
        raise first_error[0]

    return cast(List[R], upload_results)
