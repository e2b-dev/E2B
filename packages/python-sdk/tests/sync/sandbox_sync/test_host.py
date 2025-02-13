import httpx

from time import sleep


def test_ping_server(sandbox, debug):
    cmd = sandbox.commands.run("python -m http.server 8001", background=True)

    try:
        sleep(5)
        host = sandbox.get_host(8001)
        res = httpx.get(f"{'http' if debug else 'https'}://{host}")
        assert res.status_code == 200

    finally:
        cmd.kill()
