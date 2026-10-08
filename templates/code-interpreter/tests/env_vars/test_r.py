import pytest

from harness import CodeInterpreter


@pytest.mark.skip_debug
def test_env_vars_on_sandbox(client_factory):
    client = client_factory(envs={"TEST_ENV_VAR": "supertest"})
    client.wait_for_kernel("r")
    execution = client.run_code("Sys.getenv('TEST_ENV_VAR')", language="r")
    assert execution.results[0].text.strip() == '[1] "supertest"'


@pytest.mark.skip_debug
def test_env_vars_per_execution(client: CodeInterpreter):
    client.wait_for_kernel("r")
    execution = client.run_code("Sys.getenv('FOO')", envs={"FOO": "bar"}, language="r")
    execution_empty = client.run_code(
        "Sys.getenv('FOO', unset = 'default')", language="r"
    )

    assert execution.results[0].text.strip() == '[1] "bar"'
    assert execution_empty.results[0].text.strip() == '[1] "default"'


@pytest.mark.skip_debug
def test_env_vars_overwrite(client_factory):
    client = client_factory(envs={"TEST_ENV_VAR": "supertest"})
    client.wait_for_kernel("r")
    execution = client.run_code(
        "Sys.getenv('TEST_ENV_VAR')", language="r", envs={"TEST_ENV_VAR": "overwrite"}
    )
    execution_global_default = client.run_code(
        "Sys.getenv('TEST_ENV_VAR')", language="r"
    )

    assert execution.results[0].text.strip() == '[1] "overwrite"'
    assert execution_global_default.results[0].text.strip() == '[1] "supertest"'
