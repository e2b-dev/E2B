# E2B Web App

This repository contains E2B Dashboard, documentation, and SDK references.

## SDK References

The SDK references are generated from the source code in the [packages](../../packages) folder.
Each package has its own SDK reference generator found in `{package-dir}/scripts/generate_sdk_ref.sh`, it generates markdown files with the following schema: `./src/app/(docs)/docs/sdk-reference/{package-name}/{version}/{module-name}/page.mdx`.

When pushed to `main`, a [github workflow](../../.github/workflows/generate_sdk_ref.yml) checks for diffs in the [packages](../../packages) folder, and if any are found, the SDK reference generator is run and the result is auto-commited the incoming branch.

Finally, when building or running the dev server, a [prebuild](./prebuild.js) step is run beforehand to generate the SDK reference TOCs and routes in the [sdk-reference](<./src/app/(docs)/docs/sdk-reference>) directory. This can also be run manually using `npm run prebuild`.

note: sometimes you may see uncommited changes or untracked files in the [sdk-reference](<./src/app/(docs)/docs/sdk-reference>) directory, this is fine and the files can be ignored.
