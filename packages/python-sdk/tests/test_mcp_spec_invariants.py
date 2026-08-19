"""Structural invariants for the committed MCP server schema.

``spec/mcp-server.json`` is imported wholesale from the MCP gateway catalog and
both SDKs generate their public ``McpServer`` type from it. CI's
``generated_files.yml`` only checks that the *types* match the *spec*; nothing
checks that the spec itself describes a configuration a caller can actually
supply. These tests cover that gap.
"""

import json
import re
from pathlib import Path

import pytest

from e2b.sandbox.mcp import McpServer

SPEC_PATH = Path(__file__).parents[3] / "spec" / "mcp-server.json"
JS_TYPES_PATH = (
    Path(__file__).parents[3] / "packages" / "js-sdk" / "src" / "sandbox" / "mcp.d.ts"
)

pytestmark = pytest.mark.skipif(
    not SPEC_PATH.is_file(), reason="repository spec/ directory is not available"
)

SERVER_KEY = re.compile(r"^[a-z][A-Za-z0-9]*$")


def _servers() -> dict:
    return json.loads(SPEC_PATH.read_text())["properties"]


def test_required_keys_are_declared_properties():
    """A ``required`` entry that is not a declared property cannot be satisfied.

    Every server sets ``additionalProperties: false``, so a required key that is
    missing from ``properties`` describes an object no caller can construct. Both
    code generators drop such a key silently, which turns an upstream catalog
    error into a type that quietly omits a mandatory field.
    """
    unsatisfiable = {
        name: sorted(set(entry.get("required", [])) - set(entry.get("properties", {})))
        for name, entry in _servers().items()
        if set(entry.get("required", [])) - set(entry.get("properties", {}))
    }
    assert unsatisfiable == {}


def test_servers_are_closed_objects():
    for name, entry in _servers().items():
        assert entry.get("type") == "object", name
        assert entry.get("additionalProperties") is False, name


def test_server_keys_are_camel_case():
    """Server keys become SDK option keys, so they must survive name mangling."""
    assert [name for name in _servers() if not SERVER_KEY.match(name)] == []


def test_python_type_exposes_exactly_the_spec_servers():
    assert set(McpServer.__annotations__) == set(_servers())


def test_js_type_exposes_exactly_the_spec_servers():
    body = JS_TYPES_PATH.read_text().split("export interface McpServer {", 1)[1]
    body = body.split("\n}", 1)[0]
    declared = set(re.findall(r"^\s*(\w+)\?:", body, re.MULTILINE))
    assert declared == set(_servers())
