# e2b.api.client.SessionsApi

All URIs are relative to *https://ondevbook.com*

| Method                                                                                  | HTTP request                           | Description |
| --------------------------------------------------------------------------------------- | -------------------------------------- | ----------- |
| [**sessions_get**](SessionsApi.md#sessions_get)                                         | **GET** /sessions                      |
| [**sessions_post**](SessionsApi.md#sessions_post)                                       | **POST** /sessions                     |
| [**sessions_session_id_delete**](SessionsApi.md#sessions_session_id_delete)             | **DELETE** /sessions/{sessionID}       |
| [**sessions_session_id_refresh_post**](SessionsApi.md#sessions_session_id_refresh_post) | **POST** /sessions/{sessionID}/refresh |

# **sessions_get**

> List[SessionsGet200ResponseInner] sessions_get(api_key)

List all sessions

### Example

```python
import e2b.api.client
from pprint import pprint

# Defining the host is optional and defaults to https://ondevbook.com
# See configuration.py for a list of all supported configuration parameters.
configuration = e2b.api.client.Configuration(
    host = "https://ondevbook.com"
)


# Enter a context with an instance of the API client
async with e2b.api.client.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = e2b.api.client.SessionsApi(api_client)
    api_key = 'api_key_example' # str |

    try:
        api_response = await api_instance.sessions_get(api_key)
        print("The response of SessionsApi->sessions_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling SessionsApi->sessions_get: %s\n" % e)
```

### Parameters

| Name        | Type    | Description | Notes |
| ----------- | ------- | ----------- | ----- |
| **api_key** | **str** |             |

### Return type

[**List[SessionsGet200ResponseInner]**](SessionsGet200ResponseInner.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

### HTTP response details

| Status code | Description                        | Response headers |
| ----------- | ---------------------------------- | ---------------- |
| **200**     | Successfully returned all sessions | -                |
| **401**     | Authentication error               | -                |
| **500**     | Server error                       | -                |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **sessions_post**

> Session sessions_post(new_session, api_key=api_key)

Create a session on the server

### Example

```python
import e2b.api.client
from pprint import pprint

# Defining the host is optional and defaults to https://ondevbook.com
# See configuration.py for a list of all supported configuration parameters.
configuration = e2b.api.client.Configuration(
    host = "https://ondevbook.com"
)


# Enter a context with an instance of the API client
async with e2b.api.client.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = e2b.api.client.SessionsApi(api_client)
    new_session = e2b.api.client.NewSession() # NewSession |
    api_key = 'api_key_example' # str |  (optional)

    try:
        api_response = await api_instance.sessions_post(new_session, api_key=api_key)
        print("The response of SessionsApi->sessions_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling SessionsApi->sessions_post: %s\n" % e)
```

### Parameters

| Name            | Type                            | Description | Notes      |
| --------------- | ------------------------------- | ----------- | ---------- |
| **new_session** | [**NewSession**](NewSession.md) |             |
| **api_key**     | **str**                         |             | [optional] |

### Return type

[**Session**](Session.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

### HTTP response details

| Status code | Description                    | Response headers |
| ----------- | ------------------------------ | ---------------- |
| **201**     | Successfully created a session | -                |
| **401**     | Authentication error           | -                |
| **400**     | Bad request                    | -                |
| **500**     | Server error                   | -                |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **sessions_session_id_delete**

> sessions_session_id_delete(api_key, session_id)

Delete a session on the server

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
    api_instance = e2b.api.client.SessionsApi(api_client)
    api_key = 'api_key_example' # str |
    session_id = 'session_id_example' # str |

    try:
        await api_instance.sessions_session_id_delete(api_key, session_id)
    except Exception as e:
        print("Exception when calling SessionsApi->sessions_session_id_delete: %s\n" % e)
```

### Parameters

| Name           | Type    | Description | Notes |
| -------------- | ------- | ----------- | ----- |
| **api_key**    | **str** |             |
| **session_id** | **str** |             |

### Return type

void (empty response body)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

### HTTP response details

| Status code | Description                      | Response headers |
| ----------- | -------------------------------- | ---------------- |
| **204**     | Successfully deleted the session | -                |
| **401**     | Authentication error             | -                |
| **500**     | Server error                     | -                |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **sessions_session_id_refresh_post**

> sessions_session_id_refresh_post(session_id, api_key=api_key)

Refresh the session extending its time to live

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
    api_instance = e2b.api.client.SessionsApi(api_client)
    session_id = 'session_id_example' # str |
    api_key = 'api_key_example' # str |  (optional)

    try:
        await api_instance.sessions_session_id_refresh_post(session_id, api_key=api_key)
    except Exception as e:
        print("Exception when calling SessionsApi->sessions_session_id_refresh_post: %s\n" % e)
```

### Parameters

| Name           | Type    | Description | Notes      |
| -------------- | ------- | ----------- | ---------- |
| **session_id** | **str** |             |
| **api_key**    | **str** |             | [optional] |

### Return type

void (empty response body)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

### HTTP response details

| Status code | Description                                  | Response headers |
| ----------- | -------------------------------------------- | ---------------- |
| **204**     | Successfully refreshed the session           | -                |
| **401**     | Authentication error                         | -                |
| **404**     | Error refreshing session - session not found | -                |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)
