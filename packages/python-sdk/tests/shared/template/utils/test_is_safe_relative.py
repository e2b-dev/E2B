import os

import pytest

from e2b.template.utils import is_safe_relative


class TestAbsolutePaths:
    def test_should_return_true_for_unix_absolute_paths(self):
        assert is_safe_relative("/absolute/path") is False


class TestParentDirectoryTraversal:
    def test_should_return_true_for_parent_directory_only(self):
        assert is_safe_relative("..") is False

    @pytest.mark.skipif(not os.name == "posix", reason="Unix-specific path tests")
    def test_should_return_true_for_paths_starting_with_dot_dot_slash(self):
        assert is_safe_relative("../file.txt") is False

    @pytest.mark.skipif(not os.name == "nt", reason="Windows-specific path tests")
    def test_should_return_true_for_paths_starting_with_dot_dot_backslash(self):
        assert is_safe_relative("..\\file.txt") is False

    def test_should_return_true_for_normalized_paths_that_escape_context(self):
        assert is_safe_relative("foo/../../bar") is False


class TestValidRelativePaths:
    def test_should_return_false_for_simple_relative_paths(self):
        assert is_safe_relative("file.txt") is True
        assert is_safe_relative("folder/file.txt") is True

    def test_should_return_false_for_current_directory_references(self):
        assert is_safe_relative(".") is True
        assert is_safe_relative("./file.txt") is True
        assert is_safe_relative("./folder/file.txt") is True

    def test_should_return_false_for_glob_patterns(self):
        assert is_safe_relative("*.txt") is True
        assert is_safe_relative("**/*.ts") is True
        assert is_safe_relative("src/**/*") is True

    def test_should_return_false_for_hidden_files_and_directories(self):
        assert is_safe_relative(".hidden") is True
        assert is_safe_relative(".config/settings") is True
