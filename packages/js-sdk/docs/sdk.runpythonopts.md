
## RunPythonOpts interface

**Signature:**

```typescript
interface RunPythonOpts<S extends DataAnalysis> extends Omit<ProcessOpts, 'cmd'> 
```
**Extends:** Omit&lt;ProcessOpts, 'cmd'&gt;

## Properties

|  Property | Modifiers | Type | Description |
|  --- | --- | --- | --- |
|  [onArtifact?](./sdk.runpythonopts.onartifact.md) |  | (artifact: [Artifact](./sdk.artifact.md)<!-- -->&lt;S&gt;) =&gt; Promise&lt;void&gt; \| void | _(Optional)_ |

