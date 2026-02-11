import inspect

from e2b.sandbox_async.git import Git as AsyncGit
from e2b.sandbox_sync.git import Git as SyncGit


def _public_methods(cls):
    return {
        name: getattr(cls, name)
        for name in sorted(dir(cls))
        if not name.startswith("_") and callable(getattr(cls, name))
    }


def test_identical_method_signatures():
    sync = _public_methods(SyncGit)
    async_ = _public_methods(AsyncGit)

    assert set(sync) == set(async_), (
        f"missing from async: {set(sync) - set(async_)}, "
        f"missing from sync: {set(async_) - set(sync)}"
    )

    for name in sync:
        assert inspect.signature(sync[name]) == inspect.signature(async_[name]), (
            f"{name}: sync{inspect.signature(sync[name])} "
            f"!= async{inspect.signature(async_[name])}"
        )


def test_async_methods_are_coroutines():
    for name, method in _public_methods(AsyncGit).items():
        assert inspect.iscoroutinefunction(method), f"AsyncGit.{name} is not async"
