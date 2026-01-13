---
'e2b': minor
---

Add template versioning with tags support

- `Template.build()` now accepts names in `alias:tag` format (e.g., `"my-template:v1.0"`)
- New `Template.assignTag()` to assign tags to existing builds
- New `Template.deleteTag()` to remove tags
