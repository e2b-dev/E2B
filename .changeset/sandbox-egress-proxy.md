---
'e2b': minor
'@e2b/python-sdk': minor
---

Add `network.egressProxy` / `network["egress_proxy"]` for routing a sandbox's outbound TCP through a SOCKS5 proxy you operate ("bring your own proxy"). Tunneling happens on the host after the `allowOut` / `denyOut` lists are evaluated, so nothing runs inside the sandbox and code running there can neither see the proxy nor route around it. UDP-based traffic — DNS and QUIC/HTTP3 — is not tunneled.

```ts
import { Sandbox } from 'e2b'

const sandbox = await Sandbox.create({
  network: {
    egressProxy: {
      address: 'proxy.example.com:1080',
      username: 'proxy-user',
      password: 'proxy-password',
    },
  },
})
```

```python
from e2b import Sandbox

sandbox = Sandbox.create(
    network={
        "egress_proxy": {
            "address": "proxy.example.com:1080",
            "username": "proxy-user",
            "password": "proxy-password",
        },
    },
)
```

It combines with the rest of the network configuration — here everything except `api.example.com` is denied, and the traffic that is allowed goes through your proxy:

```ts
await Sandbox.create({
  network: {
    allowOut: ['api.example.com'],
    denyOut: ({ allTraffic }) => [allTraffic],
    egressProxy: { address: 'proxy.example.com:1080' },
  },
})
```

```python
Sandbox.create(
    network={
        "allow_out": ["api.example.com"],
        "deny_out": lambda ctx: [ctx.all_traffic],
        "egress_proxy": {"address": "proxy.example.com:1080"},
    },
)
```

`updateNetwork` / `update_network` sets or replaces the proxy on a sandbox that is already running, with no restart. The update replaces the whole configuration instead of merging into it, so an update that leaves the proxy out stops tunneling — repeat it in every update that should keep it.

```ts
// Start tunneling on the running sandbox
await sandbox.updateNetwork({
  allowOut: ['api.example.com'],
  denyOut: ({ allTraffic }) => [allTraffic],
  egressProxy: { address: 'proxy.example.com:1080' },
})

// Stop tunneling: an update without egressProxy clears it
await sandbox.updateNetwork({})
```

```python
# Start tunneling on the running sandbox
sandbox.update_network({
    "allow_out": ["api.example.com"],
    "deny_out": lambda ctx: [ctx.all_traffic],
    "egress_proxy": {"address": "proxy.example.com:1080"},
})

# Stop tunneling: an update without egress_proxy clears it
sandbox.update_network({})
```

`getInfo` / `get_info` reports the proxy the sandbox's egress is currently tunneled through. The password is never returned, so the returned `SandboxEgressProxyInfo` does not have the field at all:

```ts
const info = await sandbox.getInfo()
console.log(info.network?.egressProxy)
// { address: 'proxy.example.com:1080', username: 'proxy-user' }
```

```python
info = sandbox.get_info()
print(info.network["egress_proxy"])
# {'address': 'proxy.example.com:1080', 'username': 'proxy-user'}
```

Egress fails closed: when the proxy is unreachable or does not speak SOCKS5, outbound connections fail rather than falling back to a direct connection. The address is validated server-side when the sandbox is created — a rejected create leaves nothing behind. Available on E2B Cloud and in BYOC deployments; a sandbox that names a proxy on a deployment built from the open source `e2b-dev/infra` repository is rejected as unsupported.
