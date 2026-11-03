---
'e2b': minor
'@e2b/python-sdk': minor
---

Add `force` to `pause()`. By default a pause is now refused while the sandbox's guest agent does not respond, and the sandbox keeps running; `force: true` / `force=True` pauses anyway, and the sandbox can then only be resumed with `onResume: 'reboot'` / `on_resume="reboot"`.
