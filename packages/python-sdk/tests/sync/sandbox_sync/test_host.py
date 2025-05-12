import httpx

from time import sleep


def test_ping_server(sandbox, debug, helpers):
    cmd = sandbox.commands.run("python -m http.server 8001", background=True)

    try:
        host = sandbox.get_host(8001)
        status_code = None
        for _ in range(20):
            res = httpx.get(f"{'http' if debug else 'https'}://{host}")
            status_code = res.status_code
            if res.status_code == 200:
                break
            sleep(0.5)

        assert status_code == 200
    except Exception as e:
        helpers.check_cmd_exit_error(cmd)
        raise e
    finally:
        cmd.kill()
