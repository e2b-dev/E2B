
## Terminal class

A terminal session running in the sandbox.

**Signature:**

```typescript
declare class Terminal 
```

## Constructors

|  Constructor | Modifiers | Description |
|  --- | --- | --- |
|  [(constructor)(terminalID, sandbox, triggerExit, finished, output)](./sdk.terminal._constructor_.md) |  | Constructs a new instance of the <code>Terminal</code> class |

## Properties

|  Property | Modifiers | Type | Description |
|  --- | --- | --- | --- |
|  [data](./sdk.terminal.data.md) | <code>readonly</code> | string |  |
|  [finished](./sdk.terminal.finished.md) | <code>readonly</code> | Promise&lt;[TerminalOutput](./sdk.terminaloutput.md)<!-- -->&gt; |  |
|  [output](./sdk.terminal.output.md) | <code>readonly</code> | [TerminalOutput](./sdk.terminaloutput.md) |  |
|  [terminalID](./sdk.terminal.terminalid.md) | <code>readonly</code> | string |  |

## Methods

|  Method | Modifiers | Description |
|  --- | --- | --- |
|  [kill()](./sdk.terminal.kill.md) |  | Kills the terminal session. |
|  [resize(&#123; cols, rows &#125;)](./sdk.terminal.resize.md) |  | Resizes the terminal tty. |
|  [sendData(data)](./sdk.terminal.senddata.md) |  | Sends data to the terminal standard input. |
|  [wait()](./sdk.terminal.wait.md) |  | Waits for the terminal to finish. |

