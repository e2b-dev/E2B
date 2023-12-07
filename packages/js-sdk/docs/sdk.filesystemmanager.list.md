
## FilesystemManager.list() method

List files in a directory.

**Signature:**

```typescript
list(path: string, opts?: CallOpts): Promise<FileInfo[]>;
```

## Parameters

|  Parameter | Type | Description |
|  --- | --- | --- |
|  path | string | Path to a directory |
|  opts | CallOpts | _(Optional)_ Call options |

**Returns:**

Promise&lt;[FileInfo](./sdk.fileinfo.md)\[\]&gt;

Array of files in a directory

