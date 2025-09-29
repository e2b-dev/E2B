import pytest
from uuid import uuid4

from e2b import Template


@pytest.mark.skip_debug()
def test_pip_install():
    template = (
        Template().from_python_image("3.13.7-trixie").pip_install(["six", "pyyaml"])
    )

    Template.build(
        template,
        alias=str(uuid4()),
    )
