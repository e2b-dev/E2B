import io

import pytest

from e2b import InvalidArgumentException

from e2b.sandbox.filesystem.filesystem import FileType, WriteInfo, WriteEntry


def test_write_text_file(sandbox, debug):
    filename = "test_write.txt"
    content = "This is a test file."

    info = sandbox.files.write(filename, content)
    assert info.path == f"/home/user/{filename}"
    assert info.type == FileType.FILE

    exists = sandbox.files.exists(filename)
    assert exists

    read_content = sandbox.files.read(filename)
    assert read_content == content

    if debug:
        sandbox.files.remove(filename)


def test_write_binary_file(sandbox, debug):
    filename = "test_write.bin"
    text = "This is a test binary file."
    # equivalent to `open("path/to/local/file", "rb")`
    content = io.BytesIO(text.encode("utf-8"))

    info = sandbox.files.write(filename, content)
    assert info.path == f"/home/user/{filename}"

    exists = sandbox.files.exists(filename)
    assert exists

    read_content = sandbox.files.read(filename)
    assert read_content == text

    if debug:
        sandbox.files.remove(filename)


def test_write_multiple_files(sandbox, debug):
    num_test_files = 10

    # Attempt to write with empty files array
    empty_info = sandbox.files.write_files([])
    assert isinstance(empty_info, list)
    assert len(empty_info) == 0

    # Attempt to write with no files
    assert sandbox.files.write_files([]) == []

    # Attempt to write with one file in array
    one_file_path = "one_test_file.txt"
    info = sandbox.files.write_files(
        [WriteEntry(path=one_file_path, data="This is a test file.")]
    )

    assert isinstance(info, list)
    assert len(info) == 1
    info = info[0]
    assert isinstance(info, WriteInfo)
    assert info.path == "/home/user/one_test_file.txt"
    exists = sandbox.files.exists(info.path)
    assert exists

    read_content = sandbox.files.read(info.path)
    assert read_content == "This is a test file."

    # Attempt to write with multiple files in array
    files = []
    for i in range(num_test_files):
        path = f"test_write_{i}.txt"
        content = f"This is a test file {i}."
        files.append(WriteEntry(path=path, data=content))

    infos = sandbox.files.write_files(files)
    assert isinstance(infos, list)
    assert len(infos) == len(files)
    for i, info in enumerate(infos):
        assert isinstance(info, WriteInfo)
        assert info.path == f"/home/user/test_write_{i}.txt"
        assert info.type == FileType.FILE
        exists = sandbox.files.exists(path)
        assert exists

        read_content = sandbox.files.read(info.path)
        assert read_content == files[i]["data"]

    if debug:
        sandbox.files.remove(one_file_path)
        for i in range(num_test_files):
            sandbox.files.remove(f"test_write_{i}.txt")


def test_overwrite_file(sandbox, debug):
    filename = "test_overwrite.txt"
    initial_content = "Initial content."
    new_content = "New content."

    sandbox.files.write(filename, initial_content)
    sandbox.files.write(filename, new_content)
    read_content = sandbox.files.read(filename)
    assert read_content == new_content

    if debug:
        sandbox.files.remove(filename)


def test_write_to_non_existing_directory(sandbox, debug):
    filename = "non_existing_dir/test_write.txt"
    content = "This should succeed too."

    sandbox.files.write(filename, content)
    exists = sandbox.files.exists(filename)
    assert exists

    read_content = sandbox.files.read(filename)
    assert read_content == content

    if debug:
        sandbox.files.remove(filename)


def test_write_files_with_different_data_types(sandbox, debug):
    text_data = "Text string data"
    bytes_data = b"Bytes data"
    bytes_io_data = io.BytesIO(b"BytesIO data")
    string_io_data = io.StringIO("StringIO data")

    files = [
        WriteEntry(path="writefiles_text.txt", data=text_data),
        WriteEntry(path="writefiles_bytes.bin", data=bytes_data),
        WriteEntry(path="writefiles_bytesio.bin", data=bytes_io_data),
        WriteEntry(path="writefiles_stringio.txt", data=string_io_data),
    ]

    infos = sandbox.files.write_files(files)

    assert len(infos) == 4

    text_content = sandbox.files.read("writefiles_text.txt")
    assert text_content == text_data

    bytes_content = sandbox.files.read("writefiles_bytes.bin")
    assert bytes_content == "Bytes data"

    bytes_io_content = sandbox.files.read("writefiles_bytesio.bin")
    assert bytes_io_content == "BytesIO data"

    string_io_content = sandbox.files.read("writefiles_stringio.txt")
    assert string_io_content == "StringIO data"

    if debug:
        for file in files:
            sandbox.files.remove(file["path"])


def test_write_io_with_octet_stream(sandbox, debug):
    filename = "test_write_octet_io.bin"
    text = "Streamed octet-stream upload. " * 10_000
    content = io.BytesIO(text.encode("utf-8"))

    info = sandbox.files.write(filename, content, use_octet_stream=True)
    assert info.path == f"/home/user/{filename}"

    read_content = sandbox.files.read(filename)
    assert read_content == text

    if debug:
        sandbox.files.remove(filename)


def test_write_text_io_with_octet_stream(sandbox, debug):
    filename = "test_write_octet_text_io.txt"
    text = "Streamed text octet-stream upload."

    sandbox.files.write(filename, io.StringIO(text), use_octet_stream=True)

    read_content = sandbox.files.read(filename)
    assert read_content == text

    if debug:
        sandbox.files.remove(filename)


def test_write_io_with_octet_stream_and_gzip(sandbox, debug):
    filename = "test_write_octet_io_gzip.bin"
    text = "Streamed gzipped octet-stream upload. " * 10_000
    content = io.BytesIO(text.encode("utf-8"))

    sandbox.files.write(filename, content, use_octet_stream=True, gzip=True)

    read_content = sandbox.files.read(filename)
    assert read_content == text

    if debug:
        sandbox.files.remove(filename)


def test_write_iterable_of_bytes(sandbox, debug):
    filename = "test_write_iterable.bin"
    text = "Streamed iterable upload. " * 10_000

    def chunks():
        data = text.encode("utf-8")
        for i in range(0, len(data), 4096):
            yield data[i : i + 4096]

    info = sandbox.files.write(filename, chunks())
    assert info.path == f"/home/user/{filename}"
    assert sandbox.files.read(filename) == text

    sandbox.files.write(filename, chunks(), gzip=True)
    assert sandbox.files.read(filename) == text

    with pytest.raises(InvalidArgumentException):
        sandbox.files.write(filename, chunks(), use_octet_stream=False)

    with pytest.raises(InvalidArgumentException, match="gzip"):
        sandbox.files.write(filename, chunks(), gzip=True, use_octet_stream=False)

    if debug:
        sandbox.files.remove(filename)


def test_write_iterable_rejects_non_bytes_chunks(sandbox):
    with pytest.raises(InvalidArgumentException, match="bytes chunks"):
        sandbox.files.write("test_write_bad_chunks.bin", iter([b"ok", "text"]))


@pytest.mark.parametrize("use_octet_stream", [True, False])
def test_write_file_like_wrapper(sandbox, debug, use_octet_stream):
    import tempfile

    filename = "test_write_wrapper.bin"
    data = bytes(range(256)) * 1024
    # Not an `IOBase`, but has `read` (and `__iter__`, which yields lines).
    with tempfile.NamedTemporaryFile() as f:
        f.write(data)
        f.flush()
        f.seek(0)
        sandbox.files.write(filename, f, use_octet_stream=use_octet_stream)
    assert bytes(sandbox.files.read(filename, format="bytes")) == data

    if debug:
        sandbox.files.remove(filename)


@pytest.mark.parametrize("use_octet_stream", [True, False])
def test_write_text_file_like_wrapper(sandbox, debug, use_octet_stream):
    import tempfile

    filename = "test_write_text_wrapper.txt"
    text = "héllo wörld " * 1000
    # Its encoding differs from the UTF-8 upload, so the byte length changes.
    with tempfile.NamedTemporaryFile(mode="w+", encoding="latin-1") as f:
        f.write(text)
        f.flush()
        f.seek(0)
        sandbox.files.write(filename, f, use_octet_stream=use_octet_stream)
    assert sandbox.files.read(filename) == text

    if debug:
        sandbox.files.remove(filename)
