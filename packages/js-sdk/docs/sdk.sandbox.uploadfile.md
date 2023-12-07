
## Sandbox.uploadFile() method

Uploads a file to the sandbox. The file will be uploaded to the user's home directory with the same name. If a file with the same name already exists, it will be overwritten.

\*\*You can use the [Sandbox.fileURL](./sdk.sandbox.fileurl.md) property and upload file directly via POST multipart/form-data\*\*

**Signature:**

```typescript
uploadFile(file: Buffer | Blob, filename: string): Promise<string>;
```

## Parameters

|  Parameter | Type | Description |
|  --- | --- | --- |
|  file | Buffer \| Blob |  |
|  filename | string |  |

**Returns:**

Promise&lt;string&gt;

