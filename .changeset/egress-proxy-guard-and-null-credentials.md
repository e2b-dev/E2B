---
'@e2b/python-sdk': patch
'e2b': patch
---

Fix two `network.egressProxy` / `network["egress_proxy"]` cases an untyped caller reaches.

The JS SDK had no shape guard: `buildEgressProxyBody` rebuilds the body from the known fields, so an `address` that was missing or not a string vanished and the caller got an API error about a config they never wrote (`{"egressProxy":{}}`). It now raises `InvalidArgumentError` naming the option, the way the Python SDK already did:

```ts
// InvalidArgumentError: network egressProxy must be an object with a string
// 'address' (e.g. 'proxy.example.com:1080').
await Sandbox.create({
  network: { egressProxy: 'proxy.example.com:1080' as never },
})
```

A `null` / `None` username or password is now treated as absent instead of being serialized as a JSON null the API rejects — reading a credential out of an unset environment variable is how a caller lands there, and it means the proxy takes no credentials:

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
