import pytest
from e2b_code_interpreter import Sandbox


@pytest.mark.skip_debug()
def test_env_vars_on_sandbox(template, wait_for_kernel):
    sandbox = Sandbox.create(template=template, envs={"TEST_ENV_VAR": "supertest"})
    try:
        wait_for_kernel(sandbox, "java")

        result = sandbox.run_code('System.getProperty("TEST_ENV_VAR")', language="java")
        assert result.text is not None
        assert result.text.strip() == "supertest"
    finally:
        sandbox.kill()


def test_env_vars_per_execution(java_sandbox: Sandbox):
    try:
        result = java_sandbox.run_code(
            'System.getProperty("FOO")', envs={"FOO": "bar"}, language="java"
        )

        result_empty = java_sandbox.run_code(
            'System.getProperty("FOO", "default")', language="java"
        )

        assert result.text is not None
        assert result.text.strip() == "bar"
        assert result_empty.text is not None
        assert result_empty.text.strip() == "default"
    finally:
        java_sandbox.kill()


@pytest.mark.skip_debug()
def test_env_vars_overwrite(template, wait_for_kernel):
    sandbox = Sandbox.create(template=template, envs={"TEST_ENV_VAR": "supertest"})
    try:
        wait_for_kernel(sandbox, "java")

        result = sandbox.run_code(
            'System.getProperty("TEST_ENV_VAR")',
            language="java",
            envs={"TEST_ENV_VAR": "overwrite"},
        )
        result_global_default = sandbox.run_code(
            'System.getProperty("TEST_ENV_VAR")', language="java"
        )
        assert result.text is not None
        assert result.text.strip() == "overwrite"
        assert result_global_default.text is not None
        assert result_global_default.text.strip() == "supertest"
    finally:
        sandbox.kill()
