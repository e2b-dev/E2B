# StartProcessParams


## Properties
Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**cmd** | **str** |  | 
**env_vars** | **Dict[str, str]** |  | [optional] 
**rootdir** | **str** |  | [optional] 

## Example

```python
from playground_client.models.start_process_params import StartProcessParams

# TODO update the JSON string below
json = "{}"
# create an instance of StartProcessParams from a JSON string
start_process_params_instance = StartProcessParams.from_json(json)
# print the JSON string representation of the object
print StartProcessParams.to_json()

# convert the object into a dict
start_process_params_dict = start_process_params_instance.to_dict()
# create an instance of StartProcessParams from a dict
start_process_params_form_dict = start_process_params.from_dict(start_process_params_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


