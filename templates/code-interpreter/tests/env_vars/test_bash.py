import pytest

from harness import CodeInterpreter


@pytest.mark.skip_debug
def test_env_vars_on_sandbox(client_factory):
    client = client_factory(envs={"TEST_ENV_VAR": "supertest"})
    execution = client.run_code("echo $TEST_ENV_VAR", language="bash")
    assert execution.stdout[0] == "supertest\n"


def test_env_vars_per_execution(client: CodeInterpreter):
    execution = client.run_code("echo $FOO", envs={"FOO": "bar"}, language="bash")
    execution_empty = client.run_code("echo ${FOO:-default}", language="bash")

    assert execution.stdout[0] == "bar\n"
    assert execution_empty.stdout[0] == "default\n"


@pytest.mark.skip_debug
def test_env_vars_overwrite(client_factory):
    client = client_factory(envs={"TEST_ENV_VAR": "supertest"})
    execution = client.run_code(
        "echo $TEST_ENV_VAR", language="bash", envs={"TEST_ENV_VAR": "overwrite"}
    )
    execution_global_default = client.run_code("echo $TEST_ENV_VAR", language="bash")

    assert execution.stdout[0] == "overwrite\n"
    assert execution_global_default.stdout[0] == "supertest\n"
