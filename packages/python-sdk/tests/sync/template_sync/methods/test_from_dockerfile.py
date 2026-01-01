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
