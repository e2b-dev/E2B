
## withAccessToken() function

**Signature:**

```typescript
declare function withAccessToken<T>(f: TypedFetch<T>): WithAccessToken<T> & {
    Error: typeof f.Error;
};
```

## Parameters

|  Parameter | Type | Description |
|  --- | --- | --- |
|  f | TypedFetch&lt;T&gt; |  |

**Returns:**

WithAccessToken&lt;T&gt; &amp; &#123; Error: typeof f.Error; &#125;

