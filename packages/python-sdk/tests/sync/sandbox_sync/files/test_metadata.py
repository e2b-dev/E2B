def test_write_file_with_metadata(sandbox, debug):
    filename = "test_metadata.txt"
    content = "This is a test file with metadata."
    metadata = {"author": "mish", "purpose": "upload"}

    info = sandbox.files.write(filename, content, metadata=metadata)
    assert info.metadata == metadata

    # Metadata is persisted and surfaced on subsequent reads.
    stat = sandbox.files.get_info(filename)
    assert stat.metadata == metadata

    if debug:
        sandbox.files.remove(filename)


def test_write_file_with_metadata_octet_stream(sandbox, debug):
    filename = "test_metadata_octet.txt"
    content = "This is a test file with metadata."
    metadata = {"author": "mish", "purpose": "upload"}

    info = sandbox.files.write(
        filename, content, metadata=metadata, use_octet_stream=True
    )
    assert info.metadata == metadata

    stat = sandbox.files.get_info(filename)
    assert stat.metadata == metadata

    if debug:
        sandbox.files.remove(filename)


def test_write_file_without_metadata(sandbox, debug):
    filename = "test_no_metadata.txt"

    info = sandbox.files.write(filename, "no metadata here")
    assert info.metadata is None

    stat = sandbox.files.get_info(filename)
    assert stat.metadata is None

    if debug:
        sandbox.files.remove(filename)


def test_write_files_applies_metadata_to_every_file(sandbox, debug):
    from e2b.sandbox.filesystem.filesystem import WriteEntry

    metadata = {"source": "test-suite"}
    files = [
        WriteEntry(path="metadata_multi_1.txt", data="File 1"),
        WriteEntry(path="metadata_multi_2.txt", data="File 2"),
    ]

    infos = sandbox.files.write_files(files, metadata=metadata)
    assert len(infos) == len(files)

    for info in infos:
        assert info.metadata == metadata
        stat = sandbox.files.get_info(info.path)
        assert stat.metadata == metadata

    if debug:
        for file in files:
            sandbox.files.remove(file["path"])


def test_metadata_surfaced_when_listing(sandbox, debug):
    dirname = "metadata_list_dir"
    filename = "listed.txt"
    metadata = {"tag": "listed"}

    sandbox.files.make_dir(dirname)
    sandbox.files.write(f"{dirname}/{filename}", "content", metadata=metadata)

    entries = sandbox.files.list(dirname)
    entry = next((e for e in entries if e.name == filename), None)
    assert entry is not None
    assert entry.metadata == metadata

    if debug:
        sandbox.files.remove(dirname)


def test_metadata_surfaced_after_rename(sandbox, debug):
    old_path = "metadata_rename_old.txt"
    new_path = "metadata_rename_new.txt"
    metadata = {"stage": "renamed"}

    sandbox.files.write(old_path, "content", metadata=metadata)
    info = sandbox.files.rename(old_path, new_path)
    assert info.metadata == metadata

    if debug:
        sandbox.files.remove(new_path)


def test_overwriting_clears_stale_metadata(sandbox, debug):
    filename = "metadata_overwrite.txt"

    sandbox.files.write(filename, "first", metadata={"author": "mish"})

    # Overwriting without metadata removes the previously stored metadata.
    info = sandbox.files.write(filename, "second")
    assert info.metadata is None

    stat = sandbox.files.get_info(filename)
    assert stat.metadata is None

    if debug:
        sandbox.files.remove(filename)
