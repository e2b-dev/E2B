import pytest

from e2b import Template


@pytest.mark.skip_debug()
def test_to_dockerfile():
    template = (
        Template()
        .from_ubuntu_image("24.04")
        .copy("README.md", "/app/README.md")
        .run_cmd('echo "Hello, World!"')
    )

    dockerfile = Template.to_dockerfile(template)

    expected_dockerfile = """FROM ubuntu:24.04
COPY README.md /app/README.md
RUN echo "Hello, World!"
"""
    assert dockerfile == expected_dockerfile


@pytest.mark.skip_debug()
def test_to_dockerfile_with_options():
    template = (
        Template()
        .from_ubuntu_image("24.04")
        .copy("README.md", "/app/README.md", user="root")
        .run_cmd('echo "Hello, World!"', user="root")
    )

    dockerfile = Template.to_dockerfile(template)

    expected_dockerfile = """FROM ubuntu:24.04
COPY README.md /app/README.md
RUN echo "Hello, World!"
"""
    assert dockerfile == expected_dockerfile
