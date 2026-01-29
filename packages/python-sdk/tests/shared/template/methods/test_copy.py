import pytest

from e2b import Template
from e2b.exceptions import TemplateException


class TestTemplateCopyValidation:
    """Test cases for Template.copy() path validation."""

    class TestRejectsInvalidPaths:
        """Test cases that should raise TemplateException."""

        def test_rejects_absolute_unix_path(self):
            with pytest.raises(TemplateException) as excinfo:
                Template().from_base_image().copy("/etc/passwd", "/app")
            assert "absolute paths are not allowed" in str(excinfo.value)

        def test_rejects_parent_directory_escape(self):
            with pytest.raises(TemplateException) as excinfo:
                Template().from_base_image().copy("../secret", "/app")
            assert "path escapes the context directory" in str(excinfo.value)

        def test_rejects_nested_parent_directory_escape(self):
            with pytest.raises(TemplateException):
                Template().from_base_image().copy("foo/../../bar", "/app")

        def test_rejects_escape_via_dot_prefix(self):
            with pytest.raises(TemplateException):
                Template().from_base_image().copy("./foo/../../../bar", "/app")

        def test_rejects_just_parent_directory(self):
            with pytest.raises(TemplateException):
                Template().from_base_image().copy("..", "/app")

        def test_rejects_absolute_path_in_list(self):
            with pytest.raises(TemplateException):
                Template().from_base_image().copy(["valid.txt", "/etc/passwd"], "/app")

        def test_rejects_escape_path_in_list(self):
            with pytest.raises(TemplateException):
                Template().from_base_image().copy(["valid.txt", "../secret"], "/app")

    class TestAcceptsValidPaths:
        """Test cases that should not raise exceptions."""

        def test_accepts_simple_relative_path(self):
            Template().from_base_image().copy("file.txt", "/app")

        def test_accepts_nested_relative_path(self):
            Template().from_base_image().copy("src/file.txt", "/app")

        def test_accepts_path_with_dot_prefix(self):
            Template().from_base_image().copy("./file.txt", "/app")

        def test_accepts_internal_parent_ref_within_context(self):
            Template().from_base_image().copy("foo/../bar.txt", "/app")

        def test_accepts_glob_patterns(self):
            Template().from_base_image().copy("*.txt", "/app")
            Template().from_base_image().copy("**/*.ts", "/app")

        def test_accepts_current_directory(self):
            Template().from_base_image().copy(".", "/app")

        def test_accepts_list_of_valid_paths(self):
            Template().from_base_image().copy(["file1.txt", "file2.txt"], "/app")


class TestTemplateCopyItemsValidation:
    """Test cases for Template.copy_items() path validation."""

    def test_rejects_invalid_paths(self):
        with pytest.raises(TemplateException):
            Template().from_base_image().copy_items(
                [{"src": "/etc/passwd", "dest": "/app"}]
            )

    def test_rejects_escape_paths(self):
        with pytest.raises(TemplateException):
            Template().from_base_image().copy_items(
                [{"src": "../secret", "dest": "/app"}]
            )

    def test_accepts_valid_paths(self):
        Template().from_base_image().copy_items([{"src": "file.txt", "dest": "/app"}])
