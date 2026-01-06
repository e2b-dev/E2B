from e2b.template.utils import rewrite_src


class TestRewriteSrc:
    context_path = "/home/user/project"

    def test_should_return_resolved_path_for_parent_directory_paths(self):
        """Test that paths starting with .. return the full resolved path."""
        assert rewrite_src("../file.txt", self.context_path) == "/home/user/file.txt"
        assert (
            rewrite_src("../../config.json", self.context_path) == "/home/config.json"
        )
        assert (
            rewrite_src("../dir/file.py", self.context_path) == "/home/user/dir/file.py"
        )

    def test_should_preserve_relative_paths(self):
        """Test that regular relative paths are preserved."""
        assert rewrite_src("file.txt", self.context_path) == "file.txt"
        assert rewrite_src("dir/file.txt", self.context_path) == "dir/file.txt"
        assert rewrite_src("./file.txt", self.context_path) == "./file.txt"
        assert (
            rewrite_src("src/components/Button.tsx", self.context_path)
            == "src/components/Button.tsx"
        )

    def test_should_preserve_absolute_paths(self):
        """Test that absolute paths are preserved."""
        assert (
            rewrite_src("/usr/local/file.txt", self.context_path)
            == "/usr/local/file.txt"
        )
        assert (
            rewrite_src("/home/user/project/file.py", self.context_path)
            == "/home/user/project/file.py"
        )

    def test_should_handle_glob_patterns(self):
        """Test that glob patterns are handled correctly."""
        assert rewrite_src("*.txt", self.context_path) == "*.txt"
        assert rewrite_src("**/*.py", self.context_path) == "**/*.py"
        assert rewrite_src("../*.txt", self.context_path) == "/home/user/*.txt"
