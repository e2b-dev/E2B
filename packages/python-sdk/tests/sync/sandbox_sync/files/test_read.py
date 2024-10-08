import pytest
from e2b import NotFoundException


def test_read_file(sandbox):
    filename = "test_read.txt"
    content = "Hello, world!"

    sandbox.files.write(filename, content)
    read_content = sandbox.files.read(filename)
    assert read_content == content


def test_read_non_existing_file(sandbox):
    filename = "non_existing_file.txt"

    with pytest.raises(NotFoundException):
        sandbox.files.read(filename)


def test_read_empty_file(sandbox):
    filename = "empty_file.txt"
    content = ""

    sandbox.commands.run(f"touch {filename}")
    read_content = sandbox.files.read(filename)
    assert read_content == content
