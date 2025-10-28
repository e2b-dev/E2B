import tempfile
import os
import shutil
import json

import pytest

from e2b import Template


@pytest.fixture(scope="module")
def setup_dockerfile_context():
    """Setup test directory with package.json for dockerfile context tests"""
    test_dir = tempfile.mkdtemp(prefix="python_sync_dockerfile_test_")

    os.makedirs(test_dir, exist_ok=True)
    with open(os.path.join(test_dir, "package.json"), "w") as f:
        json.dump({"name": "my-app", "version": "1.0.0"}, f, indent=2)

    yield test_dir

    # Cleanup
    shutil.rmtree(test_dir, ignore_errors=True)


@pytest.mark.skip_debug()
def test_from_base_image(build):
    template = Template().from_base_image()
    build(template)


@pytest.mark.skip_debug()
def test_from_debian_image(build):
    template = Template().from_debian_image()
    build(template)


@pytest.mark.skip_debug()
def test_from_debian_image_with_variant(build):
    template = Template().from_debian_image("bookworm")
    build(template)


@pytest.mark.skip_debug()
def test_from_ubuntu_image(build):
    template = Template().from_ubuntu_image()
    build(template)


@pytest.mark.skip_debug()
def test_from_ubuntu_image_with_variant(build):
    template = Template().from_ubuntu_image("24.04")
    build(template)


@pytest.mark.skip_debug()
def test_from_python_image(build):
    template = Template().from_python_image()
    build(template)


@pytest.mark.skip_debug()
def test_from_python_image_with_variant(build):
    template = Template().from_python_image("3.12")
    build(template)


@pytest.mark.skip_debug()
def test_from_node_image(build):
    template = Template().from_node_image()
    build(template)


@pytest.mark.skip_debug()
def test_from_node_image_with_variant(build):
    template = Template().from_node_image("24")
    build(template)


@pytest.mark.skip_debug()
def test_from_bun_image(build):
    template = Template().from_bun_image()
    build(template)


@pytest.mark.skip_debug()
def test_from_bun_image_with_variant(build):
    template = Template().from_bun_image("1.3")
    build(template)


@pytest.mark.skip_debug()
def test_from_image(build):
    template = Template().from_image("ubuntu:22.04")
    build(template)


@pytest.mark.skip_debug()
def test_from_template(build):
    template = Template().from_template("base")
    build(template)


@pytest.mark.skip_debug()
def test_from_dockerfile(build, setup_dockerfile_context):
    dockerfile = """FROM node:24
WORKDIR /app
COPY package.json .
RUN npm install"""

    template = Template(file_context_path=setup_dockerfile_context).from_dockerfile(
        dockerfile
    )
    build(template)
