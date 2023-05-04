# playground_client.DefaultApi

All URIs are relative to *https://localhost:49160*

Method | HTTP request | Description
------------- | ------------- | -------------
[**create_sessions**](DefaultApi.md#create_sessions) | **POST** /sessions | 
[**delete_filesystem_entry**](DefaultApi.md#delete_filesystem_entry) | **DELETE** /sessions/{sessionID}/filesystem | 
[**delete_session**](DefaultApi.md#delete_session) | **DELETE** /sessions/{sessionID} | 
[**get_process**](DefaultApi.md#get_process) | **GET** /sessions/{sessionID}/processes/{processID} | 
[**get_session**](DefaultApi.md#get_session) | **GET** /sessions/{sessionID} | 
[**list_filesystem_dir**](DefaultApi.md#list_filesystem_dir) | **GET** /sessions/{sessionID}/filesystem/dir | 
[**make_filesystem_dir**](DefaultApi.md#make_filesystem_dir) | **PUT** /sessions/{sessionID}/filesystem/dir | 
[**read_filesystem_file**](DefaultApi.md#read_filesystem_file) | **GET** /sessions/{sessionID}/filesystem/file | 
[**start_process**](DefaultApi.md#start_process) | **POST** /sessions/{sessionID}/processes | 
[**stop_process**](DefaultApi.md#stop_process) | **DELETE** /sessions/{sessionID}/processes/{processID} | 
[**write_filesystem_file**](DefaultApi.md#write_filesystem_file) | **PUT** /sessions/{sessionID}/filesystem/file | 
[**write_process_stdin**](DefaultApi.md#write_process_stdin) | **POST** /sessions/{sessionID}/processes/{processID}/stdin | 


# **create_sessions**
> SessionResponse create_sessions(create_sessions_request)



### Example

```python
from __future__ import print_function
import time
import os
import playground_client
from playground_client.rest import ApiException
from pprint import pprint
# Defining the host is optional and defaults to https://localhost:49160
# See configuration.py for a list of all supported configuration parameters.
configuration = playground_client.Configuration(
    host = "https://localhost:49160"
)


# Enter a context with an instance of the API client
with playground_client.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = playground_client.DefaultApi(api_client)
    create_sessions_request = playground_client.CreateSessionsRequest() # CreateSessionsRequest | 

    try:
        api_response = api_instance.create_sessions(create_sessions_request)
        print("The response of DefaultApi->create_sessions:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling DefaultApi->create_sessions: %s\n" % e)
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **create_sessions_request** | [**CreateSessionsRequest**](CreateSessionsRequest.md)|  | 

### Return type

[**SessionResponse**](SessionResponse.md)

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
> delete_filesystem_entry(session_id, path)



### Example

```python
from __future__ import print_function
import time
import os
import playground_client
from playground_client.rest import ApiException
from pprint import pprint
# Defining the host is optional and defaults to https://localhost:49160
# See configuration.py for a list of all supported configuration parameters.
configuration = playground_client.Configuration(
    host = "https://localhost:49160"
)


# Enter a context with an instance of the API client
with playground_client.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = playground_client.DefaultApi(api_client)
    session_id = 'session_id_example' # str | 
    path = 'path_example' # str | 

    try:
        api_instance.delete_filesystem_entry(session_id, path)
    except Exception as e:
        print("Exception when calling DefaultApi->delete_filesystem_entry: %s\n" % e)
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **session_id** | **str**|  | 
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
> delete_session(session_id)



### Example

```python
from __future__ import print_function
import time
import os
import playground_client
from playground_client.rest import ApiException
from pprint import pprint
# Defining the host is optional and defaults to https://localhost:49160
# See configuration.py for a list of all supported configuration parameters.
configuration = playground_client.Configuration(
    host = "https://localhost:49160"
)


# Enter a context with an instance of the API client
with playground_client.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = playground_client.DefaultApi(api_client)
    session_id = 'session_id_example' # str | 

    try:
        api_instance.delete_session(session_id)
    except Exception as e:
        print("Exception when calling DefaultApi->delete_session: %s\n" % e)
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **session_id** | **str**|  | 

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

# **get_process**
> ProcessResponse get_process(session_id, process_id, wait=wait)



### Example

```python
from __future__ import print_function
import time
import os
import playground_client
from playground_client.rest import ApiException
from pprint import pprint
# Defining the host is optional and defaults to https://localhost:49160
# See configuration.py for a list of all supported configuration parameters.
configuration = playground_client.Configuration(
    host = "https://localhost:49160"
)


# Enter a context with an instance of the API client
with playground_client.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = playground_client.DefaultApi(api_client)
    session_id = 'session_id_example' # str | 
    process_id = 'process_id_example' # str | 
    wait = True # bool | if true the request will wait until the process ends and then return the `stdout`, `stderr` and `processID`. (optional)

    try:
        api_response = api_instance.get_process(session_id, process_id, wait=wait)
        print("The response of DefaultApi->get_process:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling DefaultApi->get_process: %s\n" % e)
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **session_id** | **str**|  | 
 **process_id** | **str**|  | 
 **wait** | **bool**| if true the request will wait until the process ends and then return the &#x60;stdout&#x60;, &#x60;stderr&#x60; and &#x60;processID&#x60;. | [optional] 

### Return type

[**ProcessResponse**](ProcessResponse.md)

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | &#x60;processID&#x60; and all &#x60;stdout&#x60; and &#x60;stderr&#x60; that the process outputted until now. |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **get_session**
> SessionResponse get_session(session_id)



### Example

```python
from __future__ import print_function
import time
import os
import playground_client
from playground_client.rest import ApiException
from pprint import pprint
# Defining the host is optional and defaults to https://localhost:49160
# See configuration.py for a list of all supported configuration parameters.
configuration = playground_client.Configuration(
    host = "https://localhost:49160"
)


# Enter a context with an instance of the API client
with playground_client.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = playground_client.DefaultApi(api_client)
    session_id = 'session_id_example' # str | 

    try:
        api_response = api_instance.get_session(session_id)
        print("The response of DefaultApi->get_session:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling DefaultApi->get_session: %s\n" % e)
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **session_id** | **str**|  | 

### Return type

[**SessionResponse**](SessionResponse.md)

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

# **list_filesystem_dir**
> ListFilesystemDirResponse list_filesystem_dir(session_id, path)



### Example

```python
from __future__ import print_function
import time
import os
import playground_client
from playground_client.rest import ApiException
from pprint import pprint
# Defining the host is optional and defaults to https://localhost:49160
# See configuration.py for a list of all supported configuration parameters.
configuration = playground_client.Configuration(
    host = "https://localhost:49160"
)


# Enter a context with an instance of the API client
with playground_client.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = playground_client.DefaultApi(api_client)
    session_id = 'session_id_example' # str | 
    path = 'path_example' # str | 

    try:
        api_response = api_instance.list_filesystem_dir(session_id, path)
        print("The response of DefaultApi->list_filesystem_dir:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling DefaultApi->list_filesystem_dir: %s\n" % e)
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **session_id** | **str**|  | 
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
> make_filesystem_dir(session_id, path)



### Example

```python
from __future__ import print_function
import time
import os
import playground_client
from playground_client.rest import ApiException
from pprint import pprint
# Defining the host is optional and defaults to https://localhost:49160
# See configuration.py for a list of all supported configuration parameters.
configuration = playground_client.Configuration(
    host = "https://localhost:49160"
)


# Enter a context with an instance of the API client
with playground_client.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = playground_client.DefaultApi(api_client)
    session_id = 'session_id_example' # str | 
    path = 'path_example' # str | 

    try:
        api_instance.make_filesystem_dir(session_id, path)
    except Exception as e:
        print("Exception when calling DefaultApi->make_filesystem_dir: %s\n" % e)
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **session_id** | **str**|  | 
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
> ReadFilesystemFileResponse read_filesystem_file(session_id, path)



### Example

```python
from __future__ import print_function
import time
import os
import playground_client
from playground_client.rest import ApiException
from pprint import pprint
# Defining the host is optional and defaults to https://localhost:49160
# See configuration.py for a list of all supported configuration parameters.
configuration = playground_client.Configuration(
    host = "https://localhost:49160"
)


# Enter a context with an instance of the API client
with playground_client.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = playground_client.DefaultApi(api_client)
    session_id = 'session_id_example' # str | 
    path = 'path_example' # str | 

    try:
        api_response = api_instance.read_filesystem_file(session_id, path)
        print("The response of DefaultApi->read_filesystem_file:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling DefaultApi->read_filesystem_file: %s\n" % e)
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **session_id** | **str**|  | 
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

# **start_process**
> ProcessResponse start_process(session_id, start_process_params, wait=wait)



### Example

```python
from __future__ import print_function
import time
import os
import playground_client
from playground_client.rest import ApiException
from pprint import pprint
# Defining the host is optional and defaults to https://localhost:49160
# See configuration.py for a list of all supported configuration parameters.
configuration = playground_client.Configuration(
    host = "https://localhost:49160"
)


# Enter a context with an instance of the API client
with playground_client.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = playground_client.DefaultApi(api_client)
    session_id = 'session_id_example' # str | 
    start_process_params = playground_client.StartProcessParams() # StartProcessParams | 
    wait = True # bool | if true the request will wait until the process ends and then return the `stdout`, `stderr` and `processID`. (optional)

    try:
        api_response = api_instance.start_process(session_id, start_process_params, wait=wait)
        print("The response of DefaultApi->start_process:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling DefaultApi->start_process: %s\n" % e)
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **session_id** | **str**|  | 
 **start_process_params** | [**StartProcessParams**](StartProcessParams.md)|  | 
 **wait** | **bool**| if true the request will wait until the process ends and then return the &#x60;stdout&#x60;, &#x60;stderr&#x60; and &#x60;processID&#x60;. | [optional] 

### Return type

[**ProcessResponse**](ProcessResponse.md)

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | &#x60;processID&#x60; and all &#x60;stdout&#x60; and &#x60;stderr&#x60; that the process outputted until now. |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **stop_process**
> ProcessResponse stop_process(session_id, process_id, results=results)



### Example

```python
from __future__ import print_function
import time
import os
import playground_client
from playground_client.rest import ApiException
from pprint import pprint
# Defining the host is optional and defaults to https://localhost:49160
# See configuration.py for a list of all supported configuration parameters.
configuration = playground_client.Configuration(
    host = "https://localhost:49160"
)


# Enter a context with an instance of the API client
with playground_client.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = playground_client.DefaultApi(api_client)
    session_id = 'session_id_example' # str | 
    process_id = 'process_id_example' # str | 
    results = True # bool |  (optional)

    try:
        api_response = api_instance.stop_process(session_id, process_id, results=results)
        print("The response of DefaultApi->stop_process:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling DefaultApi->stop_process: %s\n" % e)
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **session_id** | **str**|  | 
 **process_id** | **str**|  | 
 **results** | **bool**|  | [optional] 

### Return type

[**ProcessResponse**](ProcessResponse.md)

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

# **write_filesystem_file**
> write_filesystem_file(session_id, path, write_filesystem_file_request)



### Example

```python
from __future__ import print_function
import time
import os
import playground_client
from playground_client.rest import ApiException
from pprint import pprint
# Defining the host is optional and defaults to https://localhost:49160
# See configuration.py for a list of all supported configuration parameters.
configuration = playground_client.Configuration(
    host = "https://localhost:49160"
)


# Enter a context with an instance of the API client
with playground_client.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = playground_client.DefaultApi(api_client)
    session_id = 'session_id_example' # str | 
    path = 'path_example' # str | 
    write_filesystem_file_request = playground_client.WriteFilesystemFileRequest() # WriteFilesystemFileRequest | 

    try:
        api_instance.write_filesystem_file(session_id, path, write_filesystem_file_request)
    except Exception as e:
        print("Exception when calling DefaultApi->write_filesystem_file: %s\n" % e)
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **session_id** | **str**|  | 
 **path** | **str**|  | 
 **write_filesystem_file_request** | [**WriteFilesystemFileRequest**](WriteFilesystemFileRequest.md)|  | 

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

# **write_process_stdin**
> write_process_stdin(session_id, process_id, write_process_stdin_request)



### Example

```python
from __future__ import print_function
import time
import os
import playground_client
from playground_client.rest import ApiException
from pprint import pprint
# Defining the host is optional and defaults to https://localhost:49160
# See configuration.py for a list of all supported configuration parameters.
configuration = playground_client.Configuration(
    host = "https://localhost:49160"
)


# Enter a context with an instance of the API client
with playground_client.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = playground_client.DefaultApi(api_client)
    session_id = 'session_id_example' # str | 
    process_id = 'process_id_example' # str | 
    write_process_stdin_request = playground_client.WriteProcessStdinRequest() # WriteProcessStdinRequest | 

    try:
        api_instance.write_process_stdin(session_id, process_id, write_process_stdin_request)
    except Exception as e:
        print("Exception when calling DefaultApi->write_process_stdin: %s\n" % e)
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **session_id** | **str**|  | 
 **process_id** | **str**|  | 
 **write_process_stdin_request** | [**WriteProcessStdinRequest**](WriteProcessStdinRequest.md)|  | 

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

