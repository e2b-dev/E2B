import pytest
from e2b_code_interpreter.code_interpreter_async import AsyncSandbox


@pytest.mark.skip_debug()
async def test_env_vars_on_sandbox(template):
    sandbox = await AsyncSandbox.create(
        template=template, envs={"TEST_ENV_VAR": "supertest"}
    )
    try:
        result = await sandbox.run_code('Sys.getenv("TEST_ENV_VAR")', language="r")
        assert result.results[0].text is not None
        assert result.results[0].text.strip() == '[1] "supertest"'
    finally:
        await sandbox.kill()


async def test_env_vars_per_execution(async_sandbox: AsyncSandbox):
    result = await async_sandbox.run_code(
        'Sys.getenv("FOO")', envs={"FOO": "bar"}, language="r"
    )

    result_empty = await async_sandbox.run_code(
        'Sys.getenv("FOO", unset = "default")', language="r"
    )

    assert result.results[0].text is not None
    assert result.results[0].text.strip() == '[1] "bar"'
    assert result_empty.results[0].text is not None
    assert result_empty.results[0].text.strip() == '[1] "default"'


@pytest.mark.skip_debug()
async def test_env_vars_overwrite(template):
    sandbox = await AsyncSandbox.create(
        template=template, envs={"TEST_ENV_VAR": "supertest"}
    )
    try:
        result = await sandbox.run_code(
            'Sys.getenv("TEST_ENV_VAR")',
            language="r",
            envs={"TEST_ENV_VAR": "overwrite"},
        )
        result_global_default = await sandbox.run_code(
            'Sys.getenv("TEST_ENV_VAR")', language="r"
        )
        assert result.results[0].text is not None
        assert result.results[0].text.strip() == '[1] "overwrite"'
        assert result_global_default.results[0].text is not None
        assert result_global_default.results[0].text.strip() == '[1] "supertest"'
    finally:
        await sandbox.kill()
