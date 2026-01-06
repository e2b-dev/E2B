from e2b.template.utils import rewrite_src


class TestRewriteSrc:
    def test_should_return_basename_for_parent_directory_paths(self):
        """Test that paths starting with .. return only the basename."""
        assert rewrite_src("../file.txt") == "file.txt"
        assert rewrite_src("../../config.json") == "config.json"
        assert rewrite_src("../dir/file.py") == "file.py"

    def test_should_preserve_relative_paths(self):
        """Test that regular relative paths are preserved."""
        assert rewrite_src("file.txt") == "file.txt"
        assert rewrite_src("dir/file.txt") == "dir/file.txt"
        assert rewrite_src("./file.txt") == "./file.txt"
        assert rewrite_src("src/components/Button.tsx") == "src/components/Button.tsx"

    def test_should_preserve_absolute_paths(self):
        """Test that absolute paths are preserved."""
        assert rewrite_src("/usr/local/file.txt") == "/usr/local/file.txt"
        assert rewrite_src("/home/user/project/file.py") == "/home/user/project/file.py"

    def test_should_handle_glob_patterns(self):
        """Test that glob patterns are handled correctly."""
        assert rewrite_src("*.txt") == "*.txt"
        assert rewrite_src("**/*.py") == "**/*.py"
        assert rewrite_src("../*.txt") == "*.txt"
