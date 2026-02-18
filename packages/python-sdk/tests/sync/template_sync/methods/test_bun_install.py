import pytest

from e2b import Template


@pytest.mark.skip_debug()
def test_bun_install(build):
    template = Template().from_bun_image("1.3").skip_cache().bun_install("left-pad")

    build(template)


@pytest.mark.skip_debug()
def test_bun_install_global(build):
    template = (
        Template().from_bun_image("1.3").skip_cache().bun_install("left-pad", g=True)
    )

    build(template)


@pytest.mark.skip_debug()
def test_bun_install_dev(build):
    template = (
        Template().from_bun_image("1.3").skip_cache().bun_install("left-pad", dev=True)
    )

    build(template)
