
## Sandbox.create() method

Creates a new Sandbox from the default `base` sandbox template.

**Signature:**

```typescript
static create<S extends Sandbox>(): Promise<S>;
```
**Returns:**

Promise&lt;S&gt;

New Sandbox

## Example


```ts
const sandbox = await Sandbox.create()
```

