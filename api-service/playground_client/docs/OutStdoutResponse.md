# OutStdoutResponse


## Properties
Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**type** | [**OutTypeStdout**](OutTypeStdout.md) |  | 
**timestamp** | **float** |  | 
**line** | **str** |  | 

## Example

```python
from playground_client.models.out_stdout_response import OutStdoutResponse

# TODO update the JSON string below
json = "{}"
# create an instance of OutStdoutResponse from a JSON string
out_stdout_response_instance = OutStdoutResponse.from_json(json)
# print the JSON string representation of the object
print OutStdoutResponse.to_json()

# convert the object into a dict
out_stdout_response_dict = out_stdout_response_instance.to_dict()
# create an instance of OutStdoutResponse from a dict
out_stdout_response_form_dict = out_stdout_response.from_dict(out_stdout_response_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


