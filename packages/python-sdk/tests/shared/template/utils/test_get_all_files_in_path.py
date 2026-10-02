import os
import sys
import tempfile
import pytest
from e2b.exceptions import TemplateException
from e2b.template.utils import (
    calculate_files_hash,
    get_all_files_in_path,
    read_dockerignore,
)


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

        # 3 files + 4 directories (src, components, utils and the emptied tests,
        # since `tests/**` matches the contents of `tests`, as in Docker)
        assert len(files) == 7
        assert any("index.ts" in f for f in files)
        assert any("Button.tsx" in f for f in files)
        assert any("helper.ts" in f for f in files)
        assert not any("test.spec.ts" in f for f in files)

    def test_should_include_dotfiles(self, test_dir):
        """Test that function includes files starting with a dot."""
        with open(os.path.join(test_dir, "file.txt"), "w") as f:
            f.write("content")
        with open(os.path.join(test_dir, ".env"), "w") as f:
            f.write("SECRET=123")
        with open(os.path.join(test_dir, ".gitignore"), "w") as f:
            f.write("node_modules")

        files = get_all_files_in_path("*", test_dir, [])

        assert len(files) == 3
        assert any(".env" in f for f in files)
        assert any(".gitignore" in f for f in files)
        assert any("file.txt" in f for f in files)

    def test_should_include_dotfiles_in_subdirectories(self, test_dir):
        """Test that function includes dotfiles inside subdirectories."""
        os.makedirs(os.path.join(test_dir, "src"), exist_ok=True)
        with open(os.path.join(test_dir, "src", "index.ts"), "w") as f:
            f.write("content")
        with open(os.path.join(test_dir, "src", ".env.local"), "w") as f:
            f.write("SECRET=123")

        files = get_all_files_in_path("src", test_dir, [])

        assert any("index.ts" in f for f in files)
        assert any(".env.local" in f for f in files)

    def test_should_include_dotdirectories_and_their_contents(self, test_dir):
        """Test that function includes dot-prefixed directories and their contents."""
        os.makedirs(os.path.join(test_dir, ".hidden"), exist_ok=True)
        with open(os.path.join(test_dir, ".hidden", "config.json"), "w") as f:
            f.write("{}")
        with open(os.path.join(test_dir, "visible.txt"), "w") as f:
            f.write("content")

        files = get_all_files_in_path("*", test_dir, [])

        assert any(".hidden" in f for f in files)
        assert any("config.json" in f for f in files)
        assert any("visible.txt" in f for f in files)

    def test_should_respect_ignore_patterns_for_dotfiles(self, test_dir):
        """Test that dotfiles can be excluded via ignore patterns."""
        with open(os.path.join(test_dir, ".env"), "w") as f:
            f.write("SECRET=123")
        with open(os.path.join(test_dir, ".gitignore"), "w") as f:
            f.write("node_modules")
        with open(os.path.join(test_dir, "file.txt"), "w") as f:
            f.write("content")

        files = get_all_files_in_path("*", test_dir, [".env"])

        assert len(files) == 2
        assert not any(f.endswith(".env") for f in files)
        assert any(".gitignore" in f for f in files)
        assert any("file.txt" in f for f in files)

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

        # 3 files + 5 directories (src, components, forms, utils and the emptied
        # ui, since `ui/**` matches the contents of `ui`, as in Docker)
        assert len(files) == 8
        assert any("index.ts" in f for f in files)
        assert any("Input.tsx" in f for f in files)
        assert any("helper.ts" in f for f in files)
        assert not any("Button.tsx" in f for f in files)
        assert not any("Button.test.tsx" in f for f in files)


class TestDockerignoreSemantics:
    PATTERNS = [".env", "node_modules", ".git", "**/*.spec.*", "src/generated"]

    @pytest.fixture
    def test_dir(self):
        """Create a build context with files that are usually ignored."""
        with tempfile.TemporaryDirectory() as tmpdir:
            for path, content in {
                ".env": "SECRET=1",
                "node_modules/pkg/index.js": "x",
                "src/app.ts": "x",
                "src/app.spec.ts": "x",
                "src/generated/api.ts": "x",
                "src/node_modules/lib.js": "x",
                ".git/HEAD": "ref",
            }.items():
                full_path = os.path.join(tmpdir, path)
                os.makedirs(os.path.dirname(full_path), exist_ok=True)
                with open(full_path, "w") as f:
                    f.write(content)
            yield tmpdir

    @staticmethod
    def relative_paths(src, test_dir, ignore_patterns):
        return sorted(
            os.path.relpath(f, test_dir).replace(os.sep, "/")
            for f in get_all_files_in_path(src, test_dir, ignore_patterns)
        )

    @pytest.mark.parametrize("src", [".", "./", "./src", "src", "src/.", "src/../src"])
    def test_should_exclude_ignored_directories_with_their_contents(
        self, test_dir, src
    ):
        expected = ["src", "src/app.ts", "src/node_modules", "src/node_modules/lib.js"]
        if src in (".", "./"):
            expected = [".", *expected]
        assert self.relative_paths(src, test_dir, self.PATTERNS) == expected

    def test_should_ignore_a_leading_slash_and_a_trailing_slash(self, test_dir):
        files = self.relative_paths(".", test_dir, ["/node_modules", "/.git/", "src/"])
        assert files == [".", ".env"]

    def test_should_never_exclude_the_context_root(self, test_dir):
        files = self.relative_paths(".", test_dir, [".", ".*", "src", "node_modules"])
        assert files == ["."]

    def test_should_not_copy_paths_inside_an_ignored_directory(self, test_dir):
        assert self.relative_paths("node_modules/pkg", test_dir, ["node_modules"]) == []

    def test_should_reinclude_paths_matched_by_a_negated_pattern(self, test_dir):
        files = self.relative_paths(
            ".",
            test_dir,
            ["*", "!src", "src/generated", "!node_modules/pkg/index.js"],
        )
        assert files == [
            ".",
            "node_modules/pkg/index.js",
            "src",
            "src/app.spec.ts",
            "src/app.ts",
            "src/node_modules",
            "src/node_modules/lib.js",
        ]

    def test_should_not_reinclude_a_path_through_a_negated_parent_directory(
        self, test_dir
    ):
        files = self.relative_paths(".", test_dir, ["src/app.ts", "**/*.js", "!src"])
        assert "src/app.ts" not in files
        assert "src/node_modules/lib.js" not in files
        assert "src/app.spec.ts" in files

    def test_should_match_a_leading_globstar_with_a_literal_suffix(self, test_dir):
        for name in ["root.txt", "src/nested.txt", "keep.txt.bak"]:
            with open(os.path.join(test_dir, name), "w") as f:
                f.write("x")
        files = self.relative_paths(".", test_dir, ["**.txt", "**/generated"])
        assert "root.txt" not in files
        assert "src/nested.txt" not in files
        assert "src/generated/api.ts" not in files
        assert "keep.txt.bak" in files

    def test_should_match_characters_outside_the_bmp_as_a_single_character(
        self, test_dir
    ):
        for name in ["😀.txt", "😀😀.txt"]:
            with open(os.path.join(test_dir, name), "w") as f:
                f.write("x")
        files = self.relative_paths("*", test_dir, ["?.txt"])
        assert "😀.txt" not in files
        assert "😀😀.txt" in files
        assert "😀😀.txt" not in self.relative_paths("*", test_dir, ["[😀]?.txt"])

    def test_should_make_absolute_patterns_inside_the_context_relative(self, test_dir):
        files = self.relative_paths(
            ".",
            test_dir,
            [
                os.path.join(test_dir, "src"),
                os.path.join(test_dir, "node_modules", "**"),
                ".git",
            ],
        )
        assert files == [".", ".env", "node_modules"]

    def test_should_match_regex_special_characters_literally(self, test_dir):
        for name in ["file (1).txt", "c++", "a"]:
            with open(os.path.join(test_dir, name), "w") as f:
                f.write("x")
        files = self.relative_paths("*", test_dir, ["file (1).txt", "c++", "a|b"])
        assert "file (1).txt" not in files
        assert "c++" not in files
        assert "a" in files

    def test_should_raise_on_an_invalid_pattern(self, test_dir):
        with pytest.raises(TemplateException, match="Invalid ignore pattern '\\[abc'"):
            get_all_files_in_path(".", test_dir, ["[abc"])

    def test_should_keep_the_files_hash_stable_when_ignored_files_change(
        self, test_dir
    ):
        def files_hash():
            return calculate_files_hash(".", "/app", test_dir, [".git"], False, None)

        before = files_hash()
        with open(os.path.join(test_dir, ".git", "HEAD"), "a") as f:
            f.write("x")
        assert files_hash() == before

    def test_should_strip_a_utf8_bom_from_dockerignore(self, test_dir):
        with open(os.path.join(test_dir, ".dockerignore"), "w", encoding="utf-8") as f:
            f.write("\ufeff.env\n# comment\n\nsrc\n")
        assert read_dockerignore(test_dir) == [".env", "src"]

    def test_should_match_a_caret_literally_outside_a_bracket_expression(
        self, test_dir
    ):
        for name in ["report^draft.txt", "ax", "bx"]:
            with open(os.path.join(test_dir, name), "w") as f:
                f.write("x")
        files = self.relative_paths("*", test_dir, ["report^draft.txt", "[^a]x"])
        assert "report^draft.txt" not in files
        assert "bx" not in files
        assert "ax" in files

    def test_should_not_walk_the_recursive_matches_of_a_directory_again(
        self, test_dir, monkeypatch
    ):
        os.makedirs(os.path.join(test_dir, "a", "b", "c", "d", "e"))
        scanned = []
        scandir = os.scandir

        def counting_scandir(path="."):
            scanned.append(os.path.normpath(path))
            return scandir(path)

        monkeypatch.setattr(os, "scandir", counting_scandir)
        files = self.relative_paths("**/*", test_dir, self.PATTERNS)
        monkeypatch.undo()

        assert files == [
            "a",
            "a/b",
            "a/b/c",
            "a/b/c/d",
            "a/b/c/d/e",
            "src",
            "src/app.ts",
            "src/node_modules",
            "src/node_modules/lib.js",
        ]
        deepest = os.path.normpath(os.path.join(test_dir, "a", "b", "c", "d", "e"))
        # Once by the walk, and at most once by the glob expansion
        assert scanned.count(deepest) <= 2

    @pytest.mark.skipif(sys.platform == "win32", reason="Symlinks need privileges")
    def test_should_copy_a_symlink_to_a_directory_without_its_contents(self, test_dir):
        os.makedirs(os.path.join(test_dir, "real"))
        with open(os.path.join(test_dir, "real", "secret.txt"), "w") as f:
            f.write("x")
        os.symlink("real", os.path.join(test_dir, "linked"))
        assert self.relative_paths("linked", test_dir, []) == ["linked"]

    def test_should_keep_the_files_hash_stable_when_ignored_files_grow_a_directory(
        self, test_dir
    ):
        def files_hash():
            return calculate_files_hash(
                ".", "/app", test_dir, ["node_modules/*"], False, None
            )

        before = files_hash()
        for i in range(300):
            name = f"ignored-file-with-a-long-name-{i}"
            with open(os.path.join(test_dir, "node_modules", name), "w") as f:
                f.write("x")
        assert files_hash() == before

    def test_should_not_expand_braces(self, test_dir):
        for name in ["a.txt", "b.{txt,md}"]:
            with open(os.path.join(test_dir, name), "w") as f:
                f.write("x")
        files = self.relative_paths("*", test_dir, ["*.{txt,md}"])
        assert "a.txt" in files
        assert "b.{txt,md}" not in files
