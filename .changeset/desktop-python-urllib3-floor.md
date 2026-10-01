---
"@e2b/desktop-python": patch
---

Require `urllib3>=2.8.0` so installs pick up the fixes for CVE-2026-97687 (HTTPS proxy TLS configuration ignored) and CVE-2026-97689 (unbounded chunk-size line buffering).
