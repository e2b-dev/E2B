from e2b_code_interpreter.code_interpreter_async import AsyncSandbox


async def test_stateful(async_sandbox: AsyncSandbox):
    await async_sandbox.run_code("async_test_stateful = 1")

    result = await async_sandbox.run_code("async_test_stateful+=1; async_test_stateful")
    assert result.text == "2"
