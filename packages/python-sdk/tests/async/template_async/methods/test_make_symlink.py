import pytest

from e2b import AsyncTemplate


@pytest.mark.skip_debug()
async def test_make_symlink(async_build):
    template = (
        AsyncTemplate()
        .from_image("ubuntu:22.04")
        .make_symlink(".bashrc", ".bashrc.local")
    )

    await async_build(template)


@pytest.mark.skip_debug()
async def test_make_symlink_force(async_build):
    template = (
        AsyncTemplate()
        .from_image("ubuntu:22.04")
        .make_symlink(".bashrc", ".bashrc.local", force=True)
    )

    await async_build(template)
