---
"e2b": patch
---

Fix tmux rendering issues by adding UTF-8 locale environment variables (LANG, LC_ALL) to PTY creation. This fixes garbled Unicode and box-drawing characters when running applications like Claude Code inside tmux in E2B sandboxes.
