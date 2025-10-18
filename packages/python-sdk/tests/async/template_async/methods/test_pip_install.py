import pytest
from uuid import uuid4

from e2b import AsyncTemplate


@pytest.mark.skip_debug()
async def test_pip_install():
    template = (
        AsyncTemplate()
        .from_python_image("3.13.7-trixie")
        .pip_install(["six", "pyyaml"])
    )

    await AsyncTemplate.build(
        template,
        alias=str(uuid4()),
    )


@pytest.mark.skip_debug()
async def test_pip_install_global():
    template = (
        AsyncTemplate()
        .from_python_image("3.13.7-trixie")
        .pip_install(["six", "pyyaml"], g=True)
    )

    await AsyncTemplate.build(
        template,
        alias=str(uuid4()),
    )
