import pytest
from e2b import FileNotFoundException, NotFoundException


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


def test_read_file_as_stream(sandbox):
    filename = "test_read_stream.txt"
    content = "Streamed read content. " * 10_000

    sandbox.files.write(filename, content)
    stream = sandbox.files.read(filename, format="stream")
    read_content = b"".join(stream).decode("utf-8")
    assert read_content == content


def test_read_file_as_stream_with_gzip(sandbox):
    filename = "test_read_stream_gzip.txt"
    content = "Streamed gzipped read content. " * 10_000

    sandbox.files.write(filename, content)
    stream = sandbox.files.read(filename, format="stream", gzip=True)
    read_content = b"".join(stream).decode("utf-8")
    assert read_content == content


def test_read_non_existing_file_as_stream(sandbox):
    filename = "non_existing_file.txt"

    with pytest.raises(FileNotFoundException):
        sandbox.files.read(filename, format="stream")


def test_read_file_as_stream_context_manager(sandbox):
    filename = "test_read_stream_ctx.txt"
    content = "Streamed read content. " * 10_000

    sandbox.files.write(filename, content)
    with sandbox.files.read(filename, format="stream") as stream:
        read_content = b"".join(stream).decode("utf-8")
    assert read_content == content


def test_read_file_as_stream_partial_then_close(sandbox):
    filename = "test_read_stream_partial.txt"
    content = "Streamed read content. " * 10_000

    sandbox.files.write(filename, content)
    # Reading only the first chunk and closing must not raise or leak.
    stream = sandbox.files.read(filename, format="stream")
    first = next(iter(stream))
    assert len(first) > 0
    stream.close()
