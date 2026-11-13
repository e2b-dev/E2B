---
'e2b': patch
---

Fix every API call failing on Node with "onResponse: must return new Response() when modifying the response" when a `logger` is passed. The API logging middleware no longer returns the unchanged request and response, which openapi-fetch rejected because undici's `Response` is not the global one.
