import pytest
from uuid import uuid4

from e2b import Template


@pytest.mark.skip_debug()
def test_build():
    template = (
        Template().from_image("ubuntu:22.04").run_cmd("cat non_existing_file.txt")
    )

    Template.build(
        template,
        alias=str(uuid4()),
        cpu_count=1,
        memory_mb=1024,
    )
