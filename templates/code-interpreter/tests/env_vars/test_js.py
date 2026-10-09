import pytest

from harness import CodeInterpreter


@pytest.mark.skip_debug
def test_env_vars_on_sandbox(client_factory):
    client = client_factory(envs={"TEST_ENV_VAR": "supertest"})
    execution = client.run_code("process.env.TEST_ENV_VAR", language="javascript")
    assert execution.text is not None
    assert execution.text.strip() == "supertest"


def test_env_vars_per_execution(client: CodeInterpreter):
    execution = client.run_code(
        "process.env.FOO", envs={"FOO": "bar"}, language="javascript"
    )
    execution_empty = client.run_code(
        "process.env.FOO || 'default'", language="javascript"
    )

    assert execution.text is not None
    assert execution.text.strip() == "bar"
    assert execution_empty.text is not None
    assert execution_empty.text.strip() == "default"


@pytest.mark.skip_debug
def test_env_vars_overwrite(client_factory):
    client = client_factory(envs={"TEST_ENV_VAR": "supertest"})
    execution = client.run_code(
        "process.env.TEST_ENV_VAR",
        language="javascript",
        envs={"TEST_ENV_VAR": "overwrite"},
    )
    execution_global_default = client.run_code(
        "process.env.TEST_ENV_VAR", language="javascript"
    )

    assert execution.text is not None
    assert execution.text.strip() == "overwrite"
    assert execution_global_default.text is not None
    assert execution_global_default.text.strip() == "supertest"
