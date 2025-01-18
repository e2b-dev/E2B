import httpx

from time import sleep


def test_ping_server(sandbox, debug):
    cmd = sandbox.commands.run("python -m http.server 8001", background=True)

    try:
        host = sandbox.get_host(8001)
        status_code = None
        for _ in range(5):
            res = httpx.get(f"{'http' if debug else 'https'}://{host}")
            status_code = res.status_code
            if res.status_code == 200:
                break
            sleep(0.5)

        assert status_code == 200
    finally:
        cmd.kill()
