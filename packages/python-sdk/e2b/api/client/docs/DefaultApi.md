# e2b.api.client.DefaultApi

All URIs are relative to *https://ondevbook.com*

| Method                                     | HTTP request    | Description |
| ------------------------------------------ | --------------- | ----------- |
| [**health_get**](DefaultApi.md#health_get) | **GET** /health |

# **health_get**

> health_get()

Health check

### Example

```python
import e2b.api.client

# Defining the host is optional and defaults to https://ondevbook.com
# See configuration.py for a list of all supported configuration parameters.
configuration = e2b.api.client.Configuration(
    host = "https://ondevbook.com"
)


# Enter a context with an instance of the API client
async with e2b.api.client.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = e2b.api.client.DefaultApi(api_client)

    try:
        await api_instance.health_get()
    except Exception as e:
        print("Exception when calling DefaultApi->health_get: %s\n" % e)
```

### Parameters

This endpoint does not need any parameter.

### Return type

void (empty response body)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

### HTTP response details

| Status code | Description            | Response headers |
| ----------- | ---------------------- | ---------------- |
| **200**     | Request was successful | -                |
| **401**     | Authentication error   | -                |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)
