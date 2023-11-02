import queue
import sys

from concurrent.futures import ThreadPoolExecutor


def shutdown_executor(executor: ThreadPoolExecutor):
    py_version = sys.version_info
    if (py_version.major == 3) and (py_version.minor < 9):
        # py versions less than 3.9
        # Executor#shutdown does not accept
        # cancel_futures keyword
        # manually shutdown
        # code taken from https://github.com/python/cpython/blob/3.9/Lib/concurrent/futures/thread.py#L216

        # prevent new tasks from being submitted
        executor.shutdown(wait=False)
        while True:
            # cancel all waiting tasks
            try:
                work_item = executor._work_queue.get_nowait()

            except queue.Empty:
                break

            if work_item is not None:
                work_item.future.cancel()

    else:
        executor.shutdown(wait=False, cancel_futures=True)
