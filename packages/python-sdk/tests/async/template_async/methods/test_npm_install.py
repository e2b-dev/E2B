import pytest

from e2b import AsyncTemplate


@pytest.mark.skip_debug()
async def test_npm_install(async_build):
    template = AsyncTemplate().from_node_image("24").npm_install(["lodash", "ms"])

    await async_build(template)


@pytest.mark.skip_debug()
async def test_npm_install_global(async_build):
    template = (
        AsyncTemplate().from_node_image("24").npm_install(["lodash", "ms"], g=True)
    )

    await async_build(template)
