import pytest
import json
import httpx
import time
from e2b import Sandbox


def test_port_closed(template):
    sbx = Sandbox(template, timeout=60)
    try:
        assert sbx.is_running()
        
        good_port = 8000
        # Start a Python HTTP server on port 8000
        sbx.commands.run(
            f"python -m http.server {good_port}",
            background=True,
        )
        time.sleep(1)  # Wait for server to start
        
        # Test good port (8000)
        good_host = sbx.get_host(good_port)
        with httpx.Client() as client:
            for _ in range(10):
                try:
                    response = client.get(f"https://{good_host}")
                    if response.status_code == 200:
                        break
                except httpx.RequestError:
                    pass
                time.sleep(0.5)
            assert response.status_code == 200

        # Test bad port (3000)
        bad_port = 3000
        bad_host = sbx.get_host(bad_port)
        with httpx.Client() as client:
            for _ in range(10):
                try:
                    response = client.get(f"https://{bad_host}")
                    if response.status_code == 502:
                        break
                except httpx.RequestError:
                    pass
                time.sleep(0.5)
            assert response.status_code == 502
            resp_text = response.text
            resp = json.loads(resp_text)
            cleaned_sbx_id = sbx.sandbox_id.split("-")[0]
            assert resp["error"] == "The sandbox is running but port is not open"
            assert cleaned_sbx_id == resp["sandboxId"]
            assert resp["port"] == f":{bad_port}"
    finally:
        sbx.kill()
