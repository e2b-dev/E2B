# ProcessResponse


## Properties
Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**stderr** | [**List[OutStderrResponse]**](OutStderrResponse.md) |  | 
**stdout** | [**List[OutStdoutResponse]**](OutStdoutResponse.md) |  | 
**process_id** | **str** |  | 
**finished** | **bool** |  | 

## Example

```python
from playground_client.models.process_response import ProcessResponse

# TODO update the JSON string below
json = "{}"
# create an instance of ProcessResponse from a JSON string
process_response_instance = ProcessResponse.from_json(json)
# print the JSON string representation of the object
print ProcessResponse.to_json()

# convert the object into a dict
process_response_dict = process_response_instance.to_dict()
# create an instance of ProcessResponse from a dict
process_response_form_dict = process_response.from_dict(process_response_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


