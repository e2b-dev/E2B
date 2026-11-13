---
name: new-package
description: 'Use when adding a new publishable package under packages/ in this monorepo. Scaffolds it from the ID packages, wires it into the test, artifact and release workflows, publishes a 0.0.0 placeholder to npm or PyPI, and prompts the author to register the GitHub Actions OIDC trusted publisher so the first real release can publish from CI without a token.'
---

# New package

Every package here is published by `changeset publish` from `publish_packages.yml`
over GitHub OIDC trusted publishing: npm packages directly, PyPI packages through
the package's `postPublish` script (`uv publish --trusted-publishing always`). No
registry token exists in CI, so a package whose trusted publisher is not registered
fails at its first release, after the version bump has already been committed and
tagged on `main`.

A trusted publisher can only be attached to a package that already exists on the
registry, so the package name is claimed up front with a `0.0.0` placeholder. The
repo then versions the package from `0.0.0` with an "Initial release" changeset, and
the first CI release mints `0.1.0` with no manual step. `@e2b/id` and `e2b-id` are
the reference: both registries hold a `0.0.0` placeholder with the trusted publisher
attached.

Do the steps in order. Step 4 publishes to a public registry and step 5 needs the
author in a browser, so neither can be undone or finished by the agent alone.

## 1. Pick the names

| Registry | Package name  | Workspace name (`package.json`) | Directory                |
| -------- | ------------- | ------------------------------- | ------------------------ |
| npm      | `@e2b/<name>` | `@e2b/<name>`                   | `packages/js-<name>`     |
| PyPI     | `e2b-<name>`  | `@e2b/python-<name>` (private)  | `packages/python-<name>` |

The Python workspace entry is a `"private": true` `package.json` whose only job is to
let changesets version and tag the package; `publish_selected.cjs` runs its
`postPublish` script for the upload, and `changeset publish` skips it on npm. The
Python import name is `e2b_<name>`.

Check both names are free before anything else; a taken name means a different name,
not a different owner:

```sh
npm view @e2b/<name> version          # must fail with E404
curl -sI https://pypi.org/pypi/e2b-<name>/json | head -1   # must be 404
```

## 2. Scaffold from the ID packages

Copy the nearest sibling rather than writing from scratch. `packages/js-id` and
`packages/python-id` are the smallest complete examples; a package that talks to the
API should copy `packages/js-sdk` / `packages/python-sdk` conventions instead.

JS (`packages/js-<name>`): `package.json` with `"version": "0.0.0"`,
`publishConfig.access: public`, `repository.directory`, `files`, `exports`, the
`build` / `test` / `typecheck` / `lint` / `format` scripts and `prepublishOnly: pnpm
build`; `tsconfig.json`, `tsdown.config.ts`, `vitest.config.mts`, `LICENSE`,
`README.md`, `.gitignore`. Use `catalog:` versions from `pnpm-workspace.yaml`.

Python (`packages/python-<name>`): `pyproject.toml` with `version = "0.0.0"`, the
`uv_build` backend and `[tool.uv.build-backend] module-name`; `package.json` with
`"private": true`, `"version": "0.0.0"` and the `postVersion` / `lock` /
`postPublish` / `test` / `typecheck` / `lint` / `format` scripts exactly as in
`packages/python-id/package.json`; `Makefile`, `pytest.ini`, `LICENSE`, `README.md`,
and `uv lock` to produce `uv.lock`. Add any new cache directory to the root
`.gitignore` (python-id added `.ruff_cache/`).

Then `pnpm install` so `pnpm-lock.yaml` picks the workspace up, and add the
changeset that turns the placeholder into the first real version:

```md
---
'@e2b/<name>': minor
---

Initial release: <one line on what the package is>.
```

A `minor` bump from `0.0.0` releases `0.1.0`. Never use `major`.

## 3. Wire it into CI and the release

Each file below names every package explicitly. Grep for `js-id` / `python-id` /
`@e2b/id` / `@e2b/python-id` and add the new package next to each hit:

- `.github/workflows/<name>_tests.yml`: a `workflow_call` test workflow, modelled on
  `id_tests.yml` (no secrets) or `js_sdk_tests.yml` / `python_sdk_tests.yml`
  (needs `E2B_API_KEY`).
- `.github/workflows/sdk_tests.yml`: a path filter under `changes` and a job that
  `uses:` the new test workflow.
- `.github/workflows/release.yml`: a "Check … Release" step with its output in
  `preflight`, a test job gated on that output, and the job added to both
  `publish.needs` and `report-failure.needs`. A package missing from `publish.needs`
  publishes untested; one missing from `report-failure.needs` fails silently.
- `.github/scripts/build_release_itinerary.cjs`: a label, so the Slack release
  message names the package.
- `.github/workflows/pkg_artifacts.yml`: a pack/build step, an upload step, and a
  line in the PR comment body, so reviewers get a preview artifact.
- `.github/workflows/lint.yml` and `typecheck.yml` (Python only): a
  `uv sync --locked` step for the new directory.

Run `pnpm run format`, `pnpm run lint`, `pnpm run typecheck` and `pnpm run test`
before moving on.

## 4. Publish the 0.0.0 placeholder

Publish from a temp directory, never from the repo: the real `0.0.0` must stay
unpublished so the first CI release is the first real artifact. The placeholder
carries no code, and its description says so.

npm. The account must belong to the `e2b` npm org with publish rights; `npm whoami`
shows it. `npm publish` prompts for the 2FA code when the account requires one.

```sh
dir=$(mktemp -d) && cd "$dir"
cat > package.json <<'EOF'
{
  "name": "@e2b/<name>",
  "version": "0.0.0",
  "description": "Placeholder for <description>. The first real release follows shortly.",
  "license": "Apache-2.0",
  "repository": {
    "type": "git",
    "url": "https://github.com/e2b-dev/e2b",
    "directory": "packages/js-<name>"
  },
  "publishConfig": { "access": "public" }
}
EOF
printf '# @e2b/<name>\n\nPlaceholder. The first real release follows shortly.\n' > README.md
npm whoami
npm publish --access public
npm view @e2b/<name> version   # 0.0.0
```

PyPI. A project that does not exist yet cannot have a project-scoped token, so this
needs an account-scoped API token from the account that owns the other `e2b-*`
projects. Read it into `UV_PUBLISH_TOKEN` from a password manager; never paste it
on the command line or echo it. The placeholder is a wheel only, like `e2b-id`.

```sh
dir=$(mktemp -d) && cd "$dir"
mkdir e2b_<name>
printf '"""Placeholder for <description>. The first real release follows shortly."""\n' > e2b_<name>/__init__.py
cat > pyproject.toml <<'EOF'
[project]
name = "e2b-<name>"
version = "0.0.0"
description = "Placeholder for <description>. The first real release follows shortly."
authors = [{ name = "e2b", email = "hello@e2b.dev" }]
license = "Apache-2.0"
requires-python = ">=3.10"
dependencies = []

[build-system]
requires = ["uv_build>=0.10.0,<0.11.0"]
build-backend = "uv_build"

[tool.uv.build-backend]
module-name = ["e2b_<name>"]
module-root = ""
EOF
uv build --wheel
# The author exports UV_PUBLISH_TOKEN in their own shell beforehand.
uv publish dist/*.whl
curl -s https://pypi.org/pypi/e2b-<name>/json | python3 -c 'import json,sys; print(json.load(sys.stdin)["info"]["version"])'   # 0.0.0
```

If the author would rather not hold an account-scoped PyPI token, PyPI also accepts
a "pending publisher" registered before the project exists, and the first CI release
then creates the project. npm has no equivalent, so the npm placeholder is always
needed.

## 5. Prompt the author to register the trusted publisher

Registry settings are not visible from any CLI, so stop here and hand the author the
exact values. Do not open the PR as ready, and do not merge, until they confirm both
are registered. The two registries check different OIDC claims, so the workflow
filename differs:

- npm checks the **calling** workflow. `npm publish` runs inside
  `publish_packages.yml`, which `release.yml` calls, and npm's docs say validation
  "checks the calling workflow's name instead of the workflow that actually contains
  the publish command". The provenance on every published `e2b` version names
  `.github/workflows/release.yml`.
- PyPI checks `job_workflow_ref`, which names the **called** workflow, so it wants
  `publish_packages.yml` (this is how `e2b`, `e2b-code-interpreter` and
  `e2b-desktop` are registered, see PR #1828).

Tell the author:

> `@e2b/<name>@0.0.0` and `e2b-<name>` `0.0.0` are on the registries. Before the
> first release, register a GitHub Actions trusted publisher on each:
>
> npm: npmjs.com → `@e2b/<name>` → Settings → Publishing access → Trusted publisher
> → GitHub Actions
>
> | Field                | Value         |
> | -------------------- | ------------- |
> | Organization or user | `e2b-dev`     |
> | Repository           | `E2B`         |
> | Workflow filename    | `release.yml` |
> | Environment name     | leave empty   |
>
> PyPI: pypi.org → `e2b-<name>` → Manage → Publishing → GitHub
>
> | Field            | Value                  |
> | ---------------- | ---------------------- |
> | Owner            | `e2b-dev`              |
> | Repository name  | `E2B`                  |
> | Workflow name    | `publish_packages.yml` |
> | Environment name | leave empty            |
>
> Leave the environment empty to match the existing packages. The publish job does
> run in the `deployment` environment, so entering `deployment` also works and is
> stricter; only do that if the other packages have been tightened the same way.

Neither registry validates these values when saved; a typo surfaces as a 404 or 403
at the first release. Case matters: the repository is `E2B`, the filenames include
`.yml`.

## 6. Open the PR

Base the branch on `main`. The PR description gets a "Required registry
configuration (before merging)" section with the two tables above and a checkbox
per registry, the way PR #1828 and PR #1850 did, so the state of the manual steps is
visible on the PR and not only in chat. Link the Linear issue.

After the first release, confirm it on both registries:

```sh
npm view @e2b/<name> versions
curl -s https://pypi.org/pypi/e2b-<name>/json | python3 -c 'import json,sys; print(sorted(json.load(sys.stdin)["releases"]))'
```

`0.0.0` stays listed next to `0.1.0`; that is expected and matches `@e2b/id`.
