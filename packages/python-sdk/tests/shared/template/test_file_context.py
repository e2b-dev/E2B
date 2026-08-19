import os
import tempfile

import pytest

from e2b import Template

# Path to a committed, read-only fixture, relative to this file's directory.
# The implicit file context is the directory of the file that calls Template(),
# so it is always inside the repository — which is why the fixture is committed
# and never written to, rather than generated into a temp directory.
FIXTURE_PATH = "fixtures/hello.txt"


def test_file_context_defaults_to_caller_directory():
    implicit = Template().from_base_image().copy(FIXTURE_PATH, "hello.txt")
    explicit = (
        Template(file_context_path=os.path.dirname(__file__))
        .from_base_image()
        .copy(FIXTURE_PATH, "hello.txt")
    )

    # to_json hashes each COPY's files, so the two serializations only match if
    # the implicit context resolved to this file's directory, the glob found the
    # fixture there, and its contents were read. This is the only test that
    # exercises the implicit default end to end — every other template test
    # passes file_context_path explicitly, and the unit test for
    # get_caller_directory covers the helper in isolation, not its use here.
    assert Template.to_json(implicit) == Template.to_json(explicit)


def test_file_context_without_the_source_fails_to_resolve_it():
    # Keeps the assertion above from passing vacuously: the hashes match because
    # the fixture was found, not because a missing file hashes the same either
    # way.
    with tempfile.TemporaryDirectory() as empty_context:
        wrong_context = (
            Template(file_context_path=empty_context)
            .from_base_image()
            .copy(FIXTURE_PATH, "hello.txt")
        )

        with pytest.raises(ValueError, match="No files found"):
            Template.to_json(wrong_context)
