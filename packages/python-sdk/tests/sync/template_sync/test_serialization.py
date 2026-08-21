"""Template payload serialization and copy-file hashing — pure client logic.

Mirrors `tests/template/serialization.test.ts` in the JS SDK: no build is
started, only the JSON the SDK would send and the hash it derives from the
local file context.
"""

import json
from pathlib import Path

import pytest

from e2b import Template
from e2b.template.types import InstructionType
from e2b.template.utils import calculate_files_hash


@pytest.fixture()
def context_path(tmp_path: Path) -> Path:
    (tmp_path / "app.txt").write_text("hello")
    (tmp_path / "other.txt").write_text("hello")
    return tmp_path


def _files_hash(context_path: Path, src: str, dest: str) -> str:
    return calculate_files_hash(src, dest, str(context_path), [], False, None)


def test_hash_is_stable_and_content_dependent(context_path: Path):
    before = _files_hash(context_path, "app.txt", "/app/")
    assert _files_hash(context_path, "app.txt", "/app/") == before

    (context_path / "app.txt").write_text("hello again")
    after = _files_hash(context_path, "app.txt", "/app/")

    assert after != before
    assert len(after) == 64
    assert set(after) <= set("0123456789abcdef")


def test_hash_covers_the_source_and_destination_paths(context_path: Path):
    # Identical content, different instruction — the hash seeds on `COPY src dest`.
    assert _files_hash(context_path, "app.txt", "/app/") != _files_hash(
        context_path, "other.txt", "/app/"
    )
    assert _files_hash(context_path, "app.txt", "/app/") != _files_hash(
        context_path, "app.txt", "/srv/"
    )


def test_hashing_a_source_that_matches_no_file_fails(context_path: Path):
    # TODO: should raise TemplateException once calculate_files_hash stops
    # raising a bare ValueError.
    with pytest.raises(ValueError):
        _files_hash(context_path, "nope.txt", "/app/")


def test_serializes_a_build_payload_from_the_builder(context_path: Path):
    template = (
        Template(file_context_path=context_path)
        .from_image("ubuntu:22.04")
        .run_cmd("echo hello")
        .set_workdir("/app")
        .set_start_cmd("python main.py", "curl -f http://localhost:8000")
    )

    payload = json.loads(Template.to_json(template))

    assert payload["fromImage"] == "ubuntu:22.04"
    assert payload["startCmd"] == "python main.py"
    assert payload["readyCmd"] == "curl -f http://localhost:8000"
    assert payload.get("fromTemplate") is None
    assert [step["type"] for step in payload["steps"]] == [
        InstructionType.RUN,
        InstructionType.WORKDIR,
    ]


def test_serializes_from_template_instead_of_from_image():
    payload = json.loads(Template.to_json(Template().from_template("base")))

    assert payload["fromTemplate"] == "base"
    assert payload.get("fromImage") is None


def test_serializes_a_registry_config_next_to_the_image():
    template = Template().from_image(
        "registry.example.com/app:latest",
        username="user",
        password="pass",
    )

    payload = json.loads(Template.to_json(template))

    assert payload["fromImage"] == "registry.example.com/app:latest"
    assert payload["fromImageRegistry"]["type"] == "registry"
    assert payload["fromImageRegistry"]["username"] == "user"


def test_copy_step_carries_the_files_hash(context_path: Path):
    template = (
        Template(file_context_path=context_path)
        .from_image("ubuntu:22.04")
        .copy("app.txt", "/app/")
    )

    payload = json.loads(Template.to_json(template))
    copy_step = next(
        step for step in payload["steps"] if step["type"] == InstructionType.COPY
    )

    assert copy_step["filesHash"] == _files_hash(context_path, "app.txt", "/app/")
