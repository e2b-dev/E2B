---
"e2b": patch
---

Retry a `502` response only for operations that are safe to replay: a gateway may answer `502` after the API already processed the request, so a `502` from sandbox creation, fork, snapshot or another resource-creating `POST` is returned instead of being retried (which could create a duplicate). `503` is still retried for every operation. Secret updates (`POST /secrets/{id}`) are no longer replayed after a `502` or a dropped connection, as each update appends a new version.
