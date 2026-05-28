import pytest
from e2b import FileNotFoundException, InvalidArgumentException, NotFoundException


def test_read_file(sandbox):
    filename = "test_read.txt"
    content = "Hello, world!"

    sandbox.files.write(filename, content)
    read_content = sandbox.files.read(filename)
    assert read_content == content


def test_read_non_existing_file(sandbox):
    filename = "non_existing_file.txt"

    with pytest.raises(FileNotFoundException):
        sandbox.files.read(filename)


def test_read_non_existing_file_catches_with_deprecated_not_found_exception(sandbox):
    filename = "non_existing_file.txt"

    with pytest.raises(NotFoundException):
        sandbox.files.read(filename)


def test_read_empty_file(sandbox):
    filename = "empty_file.txt"
    content = ""

    sandbox.commands.run(f"touch {filename}")
    read_content = sandbox.files.read(filename)
    assert read_content == content


def test_read_with_start_and_end(sandbox):
    filename = "test_read_range.txt"
    sandbox.files.write(filename, "Hello, world!")
    assert sandbox.files.read(filename, start=7, end=11) == "world"


def test_read_with_start_only(sandbox):
    filename = "test_read_start.txt"
    sandbox.files.write(filename, "Hello, world!")
    assert sandbox.files.read(filename, start=7) == "world!"


def test_read_with_end_only(sandbox):
    filename = "test_read_end.txt"
    sandbox.files.write(filename, "Hello, world!")
    assert sandbox.files.read(filename, end=4) == "Hello"


def test_read_range_as_bytes(sandbox):
    filename = "test_read_range_bytes.txt"
    sandbox.files.write(filename, "Hello, world!")
    sliced = sandbox.files.read(filename, format="bytes", start=7, end=11)
    assert bytes(sliced).decode("utf-8") == "world"


def test_read_with_invalid_range_rejects(sandbox):
    filename = "test_read_invalid_range.txt"
    sandbox.files.write(filename, "data")

    with pytest.raises(InvalidArgumentException):
        sandbox.files.read(filename, start=-1)
    with pytest.raises(InvalidArgumentException):
        sandbox.files.read(filename, start=5, end=2)
