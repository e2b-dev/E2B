
## SandboxOpts interface

**Signature:**

```typescript
interface SandboxOpts extends SandboxConnectionOpts 
```
**Extends:** SandboxConnectionOpts

## Properties

|  Property | Modifiers | Type | Description |
|  --- | --- | --- | --- |
|  [onExit?](./sdk.sandboxopts.onexit.md) |  | (() =&gt; Promise&lt;void&gt; \| void) \| ((exitCode: number) =&gt; Promise&lt;void&gt; \| void) | _(Optional)_ |
|  [onScanPorts?](./sdk.sandboxopts.onscanports.md) |  | ScanOpenedPortsHandler | _(Optional)_ |
|  [onStderr?](./sdk.sandboxopts.onstderr.md) |  | (out: [ProcessMessage](./sdk.processmessage.md)) =&gt; Promise&lt;void&gt; \| void | _(Optional)_ |
|  [onStdout?](./sdk.sandboxopts.onstdout.md) |  | (out: [ProcessMessage](./sdk.processmessage.md)) =&gt; Promise&lt;void&gt; \| void | _(Optional)_ |
|  [timeout?](./sdk.sandboxopts.timeout.md) |  | number | _(Optional)_ Timeout for sandbox to start |

