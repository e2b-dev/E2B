---
'e2b': minor
'@e2b/python-sdk': minor
'@e2b/desktop': patch
'@e2b/desktop-python': patch
---

Add `getGrpcTarget` / `get_grpc_target` so gRPC clients can dial sandbox servers over the public HTTPS host. Desktop packages depend on core 2.50.0 so existing Desktop installs pick up the helper on upgrade.
