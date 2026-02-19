import datetime
from io import BytesIO

import pytest

from e2b import Volume
from e2b.exceptions import NotFoundException


class TestWriteFileAndReadFile:
    def test_write_and_read_text_file(self, volume: Volume):
        path = "/test.txt"
        content = "Hello, World!"

        volume.write_file(path, content)
        read_content = volume.read_file(path, format="text")

        assert read_content == content

    def test_write_and_read_bytes(self, volume: Volume):
        path = "/test-bytes.txt"
        content = "Test bytes content"
        content_bytes = content.encode("utf-8")

        volume.write_file(path, content_bytes)
        read_bytes = volume.read_file(path, format="bytes")

        assert read_bytes == content_bytes

    def test_write_and_read_stream(self, volume: Volume):
        path = "/test-stream.txt"
        content = "Test stream content"
        stream = BytesIO(content.encode("utf-8"))

        volume.write_file(path, stream)
        read_content = volume.read_file(path, format="text")

        assert read_content == content

    def test_write_and_read_empty_file(self, volume: Volume):
        path = "/empty.txt"
        content = ""

        volume.write_file(path, content)
        read_content = volume.read_file(path, format="text")

        assert read_content == content

    def test_overwrite_with_force(self, volume: Volume):
        path = "/overwrite.txt"
        initial_content = "Initial content"
        new_content = "New content"

        volume.write_file(path, initial_content)
        volume.write_file(path, new_content, force=True)
        read_content = volume.read_file(path, format="text")

        assert read_content == new_content

    def test_write_file_with_metadata(self, volume: Volume):
        path = "/metadata.txt"
        content = "File with metadata"

        volume.write_file(path, content, uid=1000, gid=1000, mode=0o644)

        entry_info = volume.get_info(path)
        assert entry_info.type.value == "file"
        assert entry_info.uid == 1000
        assert entry_info.gid == 1000
        assert entry_info.mode == 0o644

    def test_write_file_in_nested_directory(self, volume: Volume):
        dir_path = "/nested/deep/path"
        file_path = f"{dir_path}/file.txt"
        content = "Nested file content"

        volume.make_dir(dir_path, force=True)
        volume.write_file(file_path, content)
        read_content = volume.read_file(file_path, format="text")

        assert read_content == content


class TestGetInfo:
    def test_get_info_for_file(self, volume: Volume):
        path = "/info-file.txt"
        content = "File for info test"

        volume.write_file(path, content)
        info = volume.get_info(path)

        assert info.name == "info-file.txt"
        assert info.type.value == "file"
        assert info.path == path
        assert isinstance(info.mtime, datetime.datetime)
        assert isinstance(info.ctime, datetime.datetime)

    def test_get_info_for_directory(self, volume: Volume):
        path = "/info-dir"

        volume.make_dir(path)
        info = volume.get_info(path)

        assert info.name == "info-dir"
        assert info.type.value == "directory"
        assert info.path == path

    def test_exists_returns_false_for_nonexistent(self, volume: Volume):
        assert volume.exists("/non-existent.txt") is False


class TestUpdateMetadata:
    def test_update_file_metadata(self, volume: Volume):
        path = "/metadata-update.txt"
        volume.write_file(path, "Content")

        updated = volume.update_metadata(path, uid=1001, gid=1001, mode=0o755)

        assert updated.path == path
        assert updated.type.value == "file"
        assert updated.uid == 1001
        assert updated.gid == 1001
        assert updated.mode == 0o755

    def test_update_metadata_nonexistent_raises(self, volume: Volume):
        with pytest.raises(NotFoundException):
            volume.update_metadata("/non-existent.txt", mode=0o644)


class TestMakeDir:
    def test_create_directory(self, volume: Volume):
        path = "/test-dir"

        volume.make_dir(path)
        info = volume.get_info(path)

        assert info.type.value == "directory"
        assert info.path == path

    def test_create_nested_directories_with_force(self, volume: Volume):
        path = "/nested/deep/directory"

        volume.make_dir(path, force=True)
        info = volume.get_info(path)

        assert info.type.value == "directory"

    def test_create_directory_with_metadata(self, volume: Volume):
        path = "/dir-with-metadata"

        volume.make_dir(path, uid=1000, gid=1000, mode=0o755)

        info = volume.get_info(path)
        assert info.type.value == "directory"
        assert info.uid == 1000
        assert info.gid == 1000
        assert info.mode & 0o777 == 0o755


class TestList:
    def test_list_directory_contents(self, volume: Volume):
        volume.write_file("/file1.txt", "Content 1")
        volume.write_file("/file2.txt", "Content 2")
        volume.make_dir("/dir1")

        entries = volume.list("/")

        assert len(entries) >= 3
        file_names = sorted([e.name for e in entries])
        assert "file1.txt" in file_names
        assert "file2.txt" in file_names
        assert "dir1" in file_names

    def test_list_nested_directory(self, volume: Volume):
        volume.make_dir("/nested", force=True)
        volume.write_file("/nested/file.txt", "Content")

        entries = volume.list("/nested")

        assert len(entries) >= 1
        assert any(e.name == "file.txt" for e in entries)

    @pytest.mark.skip(reason="depth option not yet supported")
    def test_list_with_depth(self, volume: Volume):
        volume.make_dir("/deep/nested/structure", force=True)
        volume.write_file("/deep/nested/structure/file.txt", "Content")

        entries = volume.list("/deep", depth=2)

        assert len(entries) > 0

    def test_list_nonexistent_raises(self, volume: Volume):
        with pytest.raises(NotFoundException):
            volume.list("/non-existent")


class TestRemove:
    def test_remove_file(self, volume: Volume):
        path = "/to-remove.txt"
        volume.write_file(path, "Content")

        volume.remove(path)

        assert volume.exists(path) is False

    def test_remove_directory(self, volume: Volume):
        path = "/to-remove-dir"
        volume.make_dir(path)

        volume.remove(path)

        assert volume.exists(path) is False

    def test_remove_directory_recursively(self, volume: Volume):
        dir_path = "/recursive-dir"
        volume.make_dir(f"{dir_path}/nested", force=True)
        volume.write_file(f"{dir_path}/nested/file.txt", "Content")

        volume.remove(dir_path, recursive=True)

        assert volume.exists(dir_path) is False

    def test_remove_nonexistent_raises(self, volume: Volume):
        with pytest.raises(NotFoundException):
            volume.remove("/non-existent.txt")


class TestFileOperationsLifecycle:
    def test_directory_with_multiple_files(self, volume: Volume):
        dir_path = "/multi-file-dir"
        volume.make_dir(dir_path)

        files = ["file1.txt", "file2.txt", "file3.txt"]
        for file_name in files:
            volume.write_file(f"{dir_path}/{file_name}", f"Content of {file_name}")

        entries = volume.list(dir_path)
        assert len(entries) >= len(files)

        for file_name in files:
            content = volume.read_file(f"{dir_path}/{file_name}", format="text")
            assert content == f"Content of {file_name}"

        volume.remove(dir_path, recursive=True)
        assert volume.exists(dir_path) is False
