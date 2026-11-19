---
'e2b': minor
---

Send API and sandbox requests straight to the control plane that E2B's API proxy names in the `X-E2B-Alt-Used` response header, instead of through the proxy. The SDK reads the header only from `api.<domain>` responses and follows it only to a domain on its supported list, which now also includes `e2b-foxtrot.dev` and `foxtrot-3.e2b.dev`. Every proxied response can move it to another control plane; a learned one is used for 5 minutes, and a request it refuses with 401 (API) or 502 (sandbox), or that cannot connect, is sent again through the proxy. Outside the browser only, and not with `debug`, an overridden `apiUrl` or `sandboxUrl`, or a domain the API returned for the sandbox. URLs handed to users (`getHost()`, file URLs) stay on the configured domain.
