---
'e2b': minor
'@e2b/python-sdk': minor
---

Remove the deprecated `accessToken` / `access_token` option and its `E2B_ACCESS_TOKEN` environment fallback. E2B access tokens are no longer accepted for API authentication, so the SDKs no longer resolve one or send it as an `Authorization: Bearer` header — requests authenticate with the API key alone.

If you were relying on the option to send a bearer token to a custom deployment, pass the header directly, which is what the deprecation notice already pointed to:

```ts
// Before
const sandbox = await Sandbox.create({ accessToken: token })

// After
const sandbox = await Sandbox.create({
  apiHeaders: { Authorization: `Bearer ${token}` },
})
```

```python
# Before
config = ConnectionConfig(access_token=token)

# After
config = ConnectionConfig(api_headers={"Authorization": f"Bearer {token}"})
```

Note that `Sandbox.envd_access_token` / `traffic_access_token` are unrelated per-sandbox tokens and are unaffected.
