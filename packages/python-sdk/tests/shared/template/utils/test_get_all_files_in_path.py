import os
import tempfile
import pytest
from e2b.template.utils import get_all_files_in_path


class TestGetAllFilesInPath:
    @pytest.fixture
    def test_dir(self):
        """Create a temporary directory for testing."""
        with tempfile.TemporaryDirectory() as tmpdir:
            yield tmpdir

    def test_should_return_files_matching_simple_pattern(self, test_dir):
        """Test that function returns files matching a simple pattern."""
        # Create test files
        with open(os.path.join(test_dir, "file1.txt"), "w") as f:
            f.write("content1")
        with open(os.path.join(test_dir, "file2.txt"), "w") as f:
            f.write("content2")
        with open(os.path.join(test_dir, "file3.js"), "w") as f:
            f.write("content3")

        files = get_all_files_in_path("*.txt", test_dir, [])

        assert len(files) == 2
        assert any("file1.txt" in f for f in files)
        assert any("file2.txt" in f for f in files)
        assert not any("file3.js" in f for f in files)

    def test_should_handle_directory_patterns_recursively(self, test_dir):
        """Test that function handles directory patterns recursively."""
        # Create nested directory structure
        os.makedirs(os.path.join(test_dir, "src", "components"), exist_ok=True)
        os.makedirs(os.path.join(test_dir, "src", "utils"), exist_ok=True)

        with open(os.path.join(test_dir, "src", "index.ts"), "w") as f:
            f.write("index content")
        with open(os.path.join(test_dir, "src", "components", "Button.tsx"), "w") as f:
            f.write("button content")
        with open(os.path.join(test_dir, "src", "utils", "helper.ts"), "w") as f:
            f.write("helper content")
        with open(os.path.join(test_dir, "README.md"), "w") as f:
            f.write("readme content")

        files = get_all_files_in_path("src", test_dir, [])

        assert len(files) == 6  # 3 files + 3 directories (src, components, utils)
        assert any("index.ts" in f for f in files)
        assert any("Button.tsx" in f for f in files)
        assert any("helper.ts" in f for f in files)
        assert not any("README.md" in f for f in files)

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

        files = get_all_files_in_path("*.txt", test_dir, ["temp*", "backup*"])

        assert len(files) == 2
        assert any("file1.txt" in f for f in files)
        assert any("file2.txt" in f for f in files)
        assert not any("temp.txt" in f for f in files)
        assert not any("backup.txt" in f for f in files)

    def test_should_handle_complex_ignore_patterns(self, test_dir):
        """Test that function handles complex ignore patterns."""
        # Create nested structure with various file types
        os.makedirs(os.path.join(test_dir, "src", "components"), exist_ok=True)
        os.makedirs(os.path.join(test_dir, "src", "utils"), exist_ok=True)
        os.makedirs(os.path.join(test_dir, "tests"), exist_ok=True)

        with open(os.path.join(test_dir, "src", "index.ts"), "w") as f:
            f.write("index content")
        with open(os.path.join(test_dir, "src", "components", "Button.tsx"), "w") as f:
            f.write("button content")
        with open(os.path.join(test_dir, "src", "utils", "helper.ts"), "w") as f:
            f.write("helper content")
        with open(os.path.join(test_dir, "tests", "test.spec.ts"), "w") as f:
            f.write("test content")
        with open(
            os.path.join(test_dir, "src", "components", "Button.test.tsx"), "w"
        ) as f:
            f.write("test content")
        with open(os.path.join(test_dir, "src", "utils", "helper.spec.ts"), "w") as f:
            f.write("spec content")

        files = get_all_files_in_path("src", test_dir, ["**/*.test.*", "**/*.spec.*"])

        assert len(files) == 6  # 3 files + 3 directories (src, components, utils)
        assert any("index.ts" in f for f in files)
        assert any("Button.tsx" in f for f in files)
        assert any("helper.ts" in f for f in files)
        assert not any("Button.test.tsx" in f for f in files)
        assert not any("helper.spec.ts" in f for f in files)

    def test_should_handle_empty_directories(self, test_dir):
        """Test that function handles empty directories."""
        os.makedirs(os.path.join(test_dir, "empty"), exist_ok=True)
        with open(os.path.join(test_dir, "file.txt"), "w") as f:
            f.write("content")

        files = get_all_files_in_path("empty", test_dir, [])

        assert len(files) == 1

    def test_should_handle_mixed_files_and_directories(self, test_dir):
        """Test that function handles mixed files and directories."""
        # Create a mix of files and directories
        with open(os.path.join(test_dir, "file1.txt"), "w") as f:
            f.write("content1")
        os.makedirs(os.path.join(test_dir, "dir1"), exist_ok=True)
        with open(os.path.join(test_dir, "dir1", "file2.txt"), "w") as f:
            f.write("content2")
        with open(os.path.join(test_dir, "file3.txt"), "w") as f:
            f.write("content3")

        files = get_all_files_in_path("*", test_dir, [])

        assert len(files) == 4
        assert any("file1.txt" in f for f in files)
        assert any("file2.txt" in f for f in files)
        assert any("file3.txt" in f for f in files)

    def test_should_handle_glob_patterns_with_subdirectories(self, test_dir):
        """Test that function handles glob patterns with subdirectories."""
        # Create nested structure
        os.makedirs(os.path.join(test_dir, "src", "components"), exist_ok=True)
        os.makedirs(os.path.join(test_dir, "src", "utils"), exist_ok=True)

        with open(os.path.join(test_dir, "src", "index.ts"), "w") as f:
            f.write("index content")
        with open(os.path.join(test_dir, "src", "components", "Button.tsx"), "w") as f:
            f.write("button content")
        with open(os.path.join(test_dir, "src", "utils", "helper.ts"), "w") as f:
            f.write("helper content")
        with open(os.path.join(test_dir, "src", "components", "Button.css"), "w") as f:
            f.write("css content")

        files = get_all_files_in_path("src/**/*", test_dir, [])

        assert len(files) == 6
        assert any("index.ts" in f for f in files)
        assert any("Button.tsx" in f for f in files)
        assert any("helper.ts" in f for f in files)
        assert any("Button.css" in f for f in files)

    def test_should_handle_specific_file_extensions(self, test_dir):
        """Test that function handles specific file extensions."""
        with open(os.path.join(test_dir, "file1.ts"), "w") as f:
            f.write("ts content")
        with open(os.path.join(test_dir, "file2.js"), "w") as f:
            f.write("js content")
        with open(os.path.join(test_dir, "file3.tsx"), "w") as f:
            f.write("tsx content")
        with open(os.path.join(test_dir, "file4.css"), "w") as f:
            f.write("css content")

        files = get_all_files_in_path("*.ts", test_dir, [])

        assert len(files) == 1
        assert any("file1.ts" in f for f in files)

    def test_should_return_sorted_files(self, test_dir):
        """Test that function returns sorted files."""
        with open(os.path.join(test_dir, "zebra.txt"), "w") as f:
            f.write("z content")
        with open(os.path.join(test_dir, "apple.txt"), "w") as f:
            f.write("a content")
        with open(os.path.join(test_dir, "banana.txt"), "w") as f:
            f.write("b content")

        files = get_all_files_in_path("*.txt", test_dir, [])

        assert len(files) == 3
        assert "apple.txt" in files[0]
        assert "banana.txt" in files[1]
        assert "zebra.txt" in files[2]

    def test_should_handle_no_matching_files(self, test_dir):
        """Test that function handles no matching files."""
        with open(os.path.join(test_dir, "file.txt"), "w") as f:
            f.write("content")

        files = get_all_files_in_path("*.js", test_dir, [])

        assert len(files) == 0

    def test_should_handle_complex_ignore_patterns_with_directories(self, test_dir):
        """Test that function handles complex ignore patterns with directories."""
        # Create a complex structure
        os.makedirs(os.path.join(test_dir, "src", "components"), exist_ok=True)
        os.makedirs(os.path.join(test_dir, "src", "utils"), exist_ok=True)
        os.makedirs(os.path.join(test_dir, "src", "tests"), exist_ok=True)
        os.makedirs(os.path.join(test_dir, "dist"), exist_ok=True)

        with open(os.path.join(test_dir, "src", "index.ts"), "w") as f:
            f.write("index content")
        with open(os.path.join(test_dir, "src", "components", "Button.tsx"), "w") as f:
            f.write("button content")
        with open(os.path.join(test_dir, "src", "utils", "helper.ts"), "w") as f:
            f.write("helper content")
        with open(os.path.join(test_dir, "src", "tests", "test.spec.ts"), "w") as f:
            f.write("test content")
        with open(os.path.join(test_dir, "dist", "bundle.js"), "w") as f:
            f.write("bundle content")
        with open(os.path.join(test_dir, "README.md"), "w") as f:
            f.write("readme content")

        files = get_all_files_in_path("src", test_dir, ["**/tests/**", "**/*.spec.*"])

        assert len(files) == 6  # 3 files + 3 directories (src, components, utils)
        assert any("index.ts" in f for f in files)
        assert any("Button.tsx" in f for f in files)
        assert any("helper.ts" in f for f in files)
        assert not any("test.spec.ts" in f for f in files)

    def test_should_handle_symlinks(self, test_dir):
        """Test that function handles symbolic links."""
        # Create a file and a symlink to it
        with open(os.path.join(test_dir, "original.txt"), "w") as f:
            f.write("original content")

        # Create symlink (only on Unix-like systems)
        if hasattr(os, "symlink"):
            os.symlink("original.txt", os.path.join(test_dir, "link.txt"))

            files = get_all_files_in_path("*.txt", test_dir, [])

            assert len(files) == 2
            assert any("original.txt" in f for f in files)
            assert any("link.txt" in f for f in files)

    def test_should_handle_nested_ignore_patterns(self, test_dir):
        """Test that function handles nested ignore patterns."""
        # Create nested structure
        os.makedirs(os.path.join(test_dir, "src", "components", "ui"), exist_ok=True)
        os.makedirs(os.path.join(test_dir, "src", "components", "forms"), exist_ok=True)
        os.makedirs(os.path.join(test_dir, "src", "utils"), exist_ok=True)

        with open(os.path.join(test_dir, "src", "index.ts"), "w") as f:
            f.write("index content")
        with open(
            os.path.join(test_dir, "src", "components", "ui", "Button.tsx"), "w"
        ) as f:
            f.write("button content")
        with open(
            os.path.join(test_dir, "src", "components", "forms", "Input.tsx"), "w"
        ) as f:
            f.write("input content")
        with open(os.path.join(test_dir, "src", "utils", "helper.ts"), "w") as f:
            f.write("helper content")
        with open(
            os.path.join(test_dir, "src", "components", "ui", "Button.test.tsx"), "w"
        ) as f:
            f.write("test content")

        files = get_all_files_in_path("src", test_dir, ["**/ui/**"])

        assert (
            len(files) == 7
        )  # 3 files + 4 directories (src, components, forms, utils)
        assert any("index.ts" in f for f in files)
        assert any("Input.tsx" in f for f in files)
        assert any("helper.ts" in f for f in files)
        assert not any("Button.tsx" in f for f in files)
        assert not any("Button.test.tsx" in f for f in files)
