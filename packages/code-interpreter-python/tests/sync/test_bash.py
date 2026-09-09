from e2b_code_interpreter.code_interpreter_sync import Sandbox


def test_bash(sandbox: Sandbox):
    result = sandbox.run_code("!pwd")
    assert "".join(result.logs.stdout).strip() == "/home/user"
