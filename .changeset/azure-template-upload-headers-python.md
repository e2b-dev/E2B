---
"@e2b/python-sdk": patch
---

Apply the request headers the API returns with a template layer-file upload link. Azure Blob Storage requires `x-ms-blob-type` on the upload request, which its signed URL cannot carry, so `COPY` instructions failed on Azure-backed clusters. GCS- and S3-backed clusters return no headers and are unaffected.
