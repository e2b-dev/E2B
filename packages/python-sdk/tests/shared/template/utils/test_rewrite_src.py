import os
import tempfile
from e2b.template.utils import rewrite_src, to_posix_path


class TestRewriteSrc:
    def test_should_return_resolved_posix_path_for_parent_directory_paths(self):
        """Test that paths starting with .. return the full resolved path in POSIX format."""
        # Use a real temp directory for cross-platform compatibility
        with tempfile.TemporaryDirectory() as tmpdir:
            context_path = os.path.join(tmpdir, "subdir")
            os.makedirs(context_path)

            # ../file.txt from subdir should resolve to tmpdir/file.txt in POSIX format
            result = rewrite_src("../file.txt", context_path)
            expected = to_posix_path(os.path.normpath(os.path.join(tmpdir, "file.txt")))
            assert result == expected

            # ../../file.txt from subdir should resolve to parent of tmpdir in POSIX format
            result = rewrite_src("../../file.txt", context_path)
            expected = to_posix_path(
                os.path.normpath(os.path.join(tmpdir, "..", "file.txt"))
            )
            assert result == expected

    def test_should_preserve_relative_paths(self):
        """Test that regular relative paths are preserved."""
        context_path = os.path.join("some", "path")
        assert rewrite_src("file.txt", context_path) == "file.txt"
        assert rewrite_src("dir/file.txt", context_path) == "dir/file.txt"
        assert rewrite_src("./file.txt", context_path) == "./file.txt"
        assert (
            rewrite_src("src/components/Button.tsx", context_path)
            == "src/components/Button.tsx"
        )

    def test_should_convert_absolute_paths_to_posix_format(self):
        """Test that absolute paths are converted to POSIX format."""
        context_path = os.path.join("some", "path")
        # Use platform-appropriate absolute paths
        if os.name == "nt":
            abs_path = "C:\\Users\\test\\file.txt"
            # On Windows, absolute paths are converted to POSIX format (no drive letter, forward slashes)
            assert rewrite_src(abs_path, context_path) == "Users/test/file.txt"
        else:
            abs_path = "/usr/local/file.txt"
            # On Unix, leading slash is stripped
            assert rewrite_src(abs_path, context_path) == "usr/local/file.txt"

    def test_should_handle_glob_patterns(self):
        """Test that glob patterns are handled correctly."""
        with tempfile.TemporaryDirectory() as tmpdir:
            context_path = os.path.join(tmpdir, "subdir")
            os.makedirs(context_path)

            assert rewrite_src("*.txt", context_path) == "*.txt"
            assert rewrite_src("**/*.py", context_path) == "**/*.py"

            # ../*.txt from subdir should resolve to tmpdir/*.txt in POSIX format
            result = rewrite_src("../*.txt", context_path)
            expected = to_posix_path(os.path.normpath(os.path.join(tmpdir, "*.txt")))
            assert result == expected
