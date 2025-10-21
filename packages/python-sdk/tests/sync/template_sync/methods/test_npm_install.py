import pytest

from e2b import Template


@pytest.mark.skip_debug()
def test_npm_install(build):
    template = Template().from_node_image("24").npm_install(["lodash", "ms"])

    build(template)


@pytest.mark.skip_debug()
def test_npm_install_global(build):
    template = Template().from_node_image("24").npm_install(["lodash", "ms"], g=True)

    build(template)
