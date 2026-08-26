import pytest
from e2b_code_interpreter import Sandbox


@pytest.mark.skip_debug()
def test_env_vars_on_sandbox(template):
    sandbox = Sandbox.create(template=template, envs={"TEST_ENV_VAR": "supertest"})
    try:
        result = sandbox.run_code("process.env.TEST_ENV_VAR", language="javascript")
        assert result.text is not None
        assert result.text.strip() == "supertest"
    finally:
        sandbox.kill()


def test_env_vars_per_execution(sandbox: Sandbox):
    try:
        result = sandbox.run_code(
            "process.env.FOO", envs={"FOO": "bar"}, language="javascript"
        )

        result_empty = sandbox.run_code(
            "process.env.FOO || 'default'", language="javascript"
        )

        assert result.text is not None
        assert result.text.strip() == "bar"
        assert result_empty.text is not None
        assert result_empty.text.strip() == "default"
    finally:
        sandbox.kill()


@pytest.mark.skip_debug()
def test_env_vars_overwrite(template):
    sandbox = Sandbox.create(template=template, envs={"TEST_ENV_VAR": "supertest"})
    try:
        result = sandbox.run_code(
            "process.env.TEST_ENV_VAR",
            language="javascript",
            envs={"TEST_ENV_VAR": "overwrite"},
        )
        result_global_default = sandbox.run_code(
            "process.env.TEST_ENV_VAR", language="javascript"
        )
        assert result.text is not None
        assert result.text.strip() == "overwrite"
        assert result_global_default.text is not None
        assert result_global_default.text.strip() == "supertest"
    finally:
        sandbox.kill()
