---
"e2b": patch
"@e2b/python-sdk": patch
---

Fix a per-call `domain` being ignored by sandbox instance methods (`pause`, `kill`, `setTimeout`/`set_timeout`, `getInfo`/`get_info`, `connect`, ...): the API URL derived from the sandbox's own domain is no longer carried over, so the request goes to `https://api.<per-call domain>`. An explicitly set `apiUrl`/`api_url` or `E2B_API_URL` still takes precedence.
