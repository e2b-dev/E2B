
## Sandbox.addAction() method

Add a new action with a specified name.

You can use this action with specific integrations like OpenAI to interact with the sandbox and get output for the action.

**Signature:**

```typescript
addAction<T = {
        [name: string]: any;
    }>(name: string, action: Action<this, T>): this;
```

## Parameters

|  Parameter | Type | Description |
|  --- | --- | --- |
|  name | string | Action name |
|  action | [Action](./sdk.action.md)<!-- -->&lt;this, T&gt; | Action handler |

**Returns:**

this

Sandbox

## Example


```ts
async function readFile(sandbox: Sandbox, args: any) {
  return sandbox.filesystem.read(args.path)
}

const sandbox = await Sandbox.create()
sandbox.addAction(readFile)
```

