from e2b import AsyncSandbox
from e2b.sandbox.filesystem.filesystem import WriteEntry


async def test_write_file_with_metadata(async_sandbox: AsyncSandbox, debug):
    filename = "test_metadata.txt"
    content = "This is a test file with metadata."
    metadata = {"author": "mish", "purpose": "upload"}

    info = await async_sandbox.files.write(filename, content, metadata=metadata)
    assert info.metadata == metadata

    # Metadata is persisted and surfaced on subsequent reads.
    stat = await async_sandbox.files.get_info(filename)
    assert stat.metadata == metadata

    if debug:
        await async_sandbox.files.remove(filename)


async def test_write_file_with_metadata_octet_stream(
    async_sandbox: AsyncSandbox, debug
):
    filename = "test_metadata_octet.txt"
    content = "This is a test file with metadata."
    metadata = {"author": "mish", "purpose": "upload"}

    info = await async_sandbox.files.write(
        filename, content, metadata=metadata, use_octet_stream=True
    )
    assert info.metadata == metadata

    stat = await async_sandbox.files.get_info(filename)
    assert stat.metadata == metadata

    if debug:
        await async_sandbox.files.remove(filename)


async def test_write_file_without_metadata(async_sandbox: AsyncSandbox, debug):
    filename = "test_no_metadata.txt"

    info = await async_sandbox.files.write(filename, "no metadata here")
    assert info.metadata is None

    stat = await async_sandbox.files.get_info(filename)
    assert stat.metadata is None

    if debug:
        await async_sandbox.files.remove(filename)


async def test_write_files_applies_metadata_to_every_file(
    async_sandbox: AsyncSandbox, debug
):
    metadata = {"source": "test-suite"}
    files = [
        WriteEntry(path="metadata_multi_1.txt", data="File 1"),
        WriteEntry(path="metadata_multi_2.txt", data="File 2"),
    ]

    infos = await async_sandbox.files.write_files(files, metadata=metadata)
    assert len(infos) == len(files)

    for info in infos:
        assert info.metadata == metadata
        stat = await async_sandbox.files.get_info(info.path)
        assert stat.metadata == metadata

    if debug:
        for file in files:
            await async_sandbox.files.remove(file["path"])


async def test_metadata_surfaced_when_listing(async_sandbox: AsyncSandbox, debug):
    dirname = "metadata_list_dir"
    filename = "listed.txt"
    metadata = {"tag": "listed"}

    await async_sandbox.files.make_dir(dirname)
    await async_sandbox.files.write(
        f"{dirname}/{filename}", "content", metadata=metadata
    )

    entries = await async_sandbox.files.list(dirname)
    entry = next((e for e in entries if e.name == filename), None)
    assert entry is not None
    assert entry.metadata == metadata

    if debug:
        await async_sandbox.files.remove(dirname)


async def test_metadata_surfaced_after_rename(async_sandbox: AsyncSandbox, debug):
    old_path = "metadata_rename_old.txt"
    new_path = "metadata_rename_new.txt"
    metadata = {"stage": "renamed"}

    await async_sandbox.files.write(old_path, "content", metadata=metadata)
    info = await async_sandbox.files.rename(old_path, new_path)
    assert info.metadata == metadata

    if debug:
        await async_sandbox.files.remove(new_path)


async def test_overwriting_clears_stale_metadata(async_sandbox: AsyncSandbox, debug):
    filename = "metadata_overwrite.txt"

    await async_sandbox.files.write(filename, "first", metadata={"author": "mish"})

    # Overwriting without metadata removes the previously stored metadata.
    info = await async_sandbox.files.write(filename, "second")
    assert info.metadata is None

    stat = await async_sandbox.files.get_info(filename)
    assert stat.metadata is None

    if debug:
        await async_sandbox.files.remove(filename)
