
## paths."/envs" property

**Signature:**

```typescript
"/envs": {
        get: {
            responses: {
                200: {
                    content: {
                        "application/json": components["schemas"]["Environment"][];
                    };
                };
                401: components["responses"]["401"];
                500: components["responses"]["500"];
            };
        };
        post: {
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
    };
```
