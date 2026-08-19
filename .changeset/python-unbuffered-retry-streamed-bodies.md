---
"@e2b/python-sdk": patch
---

Stop mirroring streamed request bodies in memory while they are being sent, on a
pyqwest whose retry middleware exposes `RetryMode` (older releases keep the
buffered replay they ship, so this is inert until the `pyqwest` dependency
allows one). The shared retrying transports declare pyqwest's unbuffered retry
policy, so a streamed `files.write` of a file-like object or `volume.write_file`
is no longer copied into a replay buffer as it goes to the wire, and peak memory
stays flat instead of scaling with file size. Connect retries are unchanged: a
connect error means the body was never read, so the same body is handed to the
next attempt, and `bytes` bodies (unary RPC payloads, in-memory writes) were
already replayable for free.
