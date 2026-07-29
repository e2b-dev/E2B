import os
from e2b.template.utils import get_caller_directory, get_caller_frame


def test_get_caller_directory():
    assert get_caller_directory() == os.path.dirname(os.path.abspath(__file__))


def test_get_caller_frame_returns_first_frame_outside_sdk():
    frame = get_caller_frame()
    assert frame is not None
    # The returned frame must be this test file, no matter how many
    # SDK-internal frames sit above it.
    assert frame.f_code.co_filename == os.path.abspath(__file__)
