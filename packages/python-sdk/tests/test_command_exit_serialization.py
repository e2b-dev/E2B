import copy
import multiprocessing
from concurrent.futures import ProcessPoolExecutor
import pickle

import pytest

from e2b import CommandExitException


@pytest.mark.parametrize("error", [None, "process failed"])
@pytest.mark.parametrize("protocol", range(pickle.HIGHEST_PROTOCOL + 1))
def test_command_exit_exception_pickle(error, protocol):
    original = CommandExitException(
        stderr="failure\n", stdout="partial output\n", exit_code=7, error=error
    )
    original.status_code = 500
    restored = pickle.loads(pickle.dumps(original, protocol=protocol))
    assert isinstance(restored, CommandExitException)
    assert restored.__dict__ == original.__dict__
    assert restored.args == original.args
    assert str(restored) == str(original)


@pytest.mark.parametrize("clone", [copy.copy, copy.deepcopy])
def test_command_exit_exception_copy(clone):
    original = CommandExitException(
        stderr="failure", stdout="partial", exit_code=1, error=None
    )
    restored = clone(original)
    assert restored is not original
    assert restored.__dict__ == original.__dict__
    assert restored.args == original.args
    assert str(restored) == str(original)


def _raise_command_failure():
    raise CommandExitException(
        stderr="worker failure", stdout="worker output", exit_code=7, error=None
    )


def test_command_failure_crosses_process_boundary():
    with ProcessPoolExecutor(
        max_workers=1, mp_context=multiprocessing.get_context("spawn")
    ) as executor:
        future = executor.submit(_raise_command_failure)
        with pytest.raises(CommandExitException) as caught:
            future.result(timeout=20)
    assert caught.value.stderr == "worker failure"
    assert caught.value.stdout == "worker output"
    assert caught.value.exit_code == 7
    assert caught.value.error is None
