import sys
import pytest

from e2b.template.utils import validate_relative_path
from e2b.exceptions import TemplateException

is_windows = sys.platform == "win32"


class TestValidateRelativePathValid:
    """Test cases for valid paths."""

    def test_accepts_simple_relative_path(self):
        validate_relative_path("foo", None)

    def test_accepts_nested_relative_path(self):
        validate_relative_path("foo/bar", None)

    def test_accepts_path_with_dot_prefix(self):
        validate_relative_path("./foo", None)

    def test_accepts_nested_path_with_dot_prefix(self):
        validate_relative_path("./foo/bar", None)

    def test_accepts_internal_parent_ref_within_context(self):
        validate_relative_path("foo/../bar", None)

    def test_accepts_current_directory(self):
        validate_relative_path(".", None)

    def test_accepts_glob_patterns(self):
        validate_relative_path("*.txt", None)
        validate_relative_path("**/*.ts", None)
        validate_relative_path("src/**/*", None)

    def test_accepts_filenames_starting_with_double_dots(self):
        validate_relative_path("..myconfig", None)
        validate_relative_path("..cache", None)
        validate_relative_path("...something", None)
        validate_relative_path("foo/..myconfig", None)


class TestValidateRelativePathInvalidAbsolute:
    """Test cases for invalid absolute paths."""

    def test_rejects_unix_absolute_path(self):
        with pytest.raises(TemplateException) as excinfo:
            validate_relative_path("/absolute/path", None)
        assert "absolute paths are not allowed" in str(excinfo.value)

    def test_rejects_root_path(self):
        with pytest.raises(TemplateException):
            validate_relative_path("/", None)

    @pytest.mark.skipif(not is_windows, reason="Windows path test only runs on Windows")
    def test_rejects_windows_drive_letter_path(self):
        with pytest.raises(TemplateException) as excinfo:
            validate_relative_path("C:\\Windows\\System32", None)
        assert "absolute paths are not allowed" in str(excinfo.value)


class TestValidateRelativePathInvalidEscape:
    """Test cases for paths that escape the context directory."""

    def test_rejects_simple_parent_directory_escape(self):
        with pytest.raises(TemplateException) as excinfo:
            validate_relative_path("../foo", None)
        assert "path escapes the context directory" in str(excinfo.value)

    def test_rejects_double_parent_directory_escape(self):
        with pytest.raises(TemplateException):
            validate_relative_path("../../foo", None)

    def test_rejects_nested_parent_refs_escape(self):
        with pytest.raises(TemplateException):
            validate_relative_path("foo/../../bar", None)

    def test_rejects_dot_prefix_escape(self):
        with pytest.raises(TemplateException):
            validate_relative_path("./foo/../../../bar", None)

    def test_rejects_just_parent_directory(self):
        with pytest.raises(TemplateException):
            validate_relative_path("..", None)

    def test_rejects_current_directory_followed_by_parent(self):
        with pytest.raises(TemplateException):
            validate_relative_path("./..", None)

    def test_rejects_deeply_nested_escape(self):
        with pytest.raises(TemplateException):
            validate_relative_path("a/b/c/../../../../escape", None)


class TestValidateRelativePathErrorMessages:
    """Test cases for error message content."""

    def test_absolute_path_error_includes_path(self):
        with pytest.raises(TemplateException) as excinfo:
            validate_relative_path("/etc/passwd", None)
        assert "/etc/passwd" in str(excinfo.value)

    def test_escape_path_error_includes_path(self):
        with pytest.raises(TemplateException) as excinfo:
            validate_relative_path("../secret", None)
        assert "../secret" in str(excinfo.value)
