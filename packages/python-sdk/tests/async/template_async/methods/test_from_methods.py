import tempfile
import os
import shutil
import json

import pytest

from e2b import AsyncTemplate


@pytest.fixture(scope="module")
def setup_dockerfile_context():
    """Setup test directory with package.json for dockerfile context tests"""
    test_dir = tempfile.mkdtemp(prefix="python_async_dockerfile_test_")
    folder_path = os.path.join(test_dir, "dockerfile-context")

    os.makedirs(folder_path, exist_ok=True)
    with open(os.path.join(folder_path, "package.json"), "w") as f:
        json.dump({"name": "my-app", "version": "1.0.0"}, f, indent=2)

    yield test_dir

    # Cleanup
    shutil.rmtree(test_dir, ignore_errors=True)


@pytest.mark.skip_debug()
async def test_from_base_image(async_build):
    template = AsyncTemplate().from_base_image()
    await async_build(template)


@pytest.mark.skip_debug()
async def test_from_debian_image(async_build):
    template = AsyncTemplate().from_debian_image()
    await async_build(template)


@pytest.mark.skip_debug()
async def test_from_debian_image_with_variant(async_build):
    template = AsyncTemplate().from_debian_image("bookworm")
    await async_build(template)


@pytest.mark.skip_debug()
async def test_from_ubuntu_image(async_build):
    template = AsyncTemplate().from_ubuntu_image()
    await async_build(template)


@pytest.mark.skip_debug()
async def test_from_ubuntu_image_with_variant(async_build):
    template = AsyncTemplate().from_ubuntu_image("24.04")
    await async_build(template)


@pytest.mark.skip_debug()
async def test_from_python_image(async_build):
    template = AsyncTemplate().from_python_image()
    await async_build(template)


@pytest.mark.skip_debug()
async def test_from_python_image_with_variant(async_build):
    template = AsyncTemplate().from_python_image("3.12")
    await async_build(template)


@pytest.mark.skip_debug()
async def test_from_node_image(async_build):
    template = AsyncTemplate().from_node_image()
    await async_build(template)


@pytest.mark.skip_debug()
async def test_from_node_image_with_variant(async_build):
    template = AsyncTemplate().from_node_image("24")
    await async_build(template)


@pytest.mark.skip_debug()
async def test_from_image(async_build):
    template = AsyncTemplate().from_image("ubuntu:22.04")
    await async_build(template)


@pytest.mark.skip_debug()
async def test_from_template(async_build):
    template = AsyncTemplate().from_template("base")
    await async_build(template)


@pytest.mark.skip_debug()
async def test_from_dockerfile(async_build, setup_dockerfile_context):
    dockerfile = """FROM node:24
WORKDIR /app
COPY . .
RUN npm install"""

    template = AsyncTemplate(
        file_context_path=setup_dockerfile_context
    ).from_dockerfile(dockerfile)
    await async_build(template)


# Registry methods (commented out like in JS version)
# @pytest.mark.skip_debug()
# async def test_from_gcp_registry(async_build):
#     template = AsyncTemplate().from_gcp_registry(
#         "gcr.io/myproject/myimage:latest",
#         service_account_json="path/to/service-account.json"
#     )
#     await async_build(template)

# @pytest.mark.skip_debug()
# async def test_from_aws_registry(async_build):
#     template = AsyncTemplate().from_aws_registry(
#         "123456789.dkr.ecr.us-west-2.amazonaws.com/myimage:latest",
#         access_key_id="AKIA...",
#         secret_access_key="...",
#         region="us-west-2"
#     )
#     await async_build(template)

# @pytest.mark.skip_debug()
# async def test_from_image_with_credentials(async_build):
#     template = AsyncTemplate().from_image(
#         "myregistry.com/myimage:latest",
#         username="user",
#         password="pass"
#     )
#     await async_build(template)
