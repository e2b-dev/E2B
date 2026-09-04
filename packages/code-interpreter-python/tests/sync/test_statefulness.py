from e2b_code_interpreter.code_interpreter_sync import Sandbox


def test_stateful(sandbox: Sandbox):
    sandbox.run_code("test_stateful = 1")

    result = sandbox.run_code("test_stateful+=1; test_stateful")
    assert result.text == "2"
