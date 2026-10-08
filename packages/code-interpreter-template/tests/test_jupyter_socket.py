import pytest
from e2b import CommandExitException, Sandbox

from conftest import make_client

pytestmark = pytest.mark.skip_debug

SOCKET_DIR = "/run/e2b-jupyter"
SOCKET_PATH = f"{SOCKET_DIR}/server.sock"
CURL_STATUS = (
    f"curl -s -o /dev/null -w '%{{http_code}}' --unix-socket {SOCKET_PATH} "
    "http://localhost/api/status"
)


def test_socket_is_private_to_root(sandbox: Sandbox):
    result = sandbox.commands.run(
        f"stat -c '%a %U' {SOCKET_DIR} {SOCKET_PATH}", user="root"
    )
    assert result.stdout.split("\n")[:2] == ["700 root", "600 root"]


def test_jupyter_api_is_served_over_the_socket(sandbox: Sandbox):
    assert sandbox.commands.run(CURL_STATUS, user="root").stdout == "200"


def test_socket_is_not_reachable_by_user(sandbox: Sandbox):
    with pytest.raises(CommandExitException) as error:
        sandbox.commands.run(CURL_STATUS, user="user")
    assert error.value.exit_code == 7  # curl: failed to connect


def test_jupyter_has_no_tcp_listener(sandbox: Sandbox):
    listeners = sandbox.commands.run("ss -ltnH", user="root").stdout
    assert ":8888" not in listeners

    # The kernel runs inside the sandbox, so this is the loopback view
    # jupyter-server's TCP port would be exposed on.
    execution = make_client(sandbox).run_code(
        "import socket\nsocket.socket().connect_ex(('127.0.0.1', 8888)) != 0"
    )
    assert execution.text == "True"
