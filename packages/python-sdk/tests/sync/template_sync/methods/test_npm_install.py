import pytest
from uuid import uuid4

from e2b import Template


@pytest.mark.skip_debug()
def test_npm_install():
    template = Template().from_node_image("24").npm_install(["lodash", "ms"])

    Template.build(
        template,
        alias=str(uuid4()),
    )


@pytest.mark.skip_debug()
def test_npm_install_global():
    template = Template().from_node_image("24").npm_install(["lodash", "ms"], g=True)

    Template.build(
        template,
        alias=str(uuid4()),
    )
