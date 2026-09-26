import json
import os
import tempfile
import pytest
from e2b import Template
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

        assert len(files) == 6  # 3 files + 3 directories (src, components, utils)
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

        assert (
            len(files) == 7
        )  # 3 files + 4 directories (src, components, forms, utils)
        assert any("index.ts" in f for f in files)
        assert any("Input.tsx" in f for f in files)
        assert any("helper.ts" in f for f in files)
        assert not any("Button.tsx" in f for f in files)
        assert not any("Button.test.tsx" in f for f in files)

    def test_should_include_files_in_directories_with_glob_characters(self, test_dir):
        """Test that directories with glob characters in their names are walked."""
        os.makedirs(os.path.join(test_dir, "app", "[id]"))
        with open(os.path.join(test_dir, "app", "[id]", "page.tsx"), "w") as f:
            f.write("page")

        files = get_all_files_in_path("app/*", test_dir, [])

        assert sorted(os.path.relpath(f, test_dir) for f in files) == [
            os.path.join("app", "[id]"),
            os.path.join("app", "[id]", "page.tsx"),
        ]


class TestDockerignoreSemantics:
    """Ignore patterns follow Docker's .dockerignore rules: each pattern is
    matched against a path and its parent directories, the last matching
    pattern wins."""

    IGNORE = [".env", "node_modules", ".git", "**/*.spec.*", "src/generated"]
    SRC_FILES = ["src", "src/app.ts", "src/node_modules", "src/node_modules/x.js"]

    @pytest.fixture
    def ctx(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            for d in [
                "node_modules/pkg",
                "src/generated",
                "src/node_modules",
                ".git",
                "dist",
            ]:
                os.makedirs(os.path.join(tmpdir, d))
            for f in [
                ".env",
                "node_modules/pkg/index.js",
                "src/app.ts",
                "src/app.spec.ts",
                "src/generated/api.ts",
                "src/node_modules/x.js",
                ".git/HEAD",
            ]:
                with open(os.path.join(tmpdir, f), "w") as fh:
                    fh.write("x")
            yield tmpdir

    @staticmethod
    def rel(src, ctx, ignore):
        return sorted(
            os.path.relpath(f, ctx).replace(os.sep, "/")
            for f in get_all_files_in_path(src, ctx, ignore)
        )

    @pytest.mark.parametrize("src", [".", "./"])
    def test_applies_patterns_and_excludes_directory_contents(self, ctx, src):
        assert self.rel(src, ctx, self.IGNORE) == [".", "dist", *self.SRC_FILES]

    @pytest.mark.parametrize("src", ["./src", "src/.", "dist/../src", "src"])
    def test_applies_patterns_regardless_of_how_src_is_written(self, ctx, src):
        assert self.rel(src, ctx, self.IGNORE) == self.SRC_FILES

    def test_trailing_slash_and_globstar_directory_patterns(self, ctx):
        ignore = ["node_modules/", "**/node_modules", ".*", "src/*"]
        assert self.rel(".", ctx, ignore) == [".", "dist", "src"]

    def test_leading_slash_is_root_relative(self, ctx):
        ignore = ["/node_modules", "/src/generated/**", "/.git", "/.env"]
        assert self.rel(".", ctx, ignore) == [
            ".",
            "dist",
            "src",
            "src/app.spec.ts",
            "src/app.ts",
            "src/node_modules",
            "src/node_modules/x.js",
        ]

    def test_dot_pattern_is_ignored_and_never_drops_the_root(self, ctx):
        assert self.rel(".", ctx, [".", "./", ""]) == self.rel(".", ctx, [])
        assert self.rel(".", ctx, [".*", "*"]) == ["."]

    def test_copying_a_path_inside_an_ignored_directory_finds_nothing(self, ctx):
        assert self.rel("node_modules/pkg", ctx, ["node_modules"]) == []

    def test_negation_reincludes_paths_last_match_wins(self, ctx):
        assert self.rel(".", ctx, ["*", " !src ", "src/generated"]) == sorted(
            [".", "src/app.spec.ts", *self.SRC_FILES]
        )
        assert self.rel(
            ".",
            ctx,
            ["node_modules", "!node_modules/pkg/index.js", "*", "!node_modules"],
        ) == [".", "node_modules", "node_modules/pkg", "node_modules/pkg/index.js"]

    def test_negation_keeps_excluded_parent_directories(self, ctx):
        reincluded = ["node_modules/pkg", "node_modules/pkg/index.js"]
        assert self.rel(
            "node_modules", ctx, ["node_modules", "!node_modules/pkg/index.js"]
        ) == ["node_modules", *reincluded]
        assert self.rel(".", ctx, ["*", "!node_modules/pkg/index.js"]) == [
            ".",
            "node_modules",
            *reincluded,
        ]

    def test_wildcard_negation_reincludes_paths_inside_excluded_directories(self, ctx):
        assert self.rel(".", ctx, ["*", "!src/**/*.ts"]) == [
            ".",
            "src",
            "src/app.spec.ts",
            "src/app.ts",
            "src/generated",
            "src/generated/api.ts",
        ]
        assert self.rel(".", ctx, ["*", "!**/index.js"]) == [
            ".",
            "node_modules",
            "node_modules/pkg",
            "node_modules/pkg/index.js",
        ]

    def test_files_hash_error_for_ignored_source_mentions_ignore_patterns(self, ctx):
        with pytest.raises(
            ValueError, match=r"excluded by \.dockerignore or file_ignore_patterns"
        ):
            calculate_files_hash(
                "node_modules/pkg", "/app", ctx, ["node_modules"], False, None
            )

    def test_files_hash_ignores_changes_to_ignored_directory_contents(self, ctx):
        def files_hash():
            return calculate_files_hash(".", "/app", ctx, [".git"], False, None)

        before = files_hash()
        with open(os.path.join(ctx, ".git", "HEAD"), "a") as fh:
            fh.write("x")
        assert files_hash() == before

    def test_read_dockerignore_strips_utf8_bom(self, ctx):
        with open(os.path.join(ctx, ".dockerignore"), "w", encoding="utf-8-sig") as fh:
            fh.write(".env\n")
        assert read_dockerignore(ctx) == [".env"]


def test_file_ignore_patterns_take_precedence_and_may_be_absolute():
    with tempfile.TemporaryDirectory() as ctx:
        for name, content in [
            ("app.ts", "x"),
            ("secret.txt", "x"),
            (".dockerignore", "!secret.txt\n"),
        ]:
            with open(os.path.join(ctx, name), "w") as f:
                f.write(content)

        def files_hash():
            template = (
                Template(
                    file_context_path=ctx,
                    file_ignore_patterns=[os.path.join(ctx, "secret.txt")],
                )
                .from_image("node:22")
                .copy(".", "/app")
            )
            return json.loads(Template.to_json(template))["steps"][0]["filesHash"]

        before = files_hash()
        with open(os.path.join(ctx, "secret.txt"), "a") as f:
            f.write("x")
        assert files_hash() == before
