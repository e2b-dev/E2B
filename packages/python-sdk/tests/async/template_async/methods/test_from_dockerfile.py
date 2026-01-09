import pytest

from e2b import AsyncTemplate
from e2b.template.types import InstructionType


@pytest.mark.skip_debug()
async def test_from_dockerfile():
    dockerfile = """FROM node:24
WORKDIR /app
COPY package.json .
RUN npm install
ENTRYPOINT ["sleep", "20"]"""

    template = AsyncTemplate().from_dockerfile(dockerfile)

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
async def test_from_dockerfile_with_default_user_and_workdir():
    dockerfile = "FROM node:24"

    template = AsyncTemplate().from_dockerfile(dockerfile)

    assert template._template._instructions[-2]["type"] == InstructionType.USER
    assert template._template._instructions[-2]["args"][0] == "user"
    assert template._template._instructions[-1]["type"] == InstructionType.WORKDIR
    assert template._template._instructions[-1]["args"][0] == "/home/user"


@pytest.mark.skip_debug()
async def test_from_dockerfile_with_custom_user_and_workdir():
    dockerfile = "FROM node:24\nUSER mish\nWORKDIR /home/mish"

    template = AsyncTemplate().from_dockerfile(dockerfile)

    assert template._template._instructions[-2]["type"] == InstructionType.USER
    assert template._template._instructions[-2]["args"][0] == "mish"
    assert template._template._instructions[-1]["type"] == InstructionType.WORKDIR
    assert template._template._instructions[-1]["args"][0] == "/home/mish"


@pytest.mark.skip_debug()
async def test_from_dockerfile_with_copy_chown():
    dockerfile = """FROM node:24
COPY --chown=myuser:mygroup app.js /app/
COPY --chown=anotheruser config.json /config/"""

    template = AsyncTemplate().from_dockerfile(dockerfile)

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
    assert copy_instruction2["args"][2] == "anotheruser"  # user from --chown (without group)
