# e2b.api.client.EnvsApi

All URIs are relative to *https://ondevbook.com*

| Method                                                                          | HTTP request                        | Description |
| ------------------------------------------------------------------------------- | ----------------------------------- | ----------- |
| [**envs_code_snippet_id_delete**](EnvsApi.md#envs_code_snippet_id_delete)       | **DELETE** /envs/{codeSnippetID}    |
| [**envs_code_snippet_id_patch**](EnvsApi.md#envs_code_snippet_id_patch)         | **PATCH** /envs/{codeSnippetID}     |
| [**envs_code_snippet_id_post**](EnvsApi.md#envs_code_snippet_id_post)           | **POST** /envs/{codeSnippetID}      |
| [**envs_code_snippet_id_state_put**](EnvsApi.md#envs_code_snippet_id_state_put) | **PUT** /envs/{codeSnippetID}/state |
| [**envs_code_snippet_id_title_put**](EnvsApi.md#envs_code_snippet_id_title_put) | **PUT** /envs/{codeSnippetID}/title |
| [**envs_get**](EnvsApi.md#envs_get)                                             | **GET** /envs                       |
| [**envs_post**](EnvsApi.md#envs_post)                                           | **POST** /envs                      |

# **envs_code_snippet_id_delete**

> envs_code_snippet_id_delete(api_key, code_snippet_id)

Delete the code snippet environment

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
    api_instance = e2b.api.client.EnvsApi(api_client)
    api_key = 'api_key_example' # str |
    code_snippet_id = 'code_snippet_id_example' # str |

    try:
        await api_instance.envs_code_snippet_id_delete(api_key, code_snippet_id)
    except Exception as e:
        print("Exception when calling EnvsApi->envs_code_snippet_id_delete: %s\n" % e)
```

### Parameters

| Name                | Type    | Description | Notes |
| ------------------- | ------- | ----------- | ----- |
| **api_key**         | **str** |             |
| **code_snippet_id** | **str** |             |

### Return type

void (empty response body)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

### HTTP response details

| Status code | Description                          | Response headers |
| ----------- | ------------------------------------ | ---------------- |
| **204**     | Successfully deleted the environment | -                |
| **400**     | Cannot delete the environment        | -                |
| **401**     | Authentication error                 | -                |
| **500**     | Server error                         | -                |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **envs_code_snippet_id_patch**

> envs_code_snippet_id_patch(api_key, code_snippet_id)

Update the environment of the code snippet to match the edit environment

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
    api_instance = e2b.api.client.EnvsApi(api_client)
    api_key = 'api_key_example' # str |
    code_snippet_id = 'code_snippet_id_example' # str |

    try:
        await api_instance.envs_code_snippet_id_patch(api_key, code_snippet_id)
    except Exception as e:
        print("Exception when calling EnvsApi->envs_code_snippet_id_patch: %s\n" % e)
```

### Parameters

| Name                | Type    | Description | Notes |
| ------------------- | ------- | ----------- | ----- |
| **api_key**         | **str** |             |
| **code_snippet_id** | **str** |             |

### Return type

void (empty response body)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

### HTTP response details

| Status code | Description                                   | Response headers |
| ----------- | --------------------------------------------- | ---------------- |
| **204**     | Updated the edit environment for code snippet | -                |
| **400**     | Bad request                                   | -                |
| **401**     | Authentication error                          | -                |
| **500**     | Server error                                  | -                |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **envs_code_snippet_id_post**

> envs_code_snippet_id_post(api_key, code_snippet_id, new_environment)

Create a new env for a code snippet

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
    api_instance = e2b.api.client.EnvsApi(api_client)
    api_key = 'api_key_example' # str |
    code_snippet_id = 'code_snippet_id_example' # str |
    new_environment = e2b.api.client.NewEnvironment() # NewEnvironment |

    try:
        await api_instance.envs_code_snippet_id_post(api_key, code_snippet_id, new_environment)
    except Exception as e:
        print("Exception when calling EnvsApi->envs_code_snippet_id_post: %s\n" % e)
```

### Parameters

| Name                | Type                                    | Description | Notes |
| ------------------- | --------------------------------------- | ----------- | ----- |
| **api_key**         | **str**                                 |             |
| **code_snippet_id** | **str**                                 |             |
| **new_environment** | [**NewEnvironment**](NewEnvironment.md) |             |

### Return type

void (empty response body)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

### HTTP response details

| Status code | Description                         | Response headers |
| ----------- | ----------------------------------- | ---------------- |
| **204**     | Successfully created an environment | -                |
| **400**     | Bad request                         | -                |
| **401**     | Authentication error                | -                |
| **500**     | Server error                        | -                |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **envs_code_snippet_id_state_put**

> envs_code_snippet_id_state_put(api_key, code_snippet_id, environment_state_update)

Update the state of the environment

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
    api_instance = e2b.api.client.EnvsApi(api_client)
    api_key = 'api_key_example' # str |
    code_snippet_id = 'code_snippet_id_example' # str |
    environment_state_update = e2b.api.client.EnvironmentStateUpdate() # EnvironmentStateUpdate |

    try:
        await api_instance.envs_code_snippet_id_state_put(api_key, code_snippet_id, environment_state_update)
    except Exception as e:
        print("Exception when calling EnvsApi->envs_code_snippet_id_state_put: %s\n" % e)
```

### Parameters

| Name                         | Type                                                    | Description | Notes |
| ---------------------------- | ------------------------------------------------------- | ----------- | ----- |
| **api_key**                  | **str**                                                 |             |
| **code_snippet_id**          | **str**                                                 |             |
| **environment_state_update** | [**EnvironmentStateUpdate**](EnvironmentStateUpdate.md) |             |

### Return type

void (empty response body)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

### HTTP response details

| Status code | Description                      | Response headers |
| ----------- | -------------------------------- | ---------------- |
| **204**     | Updated the state of environment | -                |
| **400**     | Bad request                      | -                |
| **401**     | Authentication error             | -                |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **envs_code_snippet_id_title_put**

> envs_code_snippet_id_title_put(api_key, code_snippet_id, environment_title_update)

Update the title of the environment

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
    api_instance = e2b.api.client.EnvsApi(api_client)
    api_key = 'api_key_example' # str |
    code_snippet_id = 'code_snippet_id_example' # str |
    environment_title_update = e2b.api.client.EnvironmentTitleUpdate() # EnvironmentTitleUpdate |

    try:
        await api_instance.envs_code_snippet_id_title_put(api_key, code_snippet_id, environment_title_update)
    except Exception as e:
        print("Exception when calling EnvsApi->envs_code_snippet_id_title_put: %s\n" % e)
```

### Parameters

| Name                         | Type                                                    | Description | Notes |
| ---------------------------- | ------------------------------------------------------- | ----------- | ----- |
| **api_key**                  | **str**                                                 |             |
| **code_snippet_id**          | **str**                                                 |             |
| **environment_title_update** | [**EnvironmentTitleUpdate**](EnvironmentTitleUpdate.md) |             |

### Return type

void (empty response body)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

### HTTP response details

| Status code | Description                           | Response headers |
| ----------- | ------------------------------------- | ---------------- |
| **204**     | Updated the title of the code snippet | -                |
| **400**     | Bad request                           | -                |
| **401**     | Authentication error                  | -                |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **envs_get**

> List[EnvsGet200ResponseInner] envs_get(api_key)

List all environments

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
    api_instance = e2b.api.client.EnvsApi(api_client)
    api_key = 'api_key_example' # str |

    try:
        api_response = await api_instance.envs_get(api_key)
        print("The response of EnvsApi->envs_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling EnvsApi->envs_get: %s\n" % e)
```

### Parameters

| Name        | Type    | Description | Notes |
| ----------- | ------- | ----------- | ----- |
| **api_key** | **str** |             |

### Return type

[**List[EnvsGet200ResponseInner]**](EnvsGet200ResponseInner.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

### HTTP response details

| Status code | Description                            | Response headers |
| ----------- | -------------------------------------- | ---------------- |
| **200**     | Successfully returned all environments | -                |
| **401**     | Authentication error                   | -                |
| **500**     | Server error                           | -                |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **envs_post**

> Environment envs_post(api_key, new_environment)

Create a new environment

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
    api_instance = e2b.api.client.EnvsApi(api_client)
    api_key = 'api_key_example' # str |
    new_environment = e2b.api.client.NewEnvironment() # NewEnvironment |

    try:
        api_response = await api_instance.envs_post(api_key, new_environment)
        print("The response of EnvsApi->envs_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling EnvsApi->envs_post: %s\n" % e)
```

### Parameters

| Name                | Type                                    | Description | Notes |
| ------------------- | --------------------------------------- | ----------- | ----- |
| **api_key**         | **str**                                 |             |
| **new_environment** | [**NewEnvironment**](NewEnvironment.md) |             |

### Return type

[**Environment**](Environment.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

### HTTP response details

| Status code | Description                         | Response headers |
| ----------- | ----------------------------------- | ---------------- |
| **200**     | Successfully created an environment | -                |
| **400**     | Bad request                         | -                |
| **401**     | Authentication error                | -                |
| **500**     | Server error                        | -                |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)
