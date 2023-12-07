
## Sandbox.fileURL property

URL that can be used to download or upload file to the sandbox via a multipart/form-data POST request. This is useful if you're uploading files directly from the browser. The file will be uploaded to the user's home directory with the same name. If a file with the same name already exists, it will be overwritten.

**Signature:**

```typescript
get fileURL(): string;
```
