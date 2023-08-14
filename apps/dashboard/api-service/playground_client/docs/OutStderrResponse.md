# OutStderrResponse


## Properties
Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**type** | [**OutTypeStderr**](OutTypeStderr.md) |  | 
**timestamp** | **float** |  | 
**line** | **str** |  | 

## Example

```python
from playground_client.models.out_stderr_response import OutStderrResponse

# TODO update the JSON string below
json = "{}"
# create an instance of OutStderrResponse from a JSON string
out_stderr_response_instance = OutStderrResponse.from_json(json)
# print the JSON string representation of the object
print OutStderrResponse.to_json()

# convert the object into a dict
out_stderr_response_dict = out_stderr_response_instance.to_dict()
# create an instance of OutStderrResponse from a dict
out_stderr_response_form_dict = out_stderr_response.from_dict(out_stderr_response_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


