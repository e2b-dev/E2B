---
'@e2b/cli': patch
---

Fix `e2b auth login` crashing on headless machines where `xdg-open` is unavailable. The CLI now spawns the browser opener directly so it can catch the spawn `ENOENT` synchronously, prints the login URL so the user can open it manually, and suggests setting `E2B_API_KEY` when interactive login is not possible.
