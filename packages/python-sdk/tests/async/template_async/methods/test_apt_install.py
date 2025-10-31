import pytest

from e2b import AsyncTemplate


@pytest.mark.skip_debug()
async def test_apt_install(async_build):
    template = AsyncTemplate().from_image("ubuntu:24.04").apt_install(["vim"])

    await async_build(template)


@pytest.mark.skip_debug()
async def test_apt_install_no_install_recommends(async_build):
    template = (
        AsyncTemplate()
        .from_image("ubuntu:24.04")
        .apt_install(["vim"], no_install_recommends=True)
    )
    await async_build(template)
