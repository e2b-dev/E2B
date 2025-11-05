import pytest

from e2b import AsyncTemplate


@pytest.mark.skip_debug()
async def test_bun_install(async_build):
    template = (
        AsyncTemplate()
        .from_bun_image("1.3")
        .skip_cache()
        .bun_install(["lodash", "axios"])
    )

    await async_build(template)


@pytest.mark.skip_debug()
async def test_bun_install_global(async_build):
    template = (
        AsyncTemplate().from_bun_image("1.3").skip_cache().bun_install(["tsx"], g=True)
    )

    await async_build(template)


@pytest.mark.skip_debug()
async def test_bun_install_dev(async_build):
    template = (
        AsyncTemplate()
        .from_bun_image("1.3")
        .skip_cache()
        .bun_install(["typescript"], dev=True)
    )

    await async_build(template)
