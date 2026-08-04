# Changesets

To add changeset run:

```bash
npx changeset
```

in the root of the project. This will create a new changeset in the `.changeset` folder.

Dependabot pull requests get one automatically: `.github/workflows/dependabot_changeset.yml`
commits a `patch` changeset for every released package whose direct production dependencies the
bump touches. Dev-only and transitive-only bumps are left alone, and the workflow never overwrites
a changeset that is already on the branch — so edit or replace the generated file whenever the bump
deserves a better description or a larger version step.
