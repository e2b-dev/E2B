import pytest

from e2b import Template


@pytest.mark.skip_debug()
def test_npm_install(build):
    template = Template().from_node_image("24").skip_cache().npm_install(["lodash", "axios"])

    build(template)


@pytest.mark.skip_debug()
def test_npm_install_global(build):
    template = Template().from_node_image("24").skip_cache().npm_install(["tsx"], g=True)

    build(template)


@pytest.mark.skip_debug()
def test_npm_install_dev(build):
    template = (
        Template().from_node_image("24").skip_cache().npm_install(["typescript"], dev=True)
    )

    build(template)
