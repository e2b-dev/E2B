---
"e2b": patch
"@e2b/python-sdk": patch
---

Align ANSI stripping of template build log messages across both SDKs. The Python SDK's `strip_ansi_escape_codes` now ports the JS SDK's `stripAnsi` regex: OSC sequences (hyperlinks, window titles) are matched non-greedily up to the first string terminator — including sequences spanning newlines — and CSI sequences are stripped without requiring a terminator. Both implementations additionally strip the remaining ECMA-48 string controls (DCS/Sixel, SOS, PM, APC) through their string terminator so control payloads no longer leak into cleaned logs.
