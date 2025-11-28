import pytest

from e2b import AsyncTemplate


@pytest.mark.skip_debug()
async def test_bun_install(async_build):
    template = (
        AsyncTemplate().from_bun_image("1.3").skip_cache().bun_install("left-pad")
    )

    await async_build(template)


@pytest.mark.skip_debug()
async def test_bun_install_global(async_build):
    template = (
        AsyncTemplate()
        .from_bun_image("1.3")
        .skip_cache()
        .bun_install("left-pad", g=True)
    )

    await async_build(template)


@pytest.mark.skip_debug()
async def test_bun_install_dev(async_build):
    template = (
        AsyncTemplate()
        .from_bun_image("1.3")
        .skip_cache()
        .bun_install("left-pad", dev=True)
    )

    await async_build(template)
