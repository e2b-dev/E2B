---
'e2b': patch
'@e2b/python-sdk': patch
---

Bring the JS and Python halves of `network.egressProxy` / `network["egress_proxy"]` back in line for callers that bypass the types, and stop `null` credentials from reaching the wire.

A malformed proxy now raises `InvalidArgumentError` / `InvalidArgumentException` in both SDKs. Before, only Python did; JS rebuilt the body from the known fields, so a proxy passed as a bare string sent `{}` and the caller got an API error about a field they never left out:

```ts
// Now: InvalidArgumentError, naming the option you typed.
// Before: sent `"egressProxy": {}` and failed at the API.
await Sandbox.create({
  network: { egressProxy: 'proxy.example.com:1080' as never },
})
```

A `username` or `password` that is `null` / `None` is treated as "no credentials" rather than serialized as a JSON null the API rejects — the same reading both SDKs already gave `egressProxy: null` itself:

```ts
await Sandbox.create({
  network: {
    egressProxy: {
      address: 'proxy.example.com:1080',
      // Unset in the environment; the proxy takes no credentials.
      username: process.env.PROXY_USER,
    },
  },
})
```

```python
Sandbox.create(
    network={
        "egress_proxy": {
            "address": "proxy.example.com:1080",
            "username": os.environ.get("PROXY_USER"),
        },
    },
)
```

`getInfo` / `get_info` normalizes a `null` `username` the same way, so `SandboxEgressProxyInfo.username` is `undefined` / an absent key rather than a null that its type says cannot be there.
