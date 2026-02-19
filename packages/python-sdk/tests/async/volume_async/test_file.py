import datetime
from io import BytesIO

import pytest

from e2b import AsyncVolume
from e2b.exceptions import NotFoundException


class TestWriteFileAndReadFile:
    async def test_write_and_read_text_file(self, async_volume: AsyncVolume):
        path = "/test.txt"
        content = "Hello, World!"

        await async_volume.write_file(path, content)
        read_content = await async_volume.read_file(path, format="text")

        assert read_content == content

    async def test_write_and_read_bytes(self, async_volume: AsyncVolume):
        path = "/test-bytes.txt"
        content = "Test bytes content"
        content_bytes = content.encode("utf-8")

        await async_volume.write_file(path, content_bytes)
        read_bytes = await async_volume.read_file(path, format="bytes")

        assert read_bytes == content_bytes

    async def test_write_and_read_stream(self, async_volume: AsyncVolume):
        path = "/test-stream.txt"
        content = "Test stream content"
        stream = BytesIO(content.encode("utf-8"))

        await async_volume.write_file(path, stream)
        read_content = await async_volume.read_file(path, format="text")

        assert read_content == content

    async def test_write_and_read_empty_file(self, async_volume: AsyncVolume):
        path = "/empty.txt"
        content = ""

        await async_volume.write_file(path, content)
        read_content = await async_volume.read_file(path, format="text")

        assert read_content == content

    async def test_overwrite_with_force(self, async_volume: AsyncVolume):
        path = "/overwrite.txt"
        initial_content = "Initial content"
        new_content = "New content"

        await async_volume.write_file(path, initial_content)
        await async_volume.write_file(path, new_content, force=True)
        read_content = await async_volume.read_file(path, format="text")

        assert read_content == new_content

    async def test_write_file_with_metadata(self, async_volume: AsyncVolume):
        path = "/metadata.txt"
        content = "File with metadata"

        await async_volume.write_file(path, content, uid=1000, gid=1000, mode=0o644)

        entry_info = await async_volume.get_info(path)
        assert entry_info.type.value == "file"
        assert entry_info.uid == 1000
        assert entry_info.gid == 1000
        assert entry_info.mode == 0o644

    async def test_write_file_in_nested_directory(self, async_volume: AsyncVolume):
        dir_path = "/nested/deep/path"
        file_path = f"{dir_path}/file.txt"
        content = "Nested file content"

        await async_volume.make_dir(dir_path, force=True)
        await async_volume.write_file(file_path, content)
        read_content = await async_volume.read_file(file_path, format="text")

        assert read_content == content


class TestGetInfo:
    async def test_get_info_for_file(self, async_volume: AsyncVolume):
        path = "/info-file.txt"
        content = "File for info test"

        await async_volume.write_file(path, content)
        info = await async_volume.get_info(path)

        assert info.name == "info-file.txt"
        assert info.type.value == "file"
        assert info.path == path
        assert isinstance(info.mtime, datetime.datetime)
        assert isinstance(info.ctime, datetime.datetime)

    async def test_get_info_for_directory(self, async_volume: AsyncVolume):
        path = "/info-dir"

        await async_volume.make_dir(path)
        info = await async_volume.get_info(path)

        assert info.name == "info-dir"
        assert info.type.value == "directory"
        assert info.path == path

    async def test_exists_returns_false_for_nonexistent(
        self, async_volume: AsyncVolume
    ):
        assert await async_volume.exists("/non-existent.txt") is False


class TestUpdateMetadata:
    async def test_update_file_metadata(self, async_volume: AsyncVolume):
        path = "/metadata-update.txt"
        await async_volume.write_file(path, "Content")

        updated = await async_volume.update_metadata(
            path, uid=1001, gid=1001, mode=0o755
        )

        assert updated.path == path
        assert updated.type.value == "file"
        assert updated.uid == 1001
        assert updated.gid == 1001
        assert updated.mode == 0o755

    async def test_update_metadata_nonexistent_raises(self, async_volume: AsyncVolume):
        with pytest.raises(NotFoundException):
            await async_volume.update_metadata("/non-existent.txt", mode=0o644)


class TestMakeDir:
    async def test_create_directory(self, async_volume: AsyncVolume):
        path = "/test-dir"

        await async_volume.make_dir(path)
        info = await async_volume.get_info(path)

        assert info.type.value == "directory"
        assert info.path == path

    async def test_create_nested_directories_with_force(
        self, async_volume: AsyncVolume
    ):
        path = "/nested/deep/directory"

        await async_volume.make_dir(path, force=True)
        info = await async_volume.get_info(path)

        assert info.type.value == "directory"

    async def test_create_directory_with_metadata(self, async_volume: AsyncVolume):
        path = "/dir-with-metadata"

        await async_volume.make_dir(path, uid=1000, gid=1000, mode=0o755)

        info = await async_volume.get_info(path)
        assert info.type.value == "directory"
        assert info.uid == 1000
        assert info.gid == 1000
        assert info.mode & 0o777 == 0o755


class TestList:
    async def test_list_directory_contents(self, async_volume: AsyncVolume):
        await async_volume.write_file("/file1.txt", "Content 1")
        await async_volume.write_file("/file2.txt", "Content 2")
        await async_volume.make_dir("/dir1")

        entries = await async_volume.list("/")

        assert len(entries) >= 3
        file_names = sorted([e.name for e in entries])
        assert "file1.txt" in file_names
        assert "file2.txt" in file_names
        assert "dir1" in file_names

    async def test_list_nested_directory(self, async_volume: AsyncVolume):
        await async_volume.make_dir("/nested", force=True)
        await async_volume.write_file("/nested/file.txt", "Content")

        entries = await async_volume.list("/nested")

        assert len(entries) >= 1
        assert any(e.name == "file.txt" for e in entries)

    @pytest.mark.skip(reason="depth option not yet supported")
    async def test_list_with_depth(self, async_volume: AsyncVolume):
        await async_volume.make_dir("/deep/nested/structure", force=True)
        await async_volume.write_file("/deep/nested/structure/file.txt", "Content")

        entries = await async_volume.list("/deep", depth=2)

        assert len(entries) > 0

    async def test_list_nonexistent_raises(self, async_volume: AsyncVolume):
        with pytest.raises(NotFoundException):
            await async_volume.list("/non-existent")


class TestRemove:
    async def test_remove_file(self, async_volume: AsyncVolume):
        path = "/to-remove.txt"
        await async_volume.write_file(path, "Content")

        await async_volume.remove(path)

        assert await async_volume.exists(path) is False

    async def test_remove_directory(self, async_volume: AsyncVolume):
        path = "/to-remove-dir"
        await async_volume.make_dir(path)

        await async_volume.remove(path)

        assert await async_volume.exists(path) is False

    async def test_remove_directory_recursively(self, async_volume: AsyncVolume):
        dir_path = "/recursive-dir"
        await async_volume.make_dir(f"{dir_path}/nested", force=True)
        await async_volume.write_file(f"{dir_path}/nested/file.txt", "Content")

        await async_volume.remove(dir_path, recursive=True)

        assert await async_volume.exists(dir_path) is False

    async def test_remove_nonexistent_raises(self, async_volume: AsyncVolume):
        with pytest.raises(NotFoundException):
            await async_volume.remove("/non-existent.txt")


class TestFileOperationsLifecycle:
    async def test_directory_with_multiple_files(self, async_volume: AsyncVolume):
        dir_path = "/multi-file-dir"
        await async_volume.make_dir(dir_path)

        files = ["file1.txt", "file2.txt", "file3.txt"]
        for file_name in files:
            await async_volume.write_file(
                f"{dir_path}/{file_name}", f"Content of {file_name}"
            )

        entries = await async_volume.list(dir_path)
        assert len(entries) >= len(files)

        for file_name in files:
            content = await async_volume.read_file(
                f"{dir_path}/{file_name}", format="text"
            )
            assert content == f"Content of {file_name}"

        await async_volume.remove(dir_path, recursive=True)
        assert await async_volume.exists(dir_path) is False
