---
'e2b': minor
'@e2b/python-sdk': minor
---

Add `FileType.SYMLINK` to the sandbox filesystem types. Newer envd versions report symlinks with a dedicated `FILE_TYPE_SYMLINK` entry type; previously the SDKs treated it as unknown, so `files.list()` silently omitted symlink entries and `getInfo()`/`get_info()` returned an `undefined`/`None` type for them. Symlinks now surface as `FileType.SYMLINK` (`'symlink'`) with `symlinkTarget`/`symlink_target` populated, in JS and both sync and async Python.
