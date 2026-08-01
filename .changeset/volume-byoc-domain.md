---
'e2b': minor
'@e2b/python-sdk': minor
---

Route volume content requests to a team's custom (BYOC) cluster. When a team is connected to a custom cluster, the volume create and get endpoints now return that cluster's `domain`, and the SDK uses it as the destination for volume content requests instead of the default `api.<E2B_DOMAIN>` host. Teams on the default cluster are unaffected and keep their configured domain.
