---
'@e2b/cli': minor
---

Add `e2b template rebuild <template> --refresh-envd`: rebuild an existing template with the host's current envd while keeping its specs and alias. Old templates bake an old envd into their snapshot, which blocks features gated on a newer envd (e.g. volume mounts need envd >= 0.5.14); this rebuilds in place FROM the template's own latest ready build so only the envd binary is swapped. Streams build logs until the new build is ready. Requires the companion `POST /v2/templates/{templateID}/refresh-envd` endpoint (e2b-dev/infra#3624).
