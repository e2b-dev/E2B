---
"@e2b/python-sdk": patch
---

Template SDK fixes:

- Match the exact listening port in `wait_for_port` (via `ss`'s `sport` filter) so e.g. port 80 no longer matches 8080.
- Shell-quote the URL, filename, and process name in `wait_for_url`, `wait_for_file`, and `wait_for_process`.
- Shell-quote paths in `remove`, `rename`, `make_dir`, and `make_symlink` so paths with spaces or shell metacharacters work correctly.
- Keep fetching build logs after a terminal build status is returned so the tail of the logs (beyond the 100-entries-per-call API limit) is no longer dropped.
- Collect one stack trace per `COPY` instruction so failed-step stack traces stay aligned after `copy()` with multiple sources or `copy_items()`.
