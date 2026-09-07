from e2b.template.consts import BASE_STEP_NAME, FINALIZE_STEP_NAME
from e2b.template.utils import get_build_step_index


def test_base_maps_to_first():
    assert get_build_step_index(BASE_STEP_NAME, 5) == 0


def test_finalize_maps_to_last():
    assert get_build_step_index(FINALIZE_STEP_NAME, 5) == 4


def test_numeric_string_maps_to_index():
    assert get_build_step_index("3", 5) == 3


def test_non_numeric_step_returns_none():
    # e2b Cloud itself reports "optimize" / "resize-disk" for those phases.
    # None means "no matching local stack trace", not an error.
    assert get_build_step_index("optimize", 5) is None
    assert get_build_step_index("RUN apt-get update", 5) is None
