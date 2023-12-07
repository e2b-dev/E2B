
## paths."/instances" property

**Signature:**

```typescript
"/instances": {
        post: {
            responses: {
                201: {
                    content: {
                        "application/json": components["schemas"]["Instance"];
                    };
                };
                400: components["responses"]["400"];
                401: components["responses"]["401"];
                500: components["responses"]["500"];
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["NewInstance"];
                };
            };
        };
    };
```
