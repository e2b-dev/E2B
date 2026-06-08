from concurrent.futures import ThreadPoolExecutor
import uuid

import pytest

from e2b import Sandbox


def run_threaded(fn, count: int = 8):
    with ThreadPoolExecutor(max_workers=count) as executor:
        return list(executor.map(fn, range(count)))


@pytest.mark.skip_debug()
def test_threaded_api_get_info_calls(sandbox: Sandbox):
    sandbox_ids = run_threaded(
        lambda _: Sandbox.get_info(sandbox.sandbox_id).sandbox_id
    )

    assert sandbox_ids == [sandbox.sandbox_id] * len(sandbox_ids)


@pytest.mark.skip_debug()
def test_threaded_envd_file_reads_after_connect(sandbox: Sandbox):
    path = f"threaded_envd_{uuid.uuid4()}.txt"
    content = "threaded envd read"
    sandbox.files.write(path, content)

    def read_file(_):
        thread_sandbox = Sandbox.connect(sandbox.sandbox_id)
        return thread_sandbox.files.read(path)

    contents = run_threaded(read_file)

    assert contents == [content] * len(contents)
