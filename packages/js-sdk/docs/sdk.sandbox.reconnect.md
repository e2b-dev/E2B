
## Sandbox.reconnect() method

Reconnects to an existing Sandbox.

**Signature:**

```typescript
static reconnect(sandboxID: string): Promise<Sandbox>;
```

## Parameters

|  Parameter | Type | Description |
|  --- | --- | --- |
|  sandboxID | string | Sandbox ID |

**Returns:**

Promise&lt;[Sandbox](./sdk.sandbox.md)&gt;

Existing Sandbox

## Example


```ts
const sandbox = await Sandbox.create()
const sandboxID = sandbox.id

await sandbox.keepAlive(300 * 1000)
await sandbox.close()

const reconnectedSandbox = await Sandbox.reconnect(sandboxID)
```

