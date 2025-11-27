import pytest

from e2b import Template


@pytest.mark.skip_debug()
def test_make_symlink(build):
    template = (
        Template()
        .from_image("ubuntu:22.04")
        .skip_cache()
        .make_symlink(".bashrc", ".bashrc.local")
        .run_cmd('test "$(readlink .bashrc.local)" = ".bashrc"')
    )

    build(template)


@pytest.mark.skip_debug()
def test_make_symlink_force(build):
    template = (
        Template()
        .from_image("ubuntu:22.04")
        .make_symlink(".bashrc", ".bashrc.local")
        .skip_cache()
        .make_symlink(
            ".bashrc", ".bashrc.local", force=True
        )  # Overwrite existing symlink
        .run_cmd('test "$(readlink .bashrc.local)" = ".bashrc"')
    )

    build(template)
