---
"@e2b/python-sdk": patch
---

Stop mirroring streamed request bodies in memory while they are being sent. The
shared retrying transports now declare pyqwest's unbuffered retry policy, so a
streamed upload — `files.write` of a file-like object, `volume.write_file`,
template build contexts — is no longer copied into a replay buffer as it goes to
the wire, and peak memory stays flat instead of scaling with file size. Connect
retries are unchanged: a connect error means the body was never read, so the
same body is handed to the next attempt, and `bytes` bodies (unary RPC payloads,
in-memory writes) were already replayable for free. Requires a pyqwest whose
retry middleware exposes `RetryMode`; on older releases the SDK keeps that
release's buffered behavior.
