
## FilesystemManager.write() method

Writes content to a new file on path.

**Signature:**

```typescript
write(path: string, content: string, opts?: CallOpts): Promise<void>;
```

## Parameters

|  Parameter | Type | Description |
|  --- | --- | --- |
|  path | string | Path to a new file. For example '/dirA/dirB/newFile.txt' when creating 'newFile.txt' |
|  content | string | Content to write to a new file |
|  opts | CallOpts | _(Optional)_ Call options |

**Returns:**

Promise&lt;void&gt;

