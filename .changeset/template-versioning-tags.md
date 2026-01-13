---
'e2b': minor
'@e2b/python-sdk': minor
---

Add template versioning with tags support

- `Template.build()` now accepts names in `alias:tag` format (e.g., `"my-template:v1.0"`)
- New `Template.assignTag()` / `Template.assign_tag()` to assign tags to existing builds
- New `Template.deleteTag()` / `Template.delete_tag()` to remove tags
