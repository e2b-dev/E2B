# WriteProcessStdinRequest


## Properties
Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**stdin** | **str** |  | 

## Example

```python
from playground_client.models.write_process_stdin_request import WriteProcessStdinRequest

# TODO update the JSON string below
json = "{}"
# create an instance of WriteProcessStdinRequest from a JSON string
write_process_stdin_request_instance = WriteProcessStdinRequest.from_json(json)
# print the JSON string representation of the object
print WriteProcessStdinRequest.to_json()

# convert the object into a dict
write_process_stdin_request_dict = write_process_stdin_request_instance.to_dict()
# create an instance of WriteProcessStdinRequest from a dict
write_process_stdin_request_form_dict = write_process_stdin_request.from_dict(write_process_stdin_request_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


