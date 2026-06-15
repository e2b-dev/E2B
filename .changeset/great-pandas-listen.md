---
"e2b": patch
---

Template SDK fixes:

- Sort files by full path in `getAllFilesInPath` so the files hash no longer depends on filesystem traversal order (the previous `sort()` was a no-op on glob `Path` objects).
- Anchor the port match in `waitForPort` so e.g. port 80 no longer matches 8080.
- Shell-quote the URL, filename, and process name in `waitForURL`, `waitForFile`, and `waitForProcess`.
- Shell-quote paths in `remove`, `rename`, `makeDir`, and `makeSymlink` so paths with spaces or shell metacharacters work correctly.
- Keep fetching build logs after a terminal build status is returned so the tail of the logs (beyond the 100-entries-per-call API limit) is no longer dropped.
- Collect one stack trace per `COPY` instruction so failed-step stack traces stay aligned after `copy()` with multiple sources or `copyItems()`.
- Strip ANSI escape codes in `LogEntry` messages, matching the Python SDK.
