from e2b import AsyncTemplate


async def test_make_symlink(async_build):
    template = (
        AsyncTemplate()
        .from_image("ubuntu:22.04")
        .skip_cache()
        .make_symlink(".bashrc", ".bashrc.local")
        .run_cmd('test "$(readlink .bashrc.local)" = ".bashrc"')
    )

    await async_build(template)


async def test_make_symlink_force(async_build):
    template = (
        AsyncTemplate()
        .from_image("ubuntu:22.04")
        .make_symlink(".bashrc", ".bashrc.local")
        .skip_cache()
        .make_symlink(
            ".bashrc", ".bashrc.local", force=True
        )  # Overwrite existing symlink
        .run_cmd('test "$(readlink .bashrc.local)" = ".bashrc"')
    )

    await async_build(template)
