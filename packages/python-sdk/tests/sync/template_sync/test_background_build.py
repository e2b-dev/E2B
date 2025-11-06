import uuid

import pytest

from e2b import Template, wait_for_timeout


@pytest.mark.skip_debug()
@pytest.mark.timeout(10)
def test_build_in_background_should_start_build_and_return_info():
    """Test that build_in_background returns immediately without waiting for build to complete."""
    template = (
        Template()
        .from_image("ubuntu:22.04")
        .skip_cache()
        .run_cmd("sleep 5")  # Add a delay to ensure build takes time
        .set_start_cmd('echo "Hello"', wait_for_timeout(10_000))
    )

    alias = f"e2b-test-{uuid.uuid4()}"

    build_info = Template.build_in_background(
        template,
        alias=alias,
        cpu_count=1,
        memory_mb=1024,
    )

    # Should return quickly (within a few seconds), not wait for the full build
    assert build_info is not None

    # Verify the build is actually running
    status = Template.get_build_status(build_info)
    assert status.status.value == "building"
