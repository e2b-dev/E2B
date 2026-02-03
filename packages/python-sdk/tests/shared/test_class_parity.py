import inspect

from e2b.sandbox_async.main import AsyncSandbox
from e2b.sandbox_sync.main import Sandbox as SyncSandbox
from e2b.template_async.main import AsyncTemplate
from e2b.template_sync.main import Template as SyncTemplate


def _public_methods(cls):
    return {
        name: getattr(cls, name)
        for name in sorted(dir(cls))
        if not name.startswith("_") and callable(getattr(cls, name))
    }


def _signature_without_return(fn):
    signature = inspect.signature(fn)
    return signature.replace(return_annotation=inspect.Signature.empty)


def _assert_method_parity(sync_cls, async_cls, label):
    sync = _public_methods(sync_cls)
    async_ = _public_methods(async_cls)

    assert set(sync) == set(async_), (
        f"{label} missing from async: {set(sync) - set(async_)}, "
        f"missing from sync: {set(async_) - set(sync)}"
    )

    for name in sync:
        assert _signature_without_return(sync[name]) == _signature_without_return(
            async_[name]
        ), (
            f"{label}.{name}: sync{inspect.signature(sync[name])} "
            f"!= async{inspect.signature(async_[name])}"
        )


def test_sandbox_method_signatures_match():
    _assert_method_parity(SyncSandbox, AsyncSandbox, "Sandbox")


def test_template_method_signatures_match():
    _assert_method_parity(SyncTemplate, AsyncTemplate, "Template")
