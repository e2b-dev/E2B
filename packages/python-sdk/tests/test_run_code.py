import pytest

from e2b import run_code
from e2b.session.exception import UnsupportedRuntimeException


async def test_run_code():
    code = "console.log('hello\\n'.repeat(10)); throw new Error('error')"
    stdout, stderr = await run_code("Node16", code)

    assert len(stdout) == 60
    assert "Error: error" in stderr


async def test_unsupported_runtime():
    code = "console.log('hello'); throw new Error('error')"
    with pytest.raises(UnsupportedRuntimeException) as e:
        await run_code("unsupported", code)
