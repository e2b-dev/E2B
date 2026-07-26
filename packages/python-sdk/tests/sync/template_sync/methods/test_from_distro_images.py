import pytest

from e2b import Template


@pytest.mark.skip_debug()
def test_from_fedora_image():
    template = Template().from_fedora_image("42")

    dockerfile = Template.to_dockerfile(template)

    assert dockerfile == "FROM fedora:42\n"


@pytest.mark.skip_debug()
def test_from_fedora_image_with_default_variant():
    template = Template().from_fedora_image()

    dockerfile = Template.to_dockerfile(template)

    assert dockerfile == "FROM fedora:latest\n"


@pytest.mark.skip_debug()
def test_from_alpine_image():
    template = Template().from_alpine_image("3.22")

    dockerfile = Template.to_dockerfile(template)

    assert dockerfile == "FROM alpine:3.22\n"


@pytest.mark.skip_debug()
def test_from_alpine_image_with_default_variant():
    template = Template().from_alpine_image()

    dockerfile = Template.to_dockerfile(template)

    assert dockerfile == "FROM alpine:latest\n"


@pytest.mark.skip_debug()
def test_from_arch_image():
    template = Template().from_arch_image("base-devel")

    dockerfile = Template.to_dockerfile(template)

    assert dockerfile == "FROM archlinux:base-devel\n"


@pytest.mark.skip_debug()
def test_from_arch_image_with_default_variant():
    template = Template().from_arch_image()

    dockerfile = Template.to_dockerfile(template)

    assert dockerfile == "FROM archlinux:latest\n"
