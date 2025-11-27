import pytest

from e2b import AsyncTemplate


@pytest.mark.skip_debug()
async def test_npm_install(async_build):
    template = (
        AsyncTemplate().from_node_image("24").skip_cache().npm_install("left-pad")
    )

    await async_build(template)


@pytest.mark.skip_debug()
async def test_npm_install_global(async_build):
    template = (
        AsyncTemplate()
        .from_node_image("24")
        .skip_cache()
        .npm_install("left-pad", g=True)
    )

    await async_build(template)


@pytest.mark.skip_debug()
async def test_npm_install_dev(async_build):
    template = (
        AsyncTemplate()
        .from_node_image("24")
        .skip_cache()
        .npm_install("left-pad", dev=True)
    )

    await async_build(template)
