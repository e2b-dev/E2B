---
"e2b": minor
"@e2b/python-sdk": minor
---

Removed generated types for endpoints the SDKs never exposed. The JS `components['schemas']` namespace and the Python `e2b.api.client.models` package no longer include the admin, cluster/rig, node, team-API-key and access-token schemas (`Node`, `NodeDetail`, `NodeMetrics`, `NodeStatus`, `NodeStatusChange`, `MachineInfo`, `DiskMetrics`, `Rig*`, `Admin*`, `TeamAPIKey`, `NewTeamAPIKey`, `CreatedTeamAPIKey`, `UpdateTeamAPIKey`, `IdentifierMaskingDetails`, `VolumeToken`; Python additionally `Team`, `TeamMetric`, `MaxTeamMetric`, `CreatedAccessToken`, `NewAccessToken`). No SDK method ever accepted or returned them, so code that uses the SDK through its methods is unaffected; code that imported these type names directly must drop the import.
