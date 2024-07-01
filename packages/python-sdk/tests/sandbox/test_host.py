from time import sleep

import pytest
import requests


def test_ping_server(sandbox, debug):
    cmd = sandbox.commands.run("python -m http.server 8000", background=True)

    try:
        sleep(1)
        host = sandbox.get_host(8000)
        res = requests.get(f"{'http' if debug else 'https'}://{host}")
        assert res.status_code == 200

    finally:
        cmd.kill()
