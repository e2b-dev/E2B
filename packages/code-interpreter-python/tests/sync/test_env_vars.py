from e2b_code_interpreter.code_interpreter_sync import Sandbox


def test_env_vars_per_execution(sandbox: Sandbox):
    result = sandbox.run_code("import os; os.getenv('FOO')", envs={"FOO": "bar"})
    result_empty = sandbox.run_code("import os; os.getenv('FOO', 'default')")

    assert result.text == "bar"
    assert result_empty.text == "default"
