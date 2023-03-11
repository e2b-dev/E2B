# openapi_client.DefaultApi

All URIs are relative to *https://localhost:9001*

Method | HTTP request | Description
------------- | ------------- | -------------
[**create_session**](DefaultApi.md#create_session) | **POST** /sessions | 
[**delete_filesystem_entry**](DefaultApi.md#delete_filesystem_entry) | **DELETE** /sessions/{id}/filesystem | 
[**delete_session**](DefaultApi.md#delete_session) | **DELETE** /sessions/{id} | 
[**list_filesystem_dir**](DefaultApi.md#list_filesystem_dir) | **GET** /sessions/{id}/filesystem/dir | 
[**make_filesystem_dir**](DefaultApi.md#make_filesystem_dir) | **PUT** /sessions/{id}/filesystem/dir | 
[**read_filesystem_file**](DefaultApi.md#read_filesystem_file) | **GET** /sessions/{id}/filesystem/file | 
[**run_process**](DefaultApi.md#run_process) | **POST** /sessions/{id}/process | 
[**write_filesystem_file**](DefaultApi.md#write_filesystem_file) | **PUT** /sessions/{id}/filesystem/file | 


# **create_session**
> CreateSessionResponse create_session(create_session_params)



### Example

```python
from __future__ import print_function
import time
import os
import openapi_client
from openapi_client.rest import ApiException
from pprint import pprint
# Defining the host is optional and defaults to https://localhost:9001
# See configuration.py for a list of all supported configuration parameters.
configuration = openapi_client.Configuration(
    host = "https://localhost:9001"
)


# Enter a context with an instance of the API client
with openapi_client.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = openapi_client.DefaultApi(api_client)
    create_session_params = openapi_client.CreateSessionParams() # CreateSessionParams | 

    try:
        api_response = api_instance.create_session(create_session_params)
        print("The response of DefaultApi->create_session:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling DefaultApi->create_session: %s\n" % e)
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **create_session_params** | [**CreateSessionParams**](CreateSessionParams.md)|  | 

### Return type

[**CreateSessionResponse**](CreateSessionResponse.md)

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Ok |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **delete_filesystem_entry**
> delete_filesystem_entry(id, path)



### Example

```python
from __future__ import print_function
import time
import os
import openapi_client
from openapi_client.rest import ApiException
from pprint import pprint
# Defining the host is optional and defaults to https://localhost:9001
# See configuration.py for a list of all supported configuration parameters.
configuration = openapi_client.Configuration(
    host = "https://localhost:9001"
)


# Enter a context with an instance of the API client
with openapi_client.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = openapi_client.DefaultApi(api_client)
    id = 'id_example' # str | 
    path = 'path_example' # str | 

    try:
        api_instance.delete_filesystem_entry(id, path)
    except Exception as e:
        print("Exception when calling DefaultApi->delete_filesystem_entry: %s\n" % e)
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **id** | **str**|  | 
 **path** | **str**|  | 

### Return type

void (empty response body)

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: Not defined

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
**204** | No content |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **delete_session**
> delete_session(id)



### Example

```python
from __future__ import print_function
import time
import os
import openapi_client
from openapi_client.rest import ApiException
from pprint import pprint
# Defining the host is optional and defaults to https://localhost:9001
# See configuration.py for a list of all supported configuration parameters.
configuration = openapi_client.Configuration(
    host = "https://localhost:9001"
)


# Enter a context with an instance of the API client
with openapi_client.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = openapi_client.DefaultApi(api_client)
    id = 'id_example' # str | 

    try:
        api_instance.delete_session(id)
    except Exception as e:
        print("Exception when calling DefaultApi->delete_session: %s\n" % e)
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **id** | **str**|  | 

### Return type

void (empty response body)

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: Not defined

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
**204** | No content |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **list_filesystem_dir**
> ListFilesystemDirResponse list_filesystem_dir(id, path)



### Example

```python
from __future__ import print_function
import time
import os
import openapi_client
from openapi_client.rest import ApiException
from pprint import pprint
# Defining the host is optional and defaults to https://localhost:9001
# See configuration.py for a list of all supported configuration parameters.
configuration = openapi_client.Configuration(
    host = "https://localhost:9001"
)


# Enter a context with an instance of the API client
with openapi_client.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = openapi_client.DefaultApi(api_client)
    id = 'id_example' # str | 
    path = 'path_example' # str | 

    try:
        api_response = api_instance.list_filesystem_dir(id, path)
        print("The response of DefaultApi->list_filesystem_dir:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling DefaultApi->list_filesystem_dir: %s\n" % e)
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **id** | **str**|  | 
 **path** | **str**|  | 

### Return type

[**ListFilesystemDirResponse**](ListFilesystemDirResponse.md)

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Ok |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **make_filesystem_dir**
> make_filesystem_dir(id, path)



### Example

```python
from __future__ import print_function
import time
import os
import openapi_client
from openapi_client.rest import ApiException
from pprint import pprint
# Defining the host is optional and defaults to https://localhost:9001
# See configuration.py for a list of all supported configuration parameters.
configuration = openapi_client.Configuration(
    host = "https://localhost:9001"
)


# Enter a context with an instance of the API client
with openapi_client.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = openapi_client.DefaultApi(api_client)
    id = 'id_example' # str | 
    path = 'path_example' # str | 

    try:
        api_instance.make_filesystem_dir(id, path)
    except Exception as e:
        print("Exception when calling DefaultApi->make_filesystem_dir: %s\n" % e)
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **id** | **str**|  | 
 **path** | **str**|  | 

### Return type

void (empty response body)

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: Not defined

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
**204** | No content |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **read_filesystem_file**
> ReadFilesystemFileResponse read_filesystem_file(id, path)



### Example

```python
from __future__ import print_function
import time
import os
import openapi_client
from openapi_client.rest import ApiException
from pprint import pprint
# Defining the host is optional and defaults to https://localhost:9001
# See configuration.py for a list of all supported configuration parameters.
configuration = openapi_client.Configuration(
    host = "https://localhost:9001"
)


# Enter a context with an instance of the API client
with openapi_client.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = openapi_client.DefaultApi(api_client)
    id = 'id_example' # str | 
    path = 'path_example' # str | 

    try:
        api_response = api_instance.read_filesystem_file(id, path)
        print("The response of DefaultApi->read_filesystem_file:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling DefaultApi->read_filesystem_file: %s\n" % e)
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **id** | **str**|  | 
 **path** | **str**|  | 

### Return type

[**ReadFilesystemFileResponse**](ReadFilesystemFileResponse.md)

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Ok |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **run_process**
> RunProcessResponse run_process(id, run_process_params)



### Example

```python
from __future__ import print_function
import time
import os
import openapi_client
from openapi_client.rest import ApiException
from pprint import pprint
# Defining the host is optional and defaults to https://localhost:9001
# See configuration.py for a list of all supported configuration parameters.
configuration = openapi_client.Configuration(
    host = "https://localhost:9001"
)


# Enter a context with an instance of the API client
with openapi_client.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = openapi_client.DefaultApi(api_client)
    id = 'id_example' # str | 
    run_process_params = openapi_client.RunProcessParams() # RunProcessParams | 

    try:
        api_response = api_instance.run_process(id, run_process_params)
        print("The response of DefaultApi->run_process:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling DefaultApi->run_process: %s\n" % e)
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **id** | **str**|  | 
 **run_process_params** | [**RunProcessParams**](RunProcessParams.md)|  | 

### Return type

[**RunProcessResponse**](RunProcessResponse.md)

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Ok |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **write_filesystem_file**
> write_filesystem_file(id, path, write_filesystem_file_params)



### Example

```python
from __future__ import print_function
import time
import os
import openapi_client
from openapi_client.rest import ApiException
from pprint import pprint
# Defining the host is optional and defaults to https://localhost:9001
# See configuration.py for a list of all supported configuration parameters.
configuration = openapi_client.Configuration(
    host = "https://localhost:9001"
)


# Enter a context with an instance of the API client
with openapi_client.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = openapi_client.DefaultApi(api_client)
    id = 'id_example' # str | 
    path = 'path_example' # str | 
    write_filesystem_file_params = openapi_client.WriteFilesystemFileParams() # WriteFilesystemFileParams | 

    try:
        api_instance.write_filesystem_file(id, path, write_filesystem_file_params)
    except Exception as e:
        print("Exception when calling DefaultApi->write_filesystem_file: %s\n" % e)
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **id** | **str**|  | 
 **path** | **str**|  | 
 **write_filesystem_file_params** | [**WriteFilesystemFileParams**](WriteFilesystemFileParams.md)|  | 

### Return type

void (empty response body)

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: Not defined

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
**204** | No content |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

