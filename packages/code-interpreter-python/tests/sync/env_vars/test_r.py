import pytest
from e2b_code_interpreter import Sandbox


@pytest.mark.skip_debug()
def test_env_vars_on_sandbox(template):
    sandbox = Sandbox.create(template=template, envs={"TEST_ENV_VAR": "supertest"})
    try:
        result = sandbox.run_code("Sys.getenv('TEST_ENV_VAR')", language="r")
        assert result.results[0].text is not None
        assert result.results[0].text.strip() == '[1] "supertest"'
    finally:
        sandbox.kill()


def test_env_vars_per_execution(sandbox: Sandbox):
    try:
        result = sandbox.run_code(
            "Sys.getenv('FOO')", envs={"FOO": "bar"}, language="r"
        )

        result_empty = sandbox.run_code(
            "Sys.getenv('FOO', unset = 'default')", language="r"
        )

        assert result.results[0].text is not None
        assert result.results[0].text.strip() == '[1] "bar"'
        assert result_empty.results[0].text is not None
        assert result_empty.results[0].text.strip() == '[1] "default"'
    finally:
        sandbox.kill()


@pytest.mark.skip_debug()
def test_env_vars_overwrite(template):
    sandbox = Sandbox.create(template=template, envs={"TEST_ENV_VAR": "supertest"})
    try:
        result = sandbox.run_code(
            "Sys.getenv('TEST_ENV_VAR')",
            language="r",
            envs={"TEST_ENV_VAR": "overwrite"},
        )
        result_global_default = sandbox.run_code(
            "Sys.getenv('TEST_ENV_VAR')", language="r"
        )
        assert result.results[0].text is not None
        assert result.results[0].text.strip() == '[1] "overwrite"'
        assert result_global_default.results[0].text is not None
        assert result_global_default.results[0].text.strip() == '[1] "supertest"'
    finally:
        sandbox.kill()
