import pytest

from e2b import AsyncTemplate


@pytest.mark.skip_debug()
async def test_from_fedora_image():
    template = AsyncTemplate().from_fedora_image("42")

    dockerfile = AsyncTemplate.to_dockerfile(template)

    assert dockerfile == "FROM fedora:42\n"


@pytest.mark.skip_debug()
async def test_from_fedora_image_with_default_variant():
    template = AsyncTemplate().from_fedora_image()

    dockerfile = AsyncTemplate.to_dockerfile(template)

    assert dockerfile == "FROM fedora:latest\n"


@pytest.mark.skip_debug()
async def test_from_alpine_image():
    template = AsyncTemplate().from_alpine_image("3.22")

    dockerfile = AsyncTemplate.to_dockerfile(template)

    assert dockerfile == "FROM alpine:3.22\n"


@pytest.mark.skip_debug()
async def test_from_alpine_image_with_default_variant():
    template = AsyncTemplate().from_alpine_image()

    dockerfile = AsyncTemplate.to_dockerfile(template)

    assert dockerfile == "FROM alpine:latest\n"


@pytest.mark.skip_debug()
async def test_from_arch_image():
    template = AsyncTemplate().from_arch_image("base-devel")

    dockerfile = AsyncTemplate.to_dockerfile(template)

    assert dockerfile == "FROM archlinux:base-devel\n"


@pytest.mark.skip_debug()
async def test_from_arch_image_with_default_variant():
    template = AsyncTemplate().from_arch_image()

    dockerfile = AsyncTemplate.to_dockerfile(template)

    assert dockerfile == "FROM archlinux:latest\n"
