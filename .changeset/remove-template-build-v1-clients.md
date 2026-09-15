---
'e2b': minor
'@e2b/python-sdk': minor
---

Removed the V1 template build operations and schemas from the generated API clients. The API no longer serves them (runtime `87968fc1e1fa`); control planes carrying that change answer `410 Gone`. Template builds go through the Template SDK.

Visible removal, classified minor: the JS `paths` namespace loses `POST /templates`, `POST /templates/{templateID}`, `POST /templates/{templateID}/builds/{buildID}` and `POST /v2/templates`, and `components['schemas']` loses `TemplateLegacy`, `TemplateBuildRequest` and `TemplateBuildRequestV2`; the Python `e2b.api.client.models` package loses `TemplateLegacy`, `TemplateBuildRequest` and `TemplateBuildRequestV2`, and `e2b.api.client.api.templates` loses the `post_templates`, `post_templates_template_id`, `post_templates_template_id_builds_build_id` and `post_v2_templates` modules. No SDK method accepted or returned them; code that imported these names directly must drop the import.

The regenerated clients also pick up a documented `429` on most operations, a `409` on template create (v3), the upload-request `headers` on the build file-upload link, `minLength: 1` on the v2 build source fields, and a deprecation marker on the always-empty `logs` field of the build status.
