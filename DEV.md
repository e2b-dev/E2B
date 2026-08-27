# Releasing e2b cli

to create a changeset run `pnpm run changeset`

# Python packages

`packages/python-sdk`, `packages/code-interpreter-python` and `packages/desktop-python` form a
[uv workspace](https://docs.astral.sh/uv/concepts/projects/workspaces/) rooted at the repository
root, sharing a single `uv.lock` and `.venv`:

```sh
uv sync --all-packages
uv run --all-packages pytest   # from a package directory
```

Build artifacts go to the workspace root's `dist/` unless a package-local one is requested, so the
release and artifact tooling builds with `uv build --out-dir dist` from the package directory.

Their `package.json`s are pnpm-workspace stubs that exist only so changesets versions and releases
them alongside the JavaScript packages; the scripts they expose delegate to uv.
