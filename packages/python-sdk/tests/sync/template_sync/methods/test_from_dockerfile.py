import pytest

from e2b import Template
from e2b.template.types import InstructionType


@pytest.mark.skip_debug()
def test_from_dockerfile():
    dockerfile = """FROM node:24
WORKDIR /app
COPY package.json .
RUN npm install
ENTRYPOINT ["sleep", "20"]"""

    template = Template().from_dockerfile(dockerfile)

    # base image
    assert template._template._base_image == "node:24"

    instructions = template._template._instructions

    # Docker defaults
    assert instructions[1]["type"] == InstructionType.WORKDIR
    assert instructions[1]["args"][0] == "/"

    # Instructions from Dockerfile
    assert instructions[2]["type"] == InstructionType.WORKDIR
    assert instructions[2]["args"][0] == "/app"

    assert instructions[3]["type"] == InstructionType.COPY
    assert instructions[3]["args"][0] == "package.json"
    assert instructions[3]["args"][1] == "."

    assert instructions[4]["type"] == InstructionType.RUN
    assert instructions[4]["args"][0] == "npm install"

    # E2B defaults appended
    assert instructions[5]["type"] == InstructionType.USER
    assert instructions[5]["args"][0] == "user"

    # Start command
    assert template._template._start_cmd == "sleep 20"


@pytest.mark.skip_debug()
def test_from_dockerfile_with_default_user_and_workdir():
    dockerfile = "FROM node:24"

    template = Template().from_dockerfile(dockerfile)

    assert template._template._instructions[-2]["type"] == InstructionType.USER
    assert template._template._instructions[-2]["args"][0] == "user"
    assert template._template._instructions[-1]["type"] == InstructionType.WORKDIR
    assert template._template._instructions[-1]["args"][0] == "/home/user"


@pytest.mark.skip_debug()
def test_from_dockerfile_with_custom_user_and_workdir():
    dockerfile = "FROM node:24\nUSER mish\nWORKDIR /home/mish"

    template = Template().from_dockerfile(dockerfile)

    assert template._template._instructions[-2]["type"] == InstructionType.USER
    assert template._template._instructions[-2]["args"][0] == "mish"
    assert template._template._instructions[-1]["type"] == InstructionType.WORKDIR
    assert template._template._instructions[-1]["args"][0] == "/home/mish"


@pytest.mark.skip_debug()
def test_from_dockerfile_with_multi_source_copy():
    dockerfile = """FROM node:24
COPY file1.txt file2.txt file3.txt /dest/"""

    template = Template().from_dockerfile(dockerfile)

    instructions = template._template._instructions

    copy_instructions = [i for i in instructions if i["type"] == InstructionType.COPY]

    assert len(copy_instructions) == 3
    assert copy_instructions[0]["args"][0] == "file1.txt"
    assert copy_instructions[0]["args"][1] == "/dest/"
    assert copy_instructions[1]["args"][0] == "file2.txt"
    assert copy_instructions[1]["args"][1] == "/dest/"
    assert copy_instructions[2]["args"][0] == "file3.txt"
    assert copy_instructions[2]["args"][1] == "/dest/"


@pytest.mark.skip_debug()
def test_from_dockerfile_with_multi_source_copy_chown():
    dockerfile = """FROM node:24
COPY --chown=myuser:mygroup pkg.json pkg-lock.json /app/"""

    template = Template().from_dockerfile(dockerfile)

    instructions = template._template._instructions

    copy_instructions = [i for i in instructions if i["type"] == InstructionType.COPY]

    assert len(copy_instructions) == 2
    assert copy_instructions[0]["args"][0] == "pkg.json"
    assert copy_instructions[0]["args"][1] == "/app/"
    assert copy_instructions[0]["args"][2] == "myuser:mygroup"
    assert copy_instructions[1]["args"][0] == "pkg-lock.json"
    assert copy_instructions[1]["args"][1] == "/app/"
    assert copy_instructions[1]["args"][2] == "myuser:mygroup"


@pytest.mark.skip_debug()
def test_from_dockerfile_with_copy_chown():
    dockerfile = """FROM node:24
COPY --chown=myuser:mygroup app.js /app/
COPY --chown=anotheruser config.json /config/"""

    template = Template().from_dockerfile(dockerfile)

    instructions = template._template._instructions

    # First COPY instruction (after initial USER root and WORKDIR /)
    copy_instruction1 = instructions[2]
    assert copy_instruction1["type"] == InstructionType.COPY
    assert copy_instruction1["args"][0] == "app.js"
    assert copy_instruction1["args"][1] == "/app/"
    assert copy_instruction1["args"][2] == "myuser:mygroup"  # user from --chown

    # Second COPY instruction
    copy_instruction2 = instructions[3]
    assert copy_instruction2["type"] == InstructionType.COPY
    assert copy_instruction2["args"][0] == "config.json"
    assert copy_instruction2["args"][1] == "/config/"
    assert (
        copy_instruction2["args"][2] == "anotheruser"
    )  # user from --chown (without group)


@pytest.mark.skip_debug()
def test_from_dockerfile_with_arg_in_from():
    dockerfile = """ARG BASE_IMAGE=ghcr.io/example/base:latest
FROM ${BASE_IMAGE}
WORKDIR /app"""

    template = Template().from_dockerfile(dockerfile)

    assert template._template._base_image == "ghcr.io/example/base:latest"


@pytest.mark.skip_debug()
def test_from_dockerfile_with_unbraced_arg_in_from():
    dockerfile = """ARG IMG=python:3.13-slim
FROM $IMG"""

    template = Template().from_dockerfile(dockerfile)

    assert template._template._base_image == "python:3.13-slim"


@pytest.mark.skip_debug()
def test_from_dockerfile_with_arg_default_fallback_in_from():
    dockerfile = """ARG IMG
FROM ${IMG:-ubuntu:24.04}"""

    template = Template().from_dockerfile(dockerfile)

    assert template._template._base_image == "ubuntu:24.04"


@pytest.mark.skip_debug()
def test_from_dockerfile_with_valueless_arg_in_from_raises():
    dockerfile = """ARG IMG
FROM ${IMG}"""

    with pytest.raises(ValueError, match="has no value"):
        Template().from_dockerfile(dockerfile)


@pytest.mark.skip_debug()
def test_from_dockerfile_with_uppercase_as_alias():
    dockerfile = "FROM node:18 AS builder"

    template = Template().from_dockerfile(dockerfile)

    assert template._template._base_image == "node:18"


@pytest.mark.skip_debug()
def test_from_dockerfile_with_arg_in_from_and_alias():
    dockerfile = """ARG BASE=node:18
FROM ${BASE} AS builder"""

    template = Template().from_dockerfile(dockerfile)

    assert template._template._base_image == "node:18"


@pytest.mark.skip_debug()
def test_from_dockerfile_with_chained_arg_defaults_in_from():
    dockerfile = """ARG REGISTRY=ghcr.io
ARG IMAGE=${REGISTRY}/org/base:latest
FROM ${IMAGE}"""

    template = Template().from_dockerfile(dockerfile)

    assert template._template._base_image == "ghcr.io/org/base:latest"
