
## Sandbox.removeAction() method

Remove an action.

**Signature:**

```typescript
removeAction(name: string): this;
```

## Parameters

|  Parameter | Type | Description |
|  --- | --- | --- |
|  name | string | Action name |

**Returns:**

this

Sandbox

## Example


```ts
const sandbox = await Sandbox.create()
sandbox.addAction('hello', (sandbox, args) => 'Hello World')
sandbox.removeAction('hello')
```

