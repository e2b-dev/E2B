import pytest

from e2b import handle_build_error
from e2b.exceptions import (
    AuthenticationException,
    BuildException,
    SandboxException,
)


def test_known_errors_exit_with_a_message(capsys):
    with pytest.raises(SystemExit) as exc:
        handle_build_error(AuthenticationException("API key is required"))
    assert exc.value.code == 1
    assert "Build failed: API key is required" in capsys.readouterr().err


def test_sandbox_exception_subclasses_exit(capsys):
    with pytest.raises(SystemExit) as exc:
        handle_build_error(SandboxException("boom"))
    assert exc.value.code == 1
    assert "Build failed: boom" in capsys.readouterr().err


def test_build_exception_exits(capsys):
    with pytest.raises(SystemExit) as exc:
        handle_build_error(BuildException("build failed"))
    assert exc.value.code == 1
    assert "Build failed: build failed" in capsys.readouterr().err


def test_unexpected_errors_are_reraised():
    err = TypeError("unexpected")
    with pytest.raises(TypeError, match="unexpected"):
        handle_build_error(err)
