from e2b_code_interpreter.code_interpreter_async import AsyncSandbox


async def test_env_vars_per_execution(async_sandbox: AsyncSandbox):
    result = await async_sandbox.run_code(
        "import os; os.getenv('FOO')", envs={"FOO": "bar"}
    )
    result_empty = await async_sandbox.run_code(
        "import os; os.getenv('FOO', 'default')"
    )

    assert result.text == "bar"
    assert result_empty.text == "default"
