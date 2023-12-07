
## Sandbox.create() method

Creates a new Sandbox from the specified options.

**Signature:**

```typescript
static create<S extends Sandbox>(opts: SandboxOpts): Promise<S>;
```

## Parameters

|  Parameter | Type | Description |
|  --- | --- | --- |
|  opts | [SandboxOpts](./sdk.sandboxopts.md) | Sandbox options |

**Returns:**

Promise&lt;S&gt;

New Sandbox

## Example


```ts
const sandbox = await Sandbox.create({
  template: "sandboxTemplate",
  onStdout: console.log,
})
```

