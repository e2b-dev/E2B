# Changesets

To add changeset run:

```bash
pnpm changeset
```

in the root of the project. This will create a new changeset in the `.changeset` folder.

## Release groups

Packages are released in four independent groups, each with its own
`workflow_dispatch` pipeline that versions and publishes only the packages of
that group:

| Group              | Packages                                                | Workflow                                         |
| ------------------ | ------------------------------------------------------- | ------------------------------------------------ |
| `e2b`              | `e2b`, `@e2b/python-sdk`                                | `.github/workflows/release_e2b.yml`              |
| `cli`              | `@e2b/cli`                                              | `.github/workflows/release_cli.yml`              |
| `code-interpreter` | `@e2b/code-interpreter`, `@e2b/code-interpreter-python` | `.github/workflows/release_code_interpreter.yml` |
| `desktop`          | `@e2b/desktop`, `@e2b/desktop-python`                   | `.github/workflows/release_desktop.yml`          |

A changeset must only name packages from a single group; add one changeset per
group when a change spans several. `pnpm run release check` verifies this and
runs on every pull request that touches `.changeset/`.
