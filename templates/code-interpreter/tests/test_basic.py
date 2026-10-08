import pytest
from e2b import Sandbox

from conftest import make_client
from harness import CodeInterpreter


def test_health(client: CodeInterpreter):
    response = client.health()
    assert response.status_code == 200
    assert response.json() == "OK"


def test_basic(client: CodeInterpreter):
    execution = client.run_code("x =1; x")
    assert execution.text == "1"
    assert execution.completed


def test_stateful(client: CodeInterpreter):
    client.run_code("test_stateful = 1")

    execution = client.run_code("test_stateful+=1; test_stateful")
    assert execution.text == "2"


def test_stdout(client: CodeInterpreter):
    execution = client.run_code("print('Hello from e2b')")
    assert execution.stdout == ["Hello from e2b\n"]


def test_stderr(client: CodeInterpreter):
    execution = client.run_code(
        'import sys;print("This is an error message", file=sys.stderr)'
    )
    assert execution.stderr == ["This is an error message\n"]


def test_error(client: CodeInterpreter):
    execution = client.run_code("xyz")
    assert execution.error is not None
    assert execution.error.name == "NameError"
    assert execution.error.value == "name 'xyz' is not defined"
    assert "NameError" in execution.error.traceback


def test_bash_magic(client: CodeInterpreter):
    execution = client.run_code("!pwd")
    assert "".join(execution.stdout).strip() == "/home/user"


@pytest.mark.skip_debug
def test_execution_count(client: CodeInterpreter):
    client.run_code("echo 'E2B is awesome!'")
    execution = client.run_code("!pwd")
    assert execution.execution_count == 2


@pytest.mark.skip_debug
def test_secure_access(client_factory):
    client = client_factory(allow_public_traffic=False)
    execution = client.run_code("x =1; x")
    assert execution.text == "1"


@pytest.mark.skip_debug
def test_reconnected_sandbox_keeps_state(sandbox: Sandbox):
    first = make_client(sandbox)
    first.run_code("x = 1")
    first.close()

    second = make_client(Sandbox.connect(sandbox.sandbox_id))
    execution = second.run_code("x")
    second.close()
    assert execution.text == "1"
