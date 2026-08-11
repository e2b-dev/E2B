---
"@e2b/python-sdk": patch
---

Stop mirroring streamed file uploads in memory. To be able to replay a request,
pyqwest's retry middleware copies a streamed request body in full as it is sent,
so an upload was streamed to the wire *and* held whole in RAM: writing a 64 MiB
file with `volume.write_file`, `sandbox.files.write` or a template context upload
peaked at ~67 MB of it. A streamed upload now goes out on an httpx transport over
the same connection pool with the retry layer left out, so it keeps the pooled
connections while the body is no longer copied — a 32 MiB upload peaks at 1.5 MB
instead of 38 MB. What those uploads give up is the connect retry, which fires
before any of the body was written, so a failure to connect surfaces to the
caller as it would have anyway; writes of in-memory data are replayable for free
and keep their retries. Template context uploads no longer build a connection
pool of their own per build either.
