---
'e2b': minor
'@e2b/python-sdk': minor
---

Add template versioning with tags support

- `Template.build()` now accepts names in `name:tag` format (e.g., `"my-template:v1.0"`)
- New `Template.assignTags()` / `Template.assign_tags()` to assign tags to existing builds
- New `Template.removeTags()` / `Template.remove_tags()` to remove tags
