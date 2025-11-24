import tempfile
import os
import shutil
import json

import pytest

from e2b import AsyncTemplate
from e2b.template.types import InstructionType


@pytest.fixture(scope="module")
def setup_dockerfile_context():
    """Setup test directory with package.json for dockerfile context tests"""
    test_dir = tempfile.mkdtemp(prefix="python_async_dockerfile_test_")

    with open(os.path.join(test_dir, "package.json"), "w") as f:
        json.dump({"name": "my-app", "version": "1.0.0"}, f, indent=2)

    yield test_dir

    # Cleanup
    shutil.rmtree(test_dir, ignore_errors=True)


@pytest.mark.skip_debug()
async def test_from_base_image(async_build):
    template = AsyncTemplate().from_base_image()
    await async_build(template, skip_cache=True)


@pytest.mark.skip_debug()
async def test_from_debian_image(async_build):
    template = AsyncTemplate().from_debian_image()
    await async_build(template, skip_cache=True)


@pytest.mark.skip_debug()
async def test_from_debian_image_with_variant(async_build):
    template = AsyncTemplate().from_debian_image("bookworm")
    await async_build(template, skip_cache=True)


@pytest.mark.skip_debug()
async def test_from_ubuntu_image(async_build):
    template = AsyncTemplate().from_ubuntu_image()
    await async_build(template, skip_cache=True)


@pytest.mark.skip_debug()
async def test_from_ubuntu_image_with_variant(async_build):
    template = AsyncTemplate().from_ubuntu_image("24.04")
    await async_build(template, skip_cache=True)


@pytest.mark.skip_debug()
async def test_from_python_image(async_build):
    template = AsyncTemplate().from_python_image()
    await async_build(template, skip_cache=True)


@pytest.mark.skip_debug()
async def test_from_python_image_with_variant(async_build):
    template = AsyncTemplate().from_python_image("3.12")
    await async_build(template, skip_cache=True)


@pytest.mark.skip_debug()
async def test_from_node_image(async_build):
    template = AsyncTemplate().from_node_image()
    await async_build(template, skip_cache=True)


@pytest.mark.skip_debug()
async def test_from_bun_image(async_build):
    template = AsyncTemplate().from_bun_image()
    await async_build(template, skip_cache=True)


@pytest.mark.skip_debug()
async def test_from_bun_image_with_variant(async_build):
    template = AsyncTemplate().from_bun_image("1.3")
    await async_build(template, skip_cache=True)


@pytest.mark.skip_debug()
async def test_from_node_image_with_variant(async_build):
    template = AsyncTemplate().from_node_image("24")
    await async_build(template, skip_cache=True)


@pytest.mark.skip_debug()
async def test_from_image(async_build):
    template = AsyncTemplate().from_image("ubuntu:22.04")
    await async_build(template, skip_cache=True)


@pytest.mark.skip_debug()
async def test_from_template(async_build):
    template = AsyncTemplate().from_template("base")
    await async_build(template, skip_cache=True)


@pytest.mark.skip_debug()
async def test_from_dockerfile(async_build, setup_dockerfile_context):
    dockerfile = """FROM node:24
WORKDIR /app
COPY package.json .
RUN npm install"""

    template = AsyncTemplate(
        file_context_path=setup_dockerfile_context
    ).from_dockerfile(dockerfile)
    await async_build(template, skip_cache=True)


@pytest.mark.skip_debug()
async def test_from_dockerfile_with_default_user_and_workdir(setup_dockerfile_context):
    dockerfile = """FROM node:24"""

    template = AsyncTemplate(
        file_context_path=setup_dockerfile_context
    ).from_dockerfile(dockerfile)

    assert template._template._instructions[-2]["type"] == InstructionType.USER
    assert template._template._instructions[-2]["args"][0] == "user"
    assert template._template._instructions[-1]["type"] == InstructionType.WORKDIR
    assert template._template._instructions[-1]["args"][0] == "/home/user"


@pytest.mark.skip_debug()
async def test_from_dockerfile_with_custom_user_and_workdir(setup_dockerfile_context):
    dockerfile = """FROM node:24\nUSER mish\nWORKDIR /home/mish"""

    template = AsyncTemplate(
        file_context_path=setup_dockerfile_context
    ).from_dockerfile(dockerfile)

    assert template._template._instructions[-2]["type"] == InstructionType.USER
    assert template._template._instructions[-2]["args"][0] == "mish"
    assert template._template._instructions[-1]["type"] == InstructionType.WORKDIR
    assert template._template._instructions[-1]["args"][0] == "/home/mish"
