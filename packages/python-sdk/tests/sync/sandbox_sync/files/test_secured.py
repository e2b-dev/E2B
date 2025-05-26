import json
import urllib.error
import urllib.request

import pytest

from e2b import Sandbox


@pytest.mark.skip_debug()
async def test_download_url_with_signing(template):
    sbx = Sandbox(template, timeout=100, secure=True)
    file_path = "test_download_url_with_signing.txt"
    file_content = "This file will be watched."

    try:
        sbx.files.write(file_path, file_content)
        signed_url = sbx.download_url(file_path, "user", True)

        with urllib.request.urlopen(signed_url) as resp:
            assert resp.status == 200
            body_bytes = resp.read()
            body_text = body_bytes.decode()
            assert body_text == file_content
    finally:
        sbx.kill()


@pytest.mark.skip_debug()
async def test_download_url_with_signing_and_expiration(template):
    sbx = Sandbox(template, timeout=100, secure=True)
    file_path = "test_download_url_with_signing.txt"
    file_content = "This file will be watched."

    try:
        sbx.files.write(file_path, file_content)
        signed_url = sbx.download_url(file_path, "user", True, 120)

        with urllib.request.urlopen(signed_url) as resp:
            assert resp.status == 200
            body_bytes = resp.read()
            body_text = body_bytes.decode()
            assert body_text == file_content
    finally:
        sbx.kill()


@pytest.mark.skip_debug()
async def test_download_url_with_expired_signing(template):
    sbx = Sandbox(template, timeout=100, secure=True)
    file_path = "test_download_url_with_signing.txt"
    file_content = "This file will be watched."

    try:
        sbx.files.write(file_path, file_content)

        signed_url = sbx.download_url(
            file_path, "user", use_signature=True, use_signature_expiration=-120
        )

        with pytest.raises(urllib.error.HTTPError) as exc_info:
            urllib.request.urlopen(signed_url)

        err = exc_info.value
        assert err.code == 401, f"Unexpected status {err.code}"

        error_json_str = err.read().decode()  # bytes ➜ str
        error_payload = json.loads(error_json_str)  # str  ➜ dict

        expected_payload = {"code": 401, "message": "signature is already expired"}
        assert error_payload == expected_payload

    finally:
        sbx.kill()
