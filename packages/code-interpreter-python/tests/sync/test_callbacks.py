from e2b_code_interpreter.code_interpreter_sync import Sandbox


def test_resuls(sandbox: Sandbox):
    results = []
    execution = sandbox.run_code(
        "x = 1;x", on_result=lambda result: results.append(result)
    )
    assert len(results) == 1
    assert execution.results[0].text == "1"


def test_error(sandbox: Sandbox):
    errors = []
    execution = sandbox.run_code("xyz", on_error=lambda error: errors.append(error))
    assert len(errors) == 1
    assert execution.error.name == "NameError"


def test_stdout(sandbox: Sandbox):
    stdout = []
    execution = sandbox.run_code(
        "print('Hello from e2b')", on_stdout=lambda out: stdout.append(out)
    )
    assert len(stdout) == 1
    assert execution.logs.stdout == ["Hello from e2b\n"]


def test_stderr(sandbox: Sandbox):
    stderr = []
    execution = sandbox.run_code(
        'import sys;print("This is an error message", file=sys.stderr)',
        on_stderr=lambda err: stderr.append(err),
    )
    assert len(stderr) == 1
    assert execution.logs.stderr == ["This is an error message\n"]
