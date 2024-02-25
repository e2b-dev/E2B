# Firecracker Versions

Scripts in this directory are used to build Firecracker and several other binaries used for starting sandboxes on our infrastructure.

It builds the following binaries:

- Firecracker for each specified version
- UFFD for each specified version

## How to add a new version

Versions are defined in the `firecracker_versions.txt` file. Each version is on a separate line and can be a tag or a commit hash.

To add a new version, simply add a new line to the file with the desired version.

The string under which the versions are stored and used in buckets and in the database is the `<last_tag-prelease>-<first-8-letters-of-the-specific-commit>`. If you want to make this version the default one you need to change the `DefaultFirecrackerVersion` in the [packages/pkg/shared/schema/env.go](../shared/pkg/schema/env.go) file to this string.
