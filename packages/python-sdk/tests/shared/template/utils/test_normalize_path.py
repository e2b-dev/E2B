from e2b.template.utils import normalize_path


class TestBasicPathNormalization:
    def test_should_resolve_parent_directory_references(self):
        assert normalize_path("/foo/bar/../baz") == "/foo/baz"

    def test_should_remove_current_directory_references(self):
        assert normalize_path("foo/./bar") == "foo/bar"

    def test_should_collapse_multiple_slashes(self):
        assert normalize_path("foo//bar///baz") == "foo/bar/baz"

    def test_should_handle_multiple_parent_directory_traversals_in_relative_paths(self):
        assert normalize_path("../foo/../../bar") == "../../bar"

    def test_should_not_traverse_past_root_for_absolute_paths(self):
        assert normalize_path("/foo/../../bar") == "/bar"

    def test_should_return_dot_for_empty_path(self):
        assert normalize_path("") == "."

    def test_should_remove_leading_current_directory_reference(self):
        assert normalize_path("./foo/bar") == "foo/bar"


class TestWindowsPathsConvertedToPosixStyle:
    """
    Note: On Unix systems, backslash is a valid filename character, not a path separator.
    The Python implementation uses os.path.normpath which is OS-dependent.
    These tests use forward slashes which work correctly cross-platform.
    """

    def test_should_normalize_windows_path_with_drive_letter_and_forward_slashes(self):
        assert normalize_path("C:/foo/bar/../baz") == "/foo/baz"

    def test_should_strip_drive_letter(self):
        assert normalize_path("C:/foo/bar") == "/foo/bar"

    def test_should_strip_lowercase_drive_letter(self):
        assert normalize_path("c:/foo/bar") == "/foo/bar"

    def test_should_strip_drive_letter_with_simple_path(self):
        # Note: Python's os.path.normpath normalizes "D:/" to "D:" on Unix,
        # and after stripping drive letter and calling as_posix(), result is empty string
        assert normalize_path("D:/") == ""


class TestEdgeCases:
    def test_should_return_dot_for_current_directory(self):
        assert normalize_path(".") == "."

    def test_should_handle_parent_directory_only(self):
        assert normalize_path("..") == ".."

    def test_should_handle_absolute_root_path(self):
        assert normalize_path("/") == "/"

    def test_should_handle_complex_nested_path(self):
        assert normalize_path("a/b/c/../../d/./e/../f") == "a/d/f"

    def test_should_preserve_trailing_segments_after_parent_traversal(self):
        assert normalize_path("a/../b/../c") == "c"
