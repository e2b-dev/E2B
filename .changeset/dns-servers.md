---
"e2b": minor
"@e2b/python-sdk": minor
---

Add `dnsServers` to the network options (`dns_servers` in Python): the DNS servers a sandbox can reach when `allowOut` contains a domain. Leave it out to allow the default, 8.8.8.8, pass a list of IPs to allow those instead, or pass `[]` to allow none. It only opens the firewall and doesn't change the sandbox's `/etc/resolv.conf`. `updateNetwork`/`update_network` reset it to the default when it is left out, like the other fields, and `getInfo`/`get_info` report it when set.
