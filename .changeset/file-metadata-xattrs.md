---
'e2b': minor
'@e2b/python-sdk': minor
---

feat(sdks): expose user-defined file metadata on `sandbox.files`

Adds a `metadata` option to file uploads (`write` / `writeFiles` / `write_files`) and surfaces persisted metadata on every `EntryInfo` / `WriteInfo` returned by `getInfo`, `list`, `rename`, and write responses. On upload, metadata is sent as `X-Metadata-<key>: <value>` request headers; envd persists the values as extended attributes in the `user.` xattr namespace and returns them on subsequent filesystem reads. Keys must be US-ASCII; the same metadata map is applied to every file in a multi-file upload. Requires envd 0.5.26 or later.
