---
"e2b": minor
"@e2b/python-sdk": minor
---

Add `allowDefaultDns` to the network options (`allow_default_dns` in Python). Set it to `false` to block 8.8.8.8, which is otherwise allowed when `allowOut` contains a domain. It can be toggled with `updateNetwork`/`update_network`, where leaving it out resets it to `true` like the other fields, and `getInfo`/`get_info` reports it.
