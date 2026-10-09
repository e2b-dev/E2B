import pytest

from harness import CodeInterpreter


@pytest.mark.skip_debug
def test_env_vars_on_sandbox(client_factory):
    client = client_factory(envs={"TEST_ENV_VAR": "supertest"})
    execution = client.run_code(
        "import os; os.getenv('TEST_ENV_VAR')", language="python"
    )
    assert execution.text == "supertest"


def test_env_vars_per_execution(client: CodeInterpreter):
    execution = client.run_code(
        "import os; os.getenv('FOO')", envs={"FOO": "bar"}, language="python"
    )
    execution_empty = client.run_code(
        "import os; os.getenv('FOO', 'default')", language="python"
    )

    assert execution.text == "bar"
    assert execution_empty.text == "default"


@pytest.mark.skip_debug
def test_env_vars_overwrite(client_factory):
    client = client_factory(envs={"TEST_ENV_VAR": "supertest"})
    execution = client.run_code(
        "import os; os.getenv('TEST_ENV_VAR')",
        language="python",
        envs={"TEST_ENV_VAR": "overwrite"},
    )
    execution_global_default = client.run_code(
        "import os; os.getenv('TEST_ENV_VAR')", language="python"
    )

    assert execution.text == "overwrite"
    assert execution_global_default.text == "supertest"
