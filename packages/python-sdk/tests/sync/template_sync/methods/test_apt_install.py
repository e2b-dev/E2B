import pytest

from e2b import Template


@pytest.mark.skip_debug()
def test_apt_install(build):
    template = Template().from_image("ubuntu:24.04").apt_install(["vim"])

    build(template)


@pytest.mark.skip_debug()
def test_apt_install_no_install_recommends(build):
    template = (
        Template()
        .from_image("ubuntu:24.04")
        .apt_install(["vim"], no_install_recommends=True)
    )

    build(template)
