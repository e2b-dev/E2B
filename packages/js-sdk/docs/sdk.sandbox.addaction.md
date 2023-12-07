
## Sandbox.addAction() method

Add a new action. The name of the action is automatically extracted from the function name.

You can use this action with specific integrations like OpenAI to interact with the sandbox and get output for the action.

**Signature:**

```typescript
addAction<T = {
        [name: string]: any;
    }>(action: Action<this, T>): this;
```

## Parameters

|  Parameter | Type | Description |
|  --- | --- | --- |
|  action | [Action](./sdk.action.md)<!-- -->&lt;this, T&gt; | Action handler |

**Returns:**

this

Sandbox

## Example


```ts
const sandbox = await Sandbox.create()
sandbox.addAction('readFile', (sandbox, args) => sandbox.filesystem.read(args.path))
```

