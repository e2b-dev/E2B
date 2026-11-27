---
'e2b': minor
'@e2b/python-sdk': minor
---

Add the `exposeLocalhostPorts` network option (Python: `expose_localhost_ports`). Set it to `false` on create to keep services that listen only on loopback (`127.0.0.1`, `localhost`, `::1`) unreachable through sandbox URLs; services listening on all interfaces stay reachable. When omitted, the project's default applies. `false` needs a template built with envd 0.12.0 or newer. Sandbox info reports the value.
