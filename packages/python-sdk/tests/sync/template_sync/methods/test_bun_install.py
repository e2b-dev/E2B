import pytest

from e2b import Template


@pytest.mark.skip_debug()
def test_bun_install(build):
    template = (
        Template().from_bun_image("1.3").skip_cache().bun_install(["lodash", "axios"])
    )

    build(template)


@pytest.mark.skip_debug()
def test_bun_install_global(build):
    template = (
        Template().from_bun_image("1.3").skip_cache().bun_install(["tsx"], g=True)
    )

    build(template)


@pytest.mark.skip_debug()
def test_bun_install_dev(build):
    template = (
        Template()
        .from_bun_image("1.3")
        .skip_cache()
        .bun_install(["typescript"], dev=True)
    )

    build(template)
