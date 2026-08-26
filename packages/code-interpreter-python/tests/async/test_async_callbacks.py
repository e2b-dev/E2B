from e2b_code_interpreter.code_interpreter_async import AsyncSandbox


def async_append_fn(items):
    async def async_append(item):
        items.append(item)

    return async_append


async def test_results(async_sandbox: AsyncSandbox):
    results = []

    execution = await async_sandbox.run_code(
        "x = 1;x", on_result=async_append_fn(results)
    )
    assert len(results) == 1
    assert execution.results[0].text == "1"


async def test_results_sync_callback(async_sandbox: AsyncSandbox):
    results = []

    execution = await async_sandbox.run_code(
        "x = 1;x", on_result=lambda result: results.append(result)
    )
    assert len(results) == 1
    assert execution.results[0].text == "1"


async def test_error(async_sandbox: AsyncSandbox):
    errors = []
    execution = await async_sandbox.run_code("xyz", on_error=async_append_fn(errors))
    assert len(errors) == 1
    assert execution.error.name == "NameError"


async def test_stdout(async_sandbox: AsyncSandbox):
    stdout = []
    execution = await async_sandbox.run_code(
        "print('Hello from e2b')", on_stdout=async_append_fn(stdout)
    )
    assert len(stdout) == 1
    assert execution.logs.stdout == ["Hello from e2b\n"]


async def test_stderr(async_sandbox: AsyncSandbox):
    stderr = []
    execution = await async_sandbox.run_code(
        'import sys;print("This is an error message", file=sys.stderr)',
        on_stderr=async_append_fn(stderr),
    )
    assert len(stderr) == 1
    assert execution.logs.stderr == ["This is an error message\n"]
