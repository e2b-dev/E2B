---
'e2b': minor
'@e2b/python-sdk': minor
---

The API client accepts an `Authorization` header in place of an API key. Requests can now authenticate with an OAuth access token passed through `apiHeaders` (JS) or `api_headers` (Python), together with the `X-Team-ID` header that selects the team:

```ts
await Sandbox.create({
  apiHeaders: { Authorization: `Bearer ${accessToken}`, 'X-Team-ID': teamId },
})
```

```python
Sandbox.create(api_headers={"Authorization": f"Bearer {access_token}", "X-Team-ID": team_id})
```
