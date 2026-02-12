from e2b.sandbox.filesystem.filesystem import WriteEntry


def test_write_and_read_with_gzip(sandbox, debug):
    filename = "test_gzip_write.txt"
    content = "This is a test file with gzip encoding."

    info = sandbox.files.write(filename, content, content_encoding="gzip")
    assert info.path == f"/home/user/{filename}"

    read_content = sandbox.files.read(filename, content_encoding="gzip")
    assert read_content == content

    if debug:
        sandbox.files.remove(filename)


def test_write_gzip_read_plain(sandbox, debug):
    filename = "test_gzip_write_plain_read.txt"
    content = "Written with gzip, read without."

    sandbox.files.write(filename, content, content_encoding="gzip")

    read_content = sandbox.files.read(filename)
    assert read_content == content

    if debug:
        sandbox.files.remove(filename)


def test_write_files_with_gzip(sandbox, debug):
    files = [
        WriteEntry(path="gzip_multi_1.txt", data="File 1 content"),
        WriteEntry(path="gzip_multi_2.txt", data="File 2 content"),
        WriteEntry(path="gzip_multi_3.txt", data="File 3 content"),
    ]

    infos = sandbox.files.write_files(files, content_encoding="gzip")
    assert len(infos) == len(files)

    for i, file in enumerate(files):
        read_content = sandbox.files.read(file["path"])
        assert read_content == file["data"]

    if debug:
        for file in files:
            sandbox.files.remove(file["path"])


def test_read_bytes_with_gzip(sandbox, debug):
    filename = "test_gzip_bytes.txt"
    content = "Binary content with gzip."

    sandbox.files.write(filename, content)

    read_bytes = sandbox.files.read(filename, format="bytes", content_encoding="gzip")
    assert isinstance(read_bytes, bytearray)
    assert read_bytes.decode("utf-8") == content

    if debug:
        sandbox.files.remove(filename)
