# CreateDeploymentRequest


## Properties
Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**project_id** | **str** |  | 
**code** | **str** |  | 
**env_vars** | **Dict[str, str]** |  | [optional] 

## Example

```python
from playground_client.models.create_deployment_request import CreateDeploymentRequest

# TODO update the JSON string below
json = "{}"
# create an instance of CreateDeploymentRequest from a JSON string
create_deployment_request_instance = CreateDeploymentRequest.from_json(json)
# print the JSON string representation of the object
print CreateDeploymentRequest.to_json()

# convert the object into a dict
create_deployment_request_dict = create_deployment_request_instance.to_dict()
# create an instance of CreateDeploymentRequest from a dict
create_deployment_request_form_dict = create_deployment_request.from_dict(create_deployment_request_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


