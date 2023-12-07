
## components.schemas property

**Signature:**

```typescript
schemas: {
        NewInstance: {
            envID: string;
        };
        Environment: {
            envID: string;
            buildID: string;
            public: boolean;
            aliases?: string[];
        };
        EnvironmentBuild: {
            logs: string[];
            envID: string;
            buildID: string;
            status?: "building" | "ready" | "error";
        } & {
            finished: unknown;
        };
        Instance: {
            envID: string;
            instanceID: string;
            clientID: string;
        };
        Error: {
            code: number;
            message: string;
        };
    };
```
