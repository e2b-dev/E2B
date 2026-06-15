from e2b import Template


def test_remove_quotes_paths_with_special_characters():
    template = (
        Template()
        .from_ubuntu_image("24.04")
        .remove(["/tmp/my file", "/tmp/plain"], recursive=True, force=True)
    )

    dockerfile = Template.to_dockerfile(template)

    assert "RUN rm -r -f '/tmp/my file' /tmp/plain\n" in dockerfile


def test_rename_quotes_paths_with_special_characters():
    template = (
        Template().from_ubuntu_image("24.04").rename("/tmp/old name", "/tmp/new name")
    )

    dockerfile = Template.to_dockerfile(template)

    assert "RUN mv '/tmp/old name' '/tmp/new name'\n" in dockerfile


def test_make_dir_quotes_paths_with_special_characters():
    template = (
        Template().from_ubuntu_image("24.04").make_dir("/app/my data", mode=0o755)
    )

    dockerfile = Template.to_dockerfile(template)

    assert "RUN mkdir -p -m 0755 '/app/my data'\n" in dockerfile


def test_make_symlink_quotes_paths_with_special_characters():
    template = (
        Template()
        .from_ubuntu_image("24.04")
        .make_symlink("/usr/bin/python3", "/usr/local/bin/my python")
    )

    dockerfile = Template.to_dockerfile(template)

    assert "RUN ln -s /usr/bin/python3 '/usr/local/bin/my python'\n" in dockerfile


def test_plain_paths_stay_unquoted():
    template = (
        Template()
        .from_ubuntu_image("24.04")
        .remove("/tmp/cache", recursive=True)
        .rename("/tmp/a", "/tmp/b")
        .make_dir("/app/data")
        .make_symlink("/usr/bin/python3", "/usr/bin/python")
    )

    dockerfile = Template.to_dockerfile(template)

    assert "RUN rm -r /tmp/cache\n" in dockerfile
    assert "RUN mv /tmp/a /tmp/b\n" in dockerfile
    assert "RUN mkdir -p /app/data\n" in dockerfile
    assert "RUN ln -s /usr/bin/python3 /usr/bin/python\n" in dockerfile
