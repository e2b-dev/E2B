# RunProcessResponse


## Properties
Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**stderr** | [**List[OutStderrResponse]**](OutStderrResponse.md) |  | 
**stdout** | [**List[OutStdoutResponse]**](OutStdoutResponse.md) |  | 

## Example

```python
from playground_client.models.run_process_response import RunProcessResponse

# TODO update the JSON string below
json = "{}"
# create an instance of RunProcessResponse from a JSON string
run_process_response_instance = RunProcessResponse.from_json(json)
# print the JSON string representation of the object
print RunProcessResponse.to_json()

# convert the object into a dict
run_process_response_dict = run_process_response_instance.to_dict()
# create an instance of RunProcessResponse from a dict
run_process_response_form_dict = run_process_response.from_dict(run_process_response_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


