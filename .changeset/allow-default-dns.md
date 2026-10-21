---
"e2b": minor
"@e2b/python-sdk": minor
---

Add `allowDefaultDns` to the network options (`allow_default_dns` in Python). Set it to `false` to block 8.8.8.8, which is otherwise allowed when `allowOut` contains a domain. `updateNetwork`/`update_network` keeps the current value when it's left out, and `getInfo`/`get_info` reports it.
