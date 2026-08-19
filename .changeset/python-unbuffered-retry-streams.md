---
"@e2b/python-sdk": patch
---

Stop the shared retrying transports from mirroring streamed request bodies in
memory. pyqwest's retry middleware keeps a non-`bytes` body replayable by
copying it as it is sent, so a streamed `files.write` of a file-like object or
`volume.write_file` grew a full in-RAM mirror and peak memory scaled with file
size. The transports now declare pyqwest's `RetryMode.UNBUFFERED` when the
installed release has it (pyqwest > 0.9): a streamed body is replayed only
while nothing has been read from it, which is all the SDK's connect-only retry
policy needs — a `ConnectionError` is raised only before the request was
written. Connect retries are unchanged, and `bytes` bodies (unary RPC
payloads, in-memory writes) were already replayable without a copy. On a
pyqwest without `RetryMode` the transports keep the buffered replay those
releases ship, since going unbuffered there would drop the connect retries
instead.
