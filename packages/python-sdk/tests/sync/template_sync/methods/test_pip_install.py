import pytest

from e2b import Template


@pytest.mark.skip_debug()
def test_pip_install(build):
    template = (
        Template()
        .from_python_image("3.13.7-trixie")
        .skip_cache()
        .pip_install("pip-install-test")
    )

    build(template)


@pytest.mark.skip_debug()
def test_pip_install_user(build):
    template = (
        Template()
        .from_python_image("3.13.7-trixie")
        .skip_cache()
        .pip_install("pip-install-test", g=False)
    )

    build(template)
