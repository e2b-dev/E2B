import pytest

from harness import CodeInterpreter

pytestmark = pytest.mark.skip_debug


def test_env_vars_on_sandbox(client_factory):
    client = client_factory(envs={"TEST_ENV_VAR": "supertest"})
    client.wait_for_kernel("java")
    execution = client.run_code('System.getProperty("TEST_ENV_VAR")', language="java")
    assert execution.text is not None
    assert execution.text.strip() == "supertest"


def test_env_vars_per_execution(client: CodeInterpreter):
    client.wait_for_kernel("java")
    execution = client.run_code(
        'System.getProperty("FOO")', envs={"FOO": "bar"}, language="java"
    )
    execution_empty = client.run_code(
        'System.getProperty("FOO", "default")', language="java"
    )

    assert execution.text is not None
    assert execution.text.strip() == "bar"
    assert execution_empty.text is not None
    assert execution_empty.text.strip() == "default"


def test_env_vars_overwrite(client_factory):
    client = client_factory(envs={"TEST_ENV_VAR": "supertest"})
    client.wait_for_kernel("java")
    execution = client.run_code(
        'System.getProperty("TEST_ENV_VAR")',
        language="java",
        envs={"TEST_ENV_VAR": "overwrite"},
    )
    execution_global_default = client.run_code(
        'System.getProperty("TEST_ENV_VAR")', language="java"
    )

    assert execution.text is not None
    assert execution.text.strip() == "overwrite"
    assert execution_global_default.text is not None
    assert execution_global_default.text.strip() == "supertest"
