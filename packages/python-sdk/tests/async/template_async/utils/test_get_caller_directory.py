import pytest
from e2b.template.utils import get_caller_directory
import os


@pytest.mark.asyncio
async def test_get_caller_directory():
    assert get_caller_directory(1) == os.path.dirname(__file__)
