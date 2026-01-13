from e2b.template.utils import is_path_outside_context


class TestAbsolutePaths:
    def test_should_return_true_for_unix_absolute_paths(self):
        assert is_path_outside_context("/absolute/path") is True


class TestParentDirectoryTraversal:
    def test_should_return_true_for_parent_directory_only(self):
        assert is_path_outside_context("..") is True

    def test_should_return_true_for_paths_starting_with_dot_dot_slash(self):
        assert is_path_outside_context("../file.txt") is True

    def test_should_return_true_for_paths_starting_with_dot_dot_backslash(self):
        assert is_path_outside_context("..\\file.txt") is True

    def test_should_return_true_for_normalized_paths_that_escape_context(self):
        assert is_path_outside_context("foo/../../bar") is True


class TestValidRelativePaths:
    def test_should_return_false_for_simple_relative_paths(self):
        assert is_path_outside_context("file.txt") is False
        assert is_path_outside_context("folder/file.txt") is False

    def test_should_return_false_for_current_directory_references(self):
        assert is_path_outside_context(".") is False
        assert is_path_outside_context("./file.txt") is False
        assert is_path_outside_context("./folder/file.txt") is False

    def test_should_return_false_for_glob_patterns(self):
        assert is_path_outside_context("*.txt") is False
        assert is_path_outside_context("**/*.ts") is False
        assert is_path_outside_context("src/**/*") is False

    def test_should_return_false_for_hidden_files_and_directories(self):
        assert is_path_outside_context(".hidden") is False
        assert is_path_outside_context(".config/settings") is False
