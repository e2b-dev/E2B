
## Sandbox.create() method

Creates a new Sandbox from the template with the specified ID.

**Signature:**

```typescript
static create<S extends Sandbox>(template: string): Promise<S>;
```

## Parameters

|  Parameter | Type | Description |
|  --- | --- | --- |
|  template | string | Sandbox template ID or name |

**Returns:**

Promise&lt;S&gt;

New Sandbox

## Example


```ts
const sandbox = await Sandbox.create("sandboxTemplateID")
```

