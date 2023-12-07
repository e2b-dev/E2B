
## paths."/envs/&#123;envID&#125;" property

**Signature:**

```typescript
"/envs/{envID}": {
        post: {
            parameters: {
                path: {
                    envID: components["parameters"]["envID"];
                };
            };
            responses: {
                202: {
                    content: {
                        "application/json": components["schemas"]["Environment"];
                    };
                };
                401: components["responses"]["401"];
                500: components["responses"]["500"];
            };
            requestBody: {
                content: {
                    "multipart/form-data": {
                        alias?: string;
                        buildContext: string;
                        dockerfile: string;
                        startCmd?: string;
                    };
                };
            };
        };
        delete: {
            parameters: {
                path: {
                    envID: components["parameters"]["envID"];
                };
            };
            responses: {
                204: never;
                401: components["responses"]["401"];
                500: components["responses"]["500"];
            };
        };
    };
```
