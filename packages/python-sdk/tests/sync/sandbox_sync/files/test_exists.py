from e2b import Sandbox


def test_exists(sandbox: Sandbox):
    filename = "test_exists.txt"

    sandbox.files.write([{ "path": filename, "data": "test" }])
    assert sandbox.files.exists(filename)
