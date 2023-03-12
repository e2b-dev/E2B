# RunProcessParams


## Properties
Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**cmd** | **str** |  | 
**env_vars** | **Dict[str, str]** |  | [optional] 
**rootdir** | **str** |  | [optional] 

## Example

```python
from playground_client.models.run_process_params import RunProcessParams

# TODO update the JSON string below
json = "{}"
# create an instance of RunProcessParams from a JSON string
run_process_params_instance = RunProcessParams.from_json(json)
# print the JSON string representation of the object
print RunProcessParams.to_json()

# convert the object into a dict
run_process_params_dict = run_process_params_instance.to_dict()
# create an instance of RunProcessParams from a dict
run_process_params_form_dict = run_process_params.from_dict(run_process_params_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


