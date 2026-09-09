import pytest
from e2b_code_interpreter import Sandbox


@pytest.mark.skip_debug()
def test_env_vars_on_sandbox(template):
    sandbox = Sandbox.create(template=template, envs={"TEST_ENV_VAR": "supertest"})
    try:
        result = sandbox.run_code("echo $TEST_ENV_VAR", language="bash")
        assert result.logs.stdout[0] == "supertest\n"
    finally:
        sandbox.kill()


def test_env_vars_per_execution(sandbox: Sandbox):
    result = sandbox.run_code("echo $FOO", envs={"FOO": "bar"}, language="bash")

    result_empty = sandbox.run_code("echo ${FOO:-default}", language="bash")

    assert result.logs.stdout[0] == "bar\n"
    assert result_empty.logs.stdout[0] == "default\n"


@pytest.mark.skip_debug()
def test_env_vars_overwrite(template):
    sandbox = Sandbox.create(template=template, envs={"TEST_ENV_VAR": "supertest"})
    try:
        result = sandbox.run_code(
            "echo $TEST_ENV_VAR", language="bash", envs={"TEST_ENV_VAR": "overwrite"}
        )
        result_global_default = sandbox.run_code("echo $TEST_ENV_VAR", language="bash")
        assert result.logs.stdout[0] == "overwrite\n"
        assert result_global_default.logs.stdout[0] == "supertest\n"
    finally:
        sandbox.kill()
