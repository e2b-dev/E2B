---
"@e2b/python-sdk": patch
---

Fix `write()` / `write_files()` returning `WriteInfo.type` as a raw string instead of the `FileType` enum. Make `EntryInfo.modified_time` timezone-aware (UTC) and normalize naive volume `atime`/`mtime`/`ctime` timestamps to UTC. Make the `gzip=True` upload option imply the `application/octet-stream` upload path so it is no longer silently ignored on the default `multipart/form-data` path.
