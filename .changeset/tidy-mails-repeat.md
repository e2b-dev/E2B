---
'e2b': minor
'@e2b/python-sdk': minor
---

Add a `caBundle` / `ca_bundle` connection option (and the `E2B_CA_BUNDLE`
environment variable) that trusts a private CA — the certificates in a PEM
file — for every request the SDK makes: the control-plane API, envd (files,
commands, PTY), volume content, and template build-context uploads. The
certificates are trusted in addition to the default CA store, so connections
validating against a public CA keep working.

```ts
const sandbox = await Sandbox.create({
  caBundle: '/etc/ssl/certs/internal-ca.pem',
})
```

```python
sandbox = Sandbox(ca_bundle="/etc/ssl/certs/internal-ca.pem")
```

In Python this also closes a silent gap: `verify_ssl` on the generated API
clients never reached the pyqwest transports the SDK installs, so custom TLS
trust was dropped without a word. Passing it now raises and points at
`ca_bundle`.

Self-hosted deployments that trusted a private CA through the `SSL_CERT_FILE`
environment variable should move to `ca_bundle` / `E2B_CA_BUNDLE`: the
transports stopped reading OpenSSL's environment variables when they moved off
httpx (rustls doesn't consult them), and installing the CA in the system trust
store is the only other thing they still honor.

In JS the option is Node-only — no other runtime lets the SDK configure TLS
trust per connection — and setting it elsewhere raises instead of connecting
with the trust it was meant to extend.
