---
'e2b': minor
'@e2b/python-sdk': minor
---

Add `strict` to `pause()` (default `false`). With `strict: true` / `strict=True` a pause is refused with `ServiceBusyError` / `ServiceBusyException` while the sandbox's guest agent does not respond, and the sandbox keeps running. Without it the API's default applies: the memory snapshot is taken anyway and marked. Sandbox info exposes the mark as `envdUnresponsiveAtPause` / `envd_unresponsive_at_pause`, and resuming such a sandbox without `onResume: 'reboot'` / `on_resume="reboot"` now throws `GuestAgentUnresponsiveError` / `GuestAgentUnresponsiveException`.
