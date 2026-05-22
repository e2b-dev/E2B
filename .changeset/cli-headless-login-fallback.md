---
'@e2b/cli': patch
---

Fix `e2b auth login` crashing on headless machines where `xdg-open` is unavailable. The CLI now catches the spawn error and prints the login URL so the user can open it manually.
