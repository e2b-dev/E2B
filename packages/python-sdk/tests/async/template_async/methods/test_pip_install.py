import pytest

from e2b import AsyncTemplate


@pytest.mark.skip_debug()
async def test_pip_install(async_build):
    template = (
        AsyncTemplate()
        .from_python_image("3.13.7-trixie")
        .skip_cache()
        .pip_install("pip-install-test")
    )

    await async_build(template)


@pytest.mark.skip_debug()
async def test_pip_install_user(async_build):
    template = (
        AsyncTemplate()
        .from_python_image("3.13.7-trixie")
        .skip_cache()
        .pip_install("pip-install-test", g=False)
    )

    await async_build(template)
