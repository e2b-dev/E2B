---
'e2b': patch
'@e2b/python-sdk': patch
---

Template file uploads now send the request headers the file-upload-link response returns. Azure-backed clusters sign layer-file uploads with a SAS and return `x-ms-blob-type: BlockBlob`, which a SAS cannot carry; without it every uncached `COPY` in `Template.build()` failed with a storage `400 MissingRequiredHeader`. GCS and S3 clusters return no headers and are unaffected.
