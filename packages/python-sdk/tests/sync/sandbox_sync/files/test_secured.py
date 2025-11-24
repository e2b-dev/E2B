import urllib.request
import urllib.error
import json
import pytest


@pytest.mark.skip_debug()
def test_download_url_with_signing(sandbox_factory):
    sbx = sandbox_factory(timeout=100, secure=True)
    file_path = "test_download_url_with_signing.txt"
    file_content = "This file will be watched."

    sbx.files.write(file_path, file_content)
    signed_url = sbx.download_url(file_path, "user")

    with urllib.request.urlopen(signed_url) as resp:
        assert resp.status == 200
        body_bytes = resp.read()
        body_text = body_bytes.decode()
        assert body_text == file_content


@pytest.mark.skip_debug()
def test_download_url_with_signing_and_expiration(sandbox_factory):
    sbx = sandbox_factory(timeout=100, secure=True)
    file_path = "test_download_url_with_signing.txt"
    file_content = "This file will be watched."

    sbx.files.write(file_path, file_content)
    signed_url = sbx.download_url(file_path, "user", 120)

    with urllib.request.urlopen(signed_url) as resp:
        assert resp.status == 200
        body_bytes = resp.read()
        body_text = body_bytes.decode()
        assert body_text == file_content


@pytest.mark.skip_debug()
def test_download_url_with_expired_signing(sandbox_factory):
    sbx = sandbox_factory(timeout=100, secure=True)
    file_path = "test_download_url_with_signing.txt"
    file_content = "This file will be watched."

    sbx.files.write(file_path, file_content)

    signed_url = sbx.download_url(file_path, "user", use_signature_expiration=-120)

    with pytest.raises(urllib.error.HTTPError) as exc_info:
        urllib.request.urlopen(signed_url)

    err = exc_info.value
    assert err.code == 401, f"Unexpected status {err.code}"

    error_json_str = err.read().decode()  # bytes ➜ str
    error_payload = json.loads(error_json_str)  # str  ➜ dict

    expected_payload = {"code": 401, "message": "signature is already expired"}
    assert error_payload == expected_payload
