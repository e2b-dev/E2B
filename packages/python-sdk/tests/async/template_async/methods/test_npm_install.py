import pytest
from uuid import uuid4

from e2b import AsyncTemplate


@pytest.mark.skip_debug()
async def test_npm_install():
    template = AsyncTemplate().from_node_image("24").npm_install(["lodash", "ms"])

    await AsyncTemplate.build(
        template,
        alias=str(uuid4()),
    )


@pytest.mark.skip_debug()
async def test_npm_install_global():
    template = (
        AsyncTemplate().from_node_image("24").npm_install(["lodash", "ms"], g=True)
    )

    await AsyncTemplate.build(
        template,
        alias=str(uuid4()),
    )
