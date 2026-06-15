---
"@e2b/python-sdk": minor
"e2b": minor
---

Add an `allowNetworkMounts`/`allow_network_mounts` option to filesystem directory watching. When enabled, paths on network filesystem mounts (NFS, CIFS, SMB, FUSE) can be watched — they are rejected by default because events on network mounts may be unreliable or not delivered at all. Requires envd 0.6.4 or later; watching with this option against an older sandbox raises a template error.
