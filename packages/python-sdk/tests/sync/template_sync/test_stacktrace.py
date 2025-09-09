import pytest
from uuid import uuid4

from e2b import Template, wait_for_timeout


@pytest.mark.skip_debug()
def test_build():
    template = (
        Template()
        .from_image("ubuntu:22.04")
        .run_cmd("cat non_existing_file.txt")
        .set_workdir("/app")
        .set_start_cmd("echo 'Hello, world!'", wait_for_timeout(10_000))
    )

    try:
        Template.build(
            template,
            alias=str(uuid4()),
            cpu_count=1,
            memory_mb=1024,
        )
    except Exception as e:
        traceback_file = None
        latest_traceback = e.__traceback__
        if latest_traceback is not None:
            traceback_file = latest_traceback.tb_frame.f_code.co_filename
        assert __file__ == traceback_file
