import pytest

from e2b.exceptions import InvalidArgumentException
from e2b.sandbox.sandbox_api import get_lifecycle


def test_get_lifecycle_returns_defaults_when_lifecycle_is_none():
    assert get_lifecycle(None) == {"on_timeout": "kill"}


def test_get_lifecycle_passes_through_on_timeout():
    assert get_lifecycle({"on_timeout": "kill"}) == {"on_timeout": "kill"}
    assert get_lifecycle({"on_timeout": "pause"}) == {"on_timeout": "pause"}


def test_get_lifecycle_preserves_auto_resume_from_lifecycle():
    assert get_lifecycle({"on_timeout": "pause", "auto_resume": True}) == {
        "on_timeout": "pause",
        "auto_resume": True,
    }
    assert get_lifecycle({"on_timeout": "pause", "auto_resume": False}) == {
        "on_timeout": "pause",
        "auto_resume": False,
    }


def test_get_lifecycle_omits_auto_resume_when_not_set_in_lifecycle():
    assert "auto_resume" not in get_lifecycle({"on_timeout": "pause"})
    assert "auto_resume" not in get_lifecycle({"on_timeout": "kill"})


def test_get_lifecycle_raises_when_auto_resume_true_with_kill():
    with pytest.raises(InvalidArgumentException):
        get_lifecycle({"on_timeout": "kill", "auto_resume": True})


def test_get_lifecycle_does_not_raise_when_auto_resume_true_with_pause():
    assert get_lifecycle({"on_timeout": "pause", "auto_resume": True}) == {
        "on_timeout": "pause",
        "auto_resume": True,
    }


def test_get_lifecycle_does_not_raise_when_auto_resume_false_with_kill():
    assert get_lifecycle({"on_timeout": "kill", "auto_resume": False}) == {
        "on_timeout": "kill",
        "auto_resume": False,
    }
