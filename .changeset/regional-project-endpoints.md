---
'e2b': minor
'@e2b/python-sdk': minor
---

Add multi-region project configuration. A project ID and region can be set through the `E2B_PROJECT_ID` and `E2B_REGION` environment variables, or as `projectId` / `region` (`project_id` / `region` in Python) connection options on the `E2B` client and on every per-call option bag. When both are set, requests go to the project's regional endpoint `<project_id>.prj.<region>.<domain>` (so the API is reached at `https://api.<project_id>.prj.<region>.<domain>`); with only one of them set the plain `domain` is used as before. `ConnectionConfig.domain` keeps the configured base domain and the new `resolvedDomain` (`resolved_domain`) exposes the endpoint requests are actually sent to. Sandbox and volume domains returned by the API still take precedence over the configured endpoint.
