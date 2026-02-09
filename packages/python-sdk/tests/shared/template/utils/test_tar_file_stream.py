import os
import tempfile
import tarfile
import io
import pytest
from e2b.template.utils import tar_file_stream


class TestTarFileStream:
    @pytest.fixture
    def test_dir(self):
        """Create a temporary directory for testing."""
        tmpdir = tempfile.TemporaryDirectory()
        yield tmpdir.name
        tmpdir.cleanup()

    def _extract_tar_contents(self, tar_buffer: io.BytesIO) -> dict:
        """Extract tar contents into a dictionary mapping paths to file contents."""
        tar_buffer.seek(0)
        contents = {}
        with tarfile.open(fileobj=tar_buffer, mode="r:gz") as tar:
            for member in tar.getmembers():
                if member.isfile():
                    file_obj = tar.extractfile(member)
                    if file_obj:
                        contents[member.name] = file_obj.read()
                elif member.isdir():
                    contents[member.name] = None  # Mark as directory
        return contents

    def test_should_create_tar_with_simple_files(self, test_dir):
        """Test that function creates tar with simple files."""
        # Create test files
        file1_path = os.path.join(test_dir, "file1.txt")
        file2_path = os.path.join(test_dir, "file2.txt")

        with open(file1_path, "w") as f:
            f.write("content1")
        with open(file2_path, "w") as f:
            f.write("content2")

        tar_buffer = tar_file_stream("*.txt", test_dir, [], False)
        contents = self._extract_tar_contents(tar_buffer)

        assert len(contents) == 2
        assert "file1.txt" in contents
        assert "file2.txt" in contents
        assert contents["file1.txt"] == b"content1"
        assert contents["file2.txt"] == b"content2"

    def test_should_respect_ignore_patterns(self, test_dir):
        """Test that function respects ignore patterns."""
        # Create test files
        with open(os.path.join(test_dir, "file1.txt"), "w") as f:
            f.write("content1")
        with open(os.path.join(test_dir, "file2.txt"), "w") as f:
            f.write("content2")
        with open(os.path.join(test_dir, "temp.txt"), "w") as f:
            f.write("temp content")
        with open(os.path.join(test_dir, "backup.txt"), "w") as f:
            f.write("backup content")

        tar_buffer = tar_file_stream("*.txt", test_dir, ["temp*", "backup*"], False)
        contents = self._extract_tar_contents(tar_buffer)

        assert len(contents) == 2
        assert "file1.txt" in contents
        assert "file2.txt" in contents
        assert contents["file1.txt"] == b"content1"
        assert contents["file2.txt"] == b"content2"
        assert "temp.txt" not in contents
        assert "backup.txt" not in contents

    def test_should_handle_nested_files(self, test_dir):
        """Test that function handles nested directory structures."""
        # Create nested directory structure
        nested_dir = os.path.join(test_dir, "src", "components")
        os.makedirs(nested_dir, exist_ok=True)

        with open(os.path.join(test_dir, "src", "index.ts"), "w") as f:
            f.write("index content")
        with open(os.path.join(nested_dir, "Button.tsx"), "w") as f:
            f.write("button content")

        tar_buffer = tar_file_stream("src", test_dir, [], False)
        contents = self._extract_tar_contents(tar_buffer)

        # Should include the directory and files
        assert "src/index.ts" in contents
        assert "src/components/Button.tsx" in contents

    def test_should_resolve_symlinks_when_enabled(self, test_dir):
        """Test that function resolves symlinks when resolve_symlinks=True."""
        if not hasattr(os, "symlink"):
            pytest.skip("Symlinks not supported on this platform")

        # Create original file
        original_path = os.path.join(test_dir, "original.txt")
        with open(original_path, "w") as f:
            f.write("original content")

        # Create symlink
        symlink_path = os.path.join(test_dir, "link.txt")
        os.symlink("original.txt", symlink_path)

        # Test with resolve_symlinks=True
        tar_buffer = tar_file_stream("*.txt", test_dir, [], True)
        contents = self._extract_tar_contents(tar_buffer)

        # Both files should be in tar
        assert "original.txt" in contents
        assert "link.txt" in contents
        # Symlink should be resolved (contain actual content, not link)
        assert contents["original.txt"] == b"original content"
        assert contents["link.txt"] == b"original content"

    def test_should_preserve_symlinks_when_disabled(self, test_dir):
        """Test that function preserves symlinks when resolve_symlinks=False."""
        if not hasattr(os, "symlink"):
            pytest.skip("Symlinks not supported on this platform")

        # Create original file
        original_path = os.path.join(test_dir, "original.txt")
        with open(original_path, "w") as f:
            f.write("original content")

        # Create symlink
        symlink_path = os.path.join(test_dir, "link.txt")
        os.symlink("original.txt", symlink_path)

        # Test with resolve_symlinks=False
        tar_buffer = tar_file_stream("*.txt", test_dir, [], False)
        tar_buffer.seek(0)

        with tarfile.open(fileobj=tar_buffer, mode="r:gz") as tar:
            members = {m.name: m for m in tar.getmembers()}

            # Both files should be in tar
            assert "original.txt" in members
            assert "link.txt" in members

            # Original should be a regular file
            assert members["original.txt"].isfile()
            assert not members["original.txt"].issym()

            # Link should be a symlink
            assert members["link.txt"].issym()
            assert members["link.txt"].linkname == "original.txt"
