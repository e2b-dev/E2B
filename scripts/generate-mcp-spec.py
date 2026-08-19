#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.10"
# dependencies = ["pyyaml"]
# ///

"""Regenerates spec/mcp-server.json from Docker's MCP catalog.

Usage: uv run scripts/generate-mcp-spec.py [--catalog <path-or-url>]

The MCP servers the sandbox gateway can run come from Docker's MCP catalog,
which publishes each server's secrets and parameters. This script turns that
catalog into the JSON Schema the SDKs generate their `McpServer` types from,
so the schema stays a mechanical projection of the catalog and is never
edited by hand.

Property names follow the catalog entry they come from: secrets are named
after their environment variable (minus a redundant server-name prefix, which
is how the catalog spells server-scoped variables such as `ATLAN_API_KEY`),
parameters after their config key, with nested parameter objects flattened
into one camelCase name. A server is required to have all of its secrets set
unless its parameters declare their own `required` list.

`pnpm generate:mcp-spec` runs this and then refreshes the generated SDK types.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import urllib.request
from pathlib import Path
from typing import Any

import yaml

CATALOG_URL = "https://desktop.docker.com/mcp/catalog/v2/catalog.yaml"
SPEC_PATH = Path(__file__).resolve().parent.parent / "spec" / "mcp-server.json"

# Suffixes and prefixes that only say "this is an MCP server", dropped so that
# e.g. `airtable-mcp-server` is configured as `airtable`.
NAME_SUFFIXES = ("-mcp-server", "-mcp")
NAME_PREFIX = "mcp-"


def _capitalize(word: str) -> str:
    return word[:1].upper() + word[1:]


def _camel(words: list[str]) -> str:
    return words[0] + "".join(_capitalize(w) for w in words[1:])


def option_name(name: str) -> str:
    """`aws-cdk-mcp-server` -> `awsCdk`."""
    for suffix in NAME_SUFFIXES:
        if name.endswith(suffix):
            name = name[: -len(suffix)]
    if name.startswith(NAME_PREFIX):
        name = name[len(NAME_PREFIX) :]
    return _camel([w.lower() for w in re.split(r"[-_ ]+", name) if w])


def env_property(env: str, server: str) -> str:
    """`ATLAN_API_KEY` on server `atlan` -> `apiKey`."""
    prefix = f"{server.upper()}_"
    if env.startswith(prefix):
        env = env[len(prefix) :]
    return _camel([w.lower() for w in env.split("_") if w])


def parameter_property(path: list[str]) -> str:
    """`['confluence', 'api_token']` -> `confluenceApiToken`."""
    segments = []
    for segment in path:
        words = [w for w in re.split(r"[-_]+", segment) if w]
        # Keys that aren't snake_case are already spelled the way the catalog
        # wants them (`SchemaPath`, `nodeenv`), so leave their casing alone.
        segments.append(segment if len(words) < 2 else _camel([w.lower() for w in words]))
    return _camel(segments)


def _property_schema(schema: dict[str, Any]) -> dict[str, Any]:
    out: dict[str, Any] = {}
    if schema.get("description"):
        out["description"] = schema["description"]
    if schema.get("items"):
        out["items"] = _property_schema(schema["items"])
    out["type"] = schema.get("type", "string")
    return out


def _parameters(
    schema: dict[str, Any], path: list[str], required_parent: bool
) -> tuple[list[tuple[str, dict[str, Any], bool]], bool]:
    """Flattens a parameters object into (property name, schema, required) triples.

    Also reports whether the object (or any object nested in it) says which of
    its properties are required.
    """
    declared = schema.get("required")
    out = []
    declares = declared is not None
    for prop, sub in (schema.get("properties") or {}).items():
        required = required_parent and (prop in declared if declared is not None else True)
        if sub.get("type") == "object" and sub.get("properties"):
            nested, nested_declares = _parameters(sub, path + [prop], required)
            out += nested
            declares = declares or nested_declares
        else:
            out.append((parameter_property(path + [prop]), _property_schema(sub), required))
    return out, declares


def _env_vars(entry: dict[str, Any]) -> list[str]:
    """The environment variables a server reads its credentials from."""
    return [declared.get("env", "") for declared in entry.get("secrets") or []]


def server_schema(name: str, entry: dict[str, Any]) -> dict[str, Any]:
    properties: dict[str, Any] = {}
    required: list[str] = []

    for env in _env_vars(entry):
        prop = env_property(env, name)
        properties[prop] = {"type": "string"}
        required.append(prop)

    declares_required = False
    for config in entry.get("config") or []:
        parameters, declares = _parameters(config, [], True)
        declares_required = declares_required or declares
        for prop, schema, _ in parameters:
            properties[prop] = schema
        needed = [prop for prop, _, is_required in parameters if is_required]
        # Parameters that say what they need describe the whole server, so they
        # replace the secrets, which the server only needs for the features the
        # caller opts into.
        required = needed if declares else required + needed
    if not declares_required:
        required.sort()

    schema: dict[str, Any] = {}
    if entry.get("title"):
        schema["title"] = entry["title"]
    if entry.get("description"):
        schema["description"] = entry["description"]
    if required:
        schema["required"] = required
    schema["additionalProperties"] = False
    if properties:
        schema["properties"] = {prop: properties[prop] for prop in sorted(properties)}
    schema["type"] = "object"
    schema["x-dockerHubUrl"] = f"https://hub.docker.com/mcp/server/{name}/overview"
    return schema


def generate(catalog: dict[str, Any]) -> dict[str, Any]:
    # A few servers share a name once the "mcp server" wording is dropped, e.g.
    # `apify` and `apify-mcp-server`. Going through the names in order keeps the
    # more specifically named entry, which is the one the catalog maintains.
    servers = {option_name(name): server_schema(name, catalog[name]) for name in sorted(catalog)}
    return {
        "additionalProperties": False,
        "properties": {prop: servers[prop] for prop in sorted(servers)},
        "type": "object",
    }


def read_catalog(source: str) -> dict[str, Any]:
    if source.startswith(("http://", "https://")):
        with urllib.request.urlopen(source, timeout=60) as response:
            raw = response.read()
    else:
        raw = Path(source).read_bytes()
    catalog = yaml.safe_load(raw)
    registry = catalog.get("registry") if isinstance(catalog, dict) else None
    if not registry:
        sys.exit(f"error: no MCP servers found in {source}")
    return registry


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--catalog", default=CATALOG_URL, help="catalog URL or local file")
    args = parser.parse_args()

    registry = read_catalog(args.catalog)
    spec = json.dumps(generate(registry), indent=2, ensure_ascii=False)
    # Match the escaping of the Go encoder the catalog is published with, so
    # that re-running the generator doesn't rewrite unrelated descriptions.
    for char, escape in (("&", "\\u0026"), ("<", "\\u003c"), (">", "\\u003e")):
        spec = spec.replace(char, escape)
    SPEC_PATH.write_text(spec, encoding="utf-8")
    print(f"Wrote {len(registry)} MCP servers to {SPEC_PATH}")


if __name__ == "__main__":
    main()
