
## components interface

**Signature:**

```typescript
interface components 
```

## Properties

|  Property | Modifiers | Type | Description |
|  --- | --- | --- | --- |
|  [parameters](./sdk.components.parameters.md) |  | &#123; envID: string; buildID: string; instanceID: string; &#125; |  |
|  [responses](./sdk.components.responses.md) |  | &#123; 400: &#123; content: &#123; "application/json": [components](./sdk.components.md)\["schemas"\]\["Error"\]; &#125;; &#125;; 401: &#123; content: &#123; "application/json": [components](./sdk.components.md)\["schemas"\]\["Error"\]; &#125;; &#125;; 404: &#123; content: &#123; "application/json": [components](./sdk.components.md)\["schemas"\]\["Error"\]; &#125;; &#125;; 500: &#123; content: &#123; "application/json": [components](./sdk.components.md)\["schemas"\]\["Error"\]; &#125;; &#125;; &#125; |  |
|  [schemas](./sdk.components.schemas.md) |  | &#123; NewInstance: &#123; envID: string; &#125;; Environment: &#123; envID: string; buildID: string; public: boolean; aliases?: string\[\]; &#125;; EnvironmentBuild: &#123; logs: string\[\]; envID: string; buildID: string; status?: "building" \| "ready" \| "error"; &#125; &amp; &#123; finished: unknown; &#125;; Instance: &#123; envID: string; instanceID: string; clientID: string; &#125;; Error: &#123; code: number; message: string; &#125;; &#125; |  |

