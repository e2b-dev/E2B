from e2b import Template


def test_make_symlink(build):
    template = (
        Template()
        .from_image("ubuntu:22.04")
        .skip_cache()
        .make_symlink(".bashrc", ".bashrc.local")
        .run_cmd('test "$(readlink .bashrc.local)" = ".bashrc"')
    )

    build(template)


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
