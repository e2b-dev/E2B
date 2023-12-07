
## FilesystemManager.makeDir() method

Creates a new directory and all directories along the way if needed on the specified pth.

**Signature:**

```typescript
makeDir(path: string, opts?: CallOpts): Promise<void>;
```

## Parameters

|  Parameter | Type | Description |
|  --- | --- | --- |
|  path | string | Path to a new directory. For example '/dirA/dirB' when creating 'dirB'. |
|  opts | CallOpts | _(Optional)_ Call options |

**Returns:**

Promise&lt;void&gt;

