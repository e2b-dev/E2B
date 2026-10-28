from unittest.mock import Mock

import pytest

from e2b_desktop import Sandbox


@pytest.mark.parametrize("stage", ["capture", "read"])
@pytest.mark.parametrize("cleanup_fails", [False, True])
def test_cleans_up_after_failure_and_preserves_original_error(stage, cleanup_fails):
    sandbox = Mock()
    failure = RuntimeError(f"{stage} failed")
    operation = sandbox.commands.run if stage == "capture" else sandbox.files.read
    operation.side_effect = failure
    if cleanup_fails:
        sandbox.files.remove.side_effect = RuntimeError("cleanup failed")

    with pytest.raises(RuntimeError) as error:
        Sandbox.screenshot(sandbox)

    assert error.value is failure
    sandbox.files.remove.assert_called_once()
    path = sandbox.files.remove.call_args.args[0]
    sandbox.commands.run.assert_called_once_with(f"scrot --pointer {path}")
    if stage == "capture":
        sandbox.files.read.assert_not_called()
    else:
        sandbox.files.read.assert_called_once_with(path, format="bytes")


@pytest.mark.parametrize("format", ["bytes", "stream"])
def test_returns_original_screenshot_after_cleanup(format):
    sandbox = Mock()
    file = bytearray([1, 2, 3]) if format == "bytes" else iter([b"image"])
    sandbox.files.read.return_value = file
    sandbox.files.remove.side_effect = lambda _: sandbox.files.read.assert_called_once()

    assert Sandbox.screenshot(sandbox, format=format) is file

    path = sandbox.files.read.call_args.args[0]
    sandbox.files.read.assert_called_once_with(path, format=format)
    sandbox.files.remove.assert_called_once_with(path)
    if format == "stream":
        assert list(file) == [b"image"]


def test_preserves_cleanup_error_after_successful_read():
    sandbox = Mock()
    failure = RuntimeError("cleanup failed")
    sandbox.files.remove.side_effect = failure

    with pytest.raises(RuntimeError) as error:
        Sandbox.screenshot(sandbox)

    assert error.value is failure
