import pytest
from e2b_code_interpreter.code_interpreter_async import AsyncSandbox


@pytest.mark.skip_debug()
async def test_env_vars_on_sandbox(template):
    sandbox = await AsyncSandbox.create(
        template=template, envs={"TEST_ENV_VAR": "supertest"}
    )
    try:
        result = await sandbox.run_code("echo $TEST_ENV_VAR", language="bash")
        assert result.logs.stdout[0] == "supertest\n"
    finally:
        await sandbox.kill()


async def test_env_vars_per_execution(async_sandbox: AsyncSandbox):
    result = await async_sandbox.run_code(
        "echo $FOO", envs={"FOO": "bar"}, language="bash"
    )

    result_empty = await async_sandbox.run_code("echo ${FOO:-default}", language="bash")

    assert result.logs.stdout[0] == "bar\n"
    assert result_empty.logs.stdout[0] == "default\n"


@pytest.mark.skip_debug()
async def test_env_vars_overwrite(template):
    sandbox = await AsyncSandbox.create(
        template=template, envs={"TEST_ENV_VAR": "supertest"}
    )
    try:
        result = await sandbox.run_code(
            "echo $TEST_ENV_VAR", language="bash", envs={"TEST_ENV_VAR": "overwrite"}
        )
        result_global_default = await sandbox.run_code(
            "echo $TEST_ENV_VAR", language="bash"
        )
        assert result.logs.stdout[0] == "overwrite\n"
        assert result_global_default.logs.stdout[0] == "supertest\n"
    finally:
        await sandbox.kill()
